import type { GpuRouteDevice, GpuRoutingSettings, GpuTelemetry, WorkflowComponentRoute, WorkflowGpuRouting } from '../types'
import { hasInput, type ObjectInfo } from './comfyInfo'

export type RoutingComponent = 'diffusion' | 'textEncoder' | 'videoVae' | 'audioVae' | 'previewVae'
export type RoutingGpu = { index: number; name: string; totalBytes: number; freeBytes: number; usedBytes: number }
export type RoutingPlacement = { component: RoutingComponent; requested: GpuRouteDevice; resolved: GpuRouteDevice; route?: WorkflowComponentRoute; status: 'auto' | 'ready' | 'warning'; note?: string }
export type ResolvedGpuRouting = { workflow: WorkflowGpuRouting; placements: Record<RoutingComponent, RoutingPlacement>; gpus: RoutingGpu[]; warnings: string[]; vramWarnings: string[]; summary: string; logLine: string }

const components: RoutingComponent[] = ['diffusion', 'textEncoder', 'videoVae', 'audioVae', 'previewVae']
const labels: Record<RoutingComponent, string> = { diffusion: 'Diffusion', textEncoder: 'Text Encoder', videoVae: 'Video VAE', audioVae: 'Audio VAE', previewVae: 'Preview VAE' }

// Settings can outlive a release that introduced a new routing field. Never
// let a partially persisted preference take down the React settings surface.
function safeRoute(value: unknown): GpuRouteDevice {
  return value === 'auto' || value === 'cpu' || (typeof value === 'string' && /^gpu:\d+$/.test(value)) ? value as GpuRouteDevice : 'auto'
}

export function routingGpus(telemetry?: GpuTelemetry | null, comfyDevices: Array<{ name?: string; type?: string; vram_total?: number; vram_free?: number }> = []): RoutingGpu[] {
  const cleanName = (name: string) => name.replace(/^.*?cuda:\d+\s*/i, '').replace(/^NVIDIA GeForce /i, '').trim()
  const cudaIndex = (name: string) => {
    const match = name.match(/cuda:(\d+)/i)
    return match ? Number(match[1]) : undefined
  }
  const visible = comfyDevices.filter((device) => /cuda/i.test(`${device.type ?? ''} ${device.name ?? ''}`))
  const fromComfy = visible.map((device, index) => {
    const name = cleanName(device.name ?? `GPU ${index}`)
    const reportedIndex = cudaIndex(device.name ?? '')
    const live = telemetry?.devices?.find((candidate) => candidate.index === reportedIndex)
      ?? telemetry?.devices?.find((candidate) => cleanName(candidate.name).toLowerCase() === name.toLowerCase())
    const totalBytes = device.vram_total ?? (live?.vramTotalMb ?? 0) * 1024 ** 2
    const freeBytes = live ? live.vramFreeMb * 1024 ** 2 : device.vram_free ?? 0
    // ComfyUI may expose only a primary device, and that device may be
    // cuda:1 or another nonzero index when launched with --cuda-device.
    // Preserve its reported/telemetry CUDA index instead of assuming the
    // first /system_stats entry is always GPU 0.
    return { index: reportedIndex ?? live?.index ?? index, name, totalBytes, freeBytes, usedBytes: Math.max(0, totalBytes - freeBytes) }
  })
  const fromNvidia = telemetry?.devices?.map((gpu) => ({ index: gpu.index, name: cleanName(gpu.name), totalBytes: gpu.vramTotalMb * 1024 ** 2, freeBytes: gpu.vramFreeMb * 1024 ** 2, usedBytes: gpu.vramUsedMb * 1024 ** 2 })) ?? []
  // /system_stats commonly advertises only ComfyUI's primary CUDA device.
  // Keep the complete NVIDIA inventory too: a device-aware loader may use a
  // secondary GPU even when that endpoint only names cuda:0.
  return [...fromComfy, ...fromNvidia.filter((candidate) => !fromComfy.some((device) => device.index === candidate.index || device.name.toLowerCase() === candidate.name.toLowerCase()))].sort((a, b) => a.index - b.index)
}

function requestedRoutes(settings: GpuRoutingSettings, gpus: RoutingGpu[], sizes: Partial<Record<RoutingComponent, number>>) {
  if (settings.preset === 'custom') return { diffusion: safeRoute(settings.diffusion), textEncoder: safeRoute(settings.textEncoder), videoVae: safeRoute(settings.videoVae), audioVae: safeRoute(settings.audioVae), previewVae: safeRoute(settings.previewVae), strategy: settings.strategy }
  if (!gpus.length) return { diffusion: 'auto', textEncoder: 'auto', videoVae: 'auto', audioVae: 'auto', previewVae: 'auto', strategy: settings.strategy } as const
  if (gpus.length === 1 && settings.preset === 'automatic') return { diffusion: 'auto', textEncoder: 'auto', videoVae: 'auto', audioVae: 'auto', previewVae: 'auto', strategy: settings.strategy } as const
  if (settings.preset === 'single') return { diffusion: 'gpu:0', textEncoder: 'gpu:0', videoVae: 'gpu:0', audioVae: 'gpu:0', previewVae: 'gpu:0', strategy: settings.strategy } as const
  const secondaryFree = gpus[1].freeBytes
  const encoderAndVae = (sizes.textEncoder ?? 0) + (sizes.videoVae ?? 0) + (sizes.audioVae ?? 0) + 2 * 1024 ** 3
  if (settings.strategy === 'cpu-fallback') {
    return { diffusion: 'gpu:0', textEncoder: encoderAndVae > secondaryFree ? 'cpu' : 'gpu:1', videoVae: (sizes.videoVae ?? 0) > secondaryFree ? 'cpu' : 'gpu:1', audioVae: 'gpu:1', previewVae: 'gpu:1', strategy: 'cpu-fallback' } as const
  }
  const automaticStrategy = settings.preset === 'automatic' && encoderAndVae > secondaryFree ? 'sequential' : settings.strategy
  const automaticTextTarget = settings.preset === 'automatic' && (sizes.textEncoder ?? 0) > secondaryFree * 0.92 ? 'cpu' : 'gpu:1'
  return { diffusion: 'gpu:0', textEncoder: automaticTextTarget, videoVae: 'gpu:1', audioVae: 'gpu:1', previewVae: 'gpu:1', strategy: settings.preset === 'split' ? settings.strategy : automaticStrategy } as const
}

function routeFor(component: RoutingComponent, device: Exclude<GpuRouteDevice, 'auto'>, info: ObjectInfo, strategy: GpuRoutingSettings['strategy'], previewNode?: string): { route?: WorkflowComponentRoute; warning?: string } {
  const offloadDevice = strategy === 'sequential' ? 'cpu' as const : strategy === 'resident' ? device : undefined
  if (component === 'diffusion') {
    if (info.UNETLoaderMultiGPU && hasInput(info, 'UNETLoaderMultiGPU', 'device')) return { route: { device, method: 'loader', nodeType: 'UNETLoaderMultiGPU', ...(hasInput(info, 'UNETLoaderMultiGPU', 'offload_device') && offloadDevice ? { offloadDevice } : {}) } }
    if (info.SelectModelDevice) return { route: { device, method: 'selector', nodeType: 'SelectModelDevice' } }
  } else if (component === 'textEncoder') {
    if (info.CLIPLoaderMultiGPU && hasInput(info, 'CLIPLoaderMultiGPU', 'device')) return { route: { device, method: 'loader', nodeType: 'CLIPLoaderMultiGPU', ...(hasInput(info, 'CLIPLoaderMultiGPU', 'offload_device') && offloadDevice ? { offloadDevice } : {}) } }
    if (info.SelectCLIPDevice) return { route: { device, method: 'selector', nodeType: 'SelectCLIPDevice' } }
  } else if (component === 'videoVae' || component === 'audioVae') {
    if (info.VAELoaderMultiGPU && hasInput(info, 'VAELoaderMultiGPU', 'device')) return { route: { device, method: 'loader', nodeType: 'VAELoaderMultiGPU', ...(hasInput(info, 'VAELoaderMultiGPU', 'offload_device') && offloadDevice ? { offloadDevice } : {}) } }
    if (device !== 'cpu' && info.SelectVAEDevice) return { route: { device, method: 'selector', nodeType: 'SelectVAEDevice' } }
    if (device === 'cpu' && info.SelectVAEDevice) return { warning: `${labels[component]} CPU placement is unsupported by ComfyUI's Select VAE Device node. Install ComfyUI-MultiGPU for CPU VAE routing.` }
  } else if (component === 'previewVae' && previewNode && hasInput(info, previewNode, 'device')) {
    return { route: { device, method: 'inline', nodeType: previewNode } }
  }
  return { warning: `${labels[component]} routing is unavailable because this ComfyUI server does not expose a compatible device-aware node.` }
}

export function resolveGpuRouting(settings: GpuRoutingSettings, gpus: RoutingGpu[], info: ObjectInfo, sizes: Partial<Record<RoutingComponent, number>> = {}, previewNode?: string): ResolvedGpuRouting {
  const requested = requestedRoutes(settings, gpus, sizes)
  const warnings: string[] = []
  const vramWarnings: string[] = []
  const placements = {} as Record<RoutingComponent, RoutingPlacement>
  const workflow: WorkflowGpuRouting = { strategy: requested.strategy }
  for (const component of components) {
    let target = safeRoute(requested[component])
    if (target.startsWith('gpu:') && Number(target.slice(4)) >= gpus.length) {
      warnings.push(`${labels[component]} requested ${target}, but that GPU is not currently detected; using Auto.`)
      target = 'auto'
    }
    if (target === 'auto') {
      placements[component] = { component, requested: requested[component] as GpuRouteDevice, resolved: 'auto', status: 'auto' }
      continue
    }
    const capability = routeFor(component, target as Exclude<GpuRouteDevice, 'auto'>, info, requested.strategy, previewNode)
    if (!capability.route) {
      warnings.push(capability.warning!)
      placements[component] = { component, requested: target, resolved: 'auto', status: 'warning', note: capability.warning }
      continue
    }
    workflow[component] = capability.route
    placements[component] = { component, requested: target, resolved: target, route: capability.route, status: 'ready' }
  }
  for (const gpu of gpus) {
    const assigned = components.filter((component) => placements[component]?.resolved === `gpu:${gpu.index}`)
    const estimate = requested.strategy === 'sequential'
      ? Math.max(sizes.textEncoder ?? 0, assigned.filter((item) => item !== 'textEncoder').reduce((sum, item) => sum + (sizes[item] ?? 0), 0))
      : assigned.reduce((sum, item) => sum + (sizes[item] ?? 0), 0)
    if (estimate > gpu.freeBytes && gpu.freeBytes > 0) vramWarnings.push(`GPU ${gpu.index} (${gpu.name}) has ${formatGiB(gpu.freeBytes)} free; routed components are estimated to need ${formatGiB(estimate)}${requested.strategy === 'sequential' ? ' at peak with sequential offload' : ''}.`)
  }
  if (settings.preloadDiffusionDuringTextEncoding) {
    const diffusionDevice = placements.diffusion?.resolved
    const encoderDevice = placements.textEncoder?.resolved
    const helperReady = Boolean(info.OyamaH3PreloadStart && info.OyamaH3PreloadAwait)
    if (requested.strategy !== 'resident') warnings.push('DiT preload requires Keep Resident; normal sequential loading remains active.')
    else if (!helperReady) warnings.push('DiT preload helper nodes are not detected; normal resident loading remains active until ComfyUI is restarted with the Oyama helper installed.')
    else if (!diffusionDevice?.startsWith('gpu:') || !encoderDevice?.startsWith('gpu:') || diffusionDevice === encoderDevice) warnings.push('DiT preload requires the diffusion model and text encoder on two different CUDA GPUs; normal resident loading remains active.')
    else if (vramWarnings.length) warnings.push('DiT preload was withheld because the current resident placement exceeds a free-VRAM estimate; normal resident loading remains active.')
    else workflow.preloadDiffusion = { startNodeType: 'OyamaH3PreloadStart', awaitNodeType: 'OyamaH3PreloadAwait' }
  }
  const deviceName = (placement: RoutingPlacement) => placement.resolved === 'auto' ? 'Auto' : placement.resolved === 'cpu' ? 'CPU' : gpus[Number(placement.resolved.slice(4))]?.name ?? placement.resolved
  const summary = `H3: ${deviceName(placements.diffusion)} | VAE: ${deviceName(placements.videoVae)} | TE: ${deviceName(placements.textEncoder)}${requested.strategy === 'sequential' ? ' sequential' : ''}${workflow.preloadDiffusion ? ' · async preload' : ''} | Sol: Triton/Sol node | Sage fallback: launch setting | ${requested.strategy === 'sequential' ? 'Sequential Offload' : requested.strategy === 'cpu-fallback' ? 'CPU Fallback' : 'Keep Resident'}`
  const runtimeDevice = (placement: RoutingPlacement) => placement.resolved === 'auto' ? 'auto' : placement.resolved === 'cpu' ? 'cpu' : `cuda:${placement.resolved.slice(4)}`
  const logLine = components.map((component) => `${labels[component]}: ${runtimeDevice(placements[component])}`).join(' | ')
  return { workflow, placements, gpus, warnings, vramWarnings, summary, logLine }
}

export function estimatedComponentBytes(bytes: number | undefined, component: RoutingComponent) {
  if (!bytes) return 0
  const workspace = component === 'videoVae' ? 2 * 1024 ** 3 : component === 'audioVae' ? 512 * 1024 ** 2 : component === 'previewVae' ? 256 * 1024 ** 2 : 1024 * 1024 ** 2
  return Math.ceil(bytes * 1.12 + workspace)
}

export function formatGiB(bytes: number) {
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`
}

export function routingDeviceForNode(route: WorkflowComponentRoute) {
  if (route.method === 'selector') return route.device === 'cpu' ? 'cpu' : route.device
  return route.device === 'cpu' ? 'cpu' : `cuda:${route.device.slice(4)}`
}
