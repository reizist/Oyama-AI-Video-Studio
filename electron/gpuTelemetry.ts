import { spawn } from 'node:child_process'

type GpuTelemetryDevice = { index: number; name: string; usagePercent: number; vramPercent: number; vramUsedMb: number; vramTotalMb: number; vramFreeMb: number }
export type GpuTelemetry = { available: boolean; name?: string; usagePercent?: number; vramPercent?: number; vramUsedMb?: number; vramTotalMb?: number; devices?: GpuTelemetryDevice[] }

export function readGpuTelemetry(): Promise<GpuTelemetry> {
  return new Promise((resolve) => {
    const child = spawn('nvidia-smi', ['--query-gpu=name,utilization.gpu,memory.used,memory.total', '--format=csv,noheader,nounits'], { windowsHide: true })
    let output = ''
    let settled = false
    const finish = (value: GpuTelemetry) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(value)
    }
    // GPU telemetry is advisory. Never let a stalled driver query block the UI.
    const timer = setTimeout(() => { child.kill(); finish({ available: false }) }, 1800)
    child.stdout.on('data', (chunk) => { output += String(chunk) })
    child.on('error', () => finish({ available: false }))
    child.on('close', (code) => {
      if (code !== 0 || !output.trim()) { finish({ available: false }); return }
      const devices = output.trim().split(/\r?\n/).map((line, index) => {
        const [name = `GPU ${index}`, usage = '', used = '', total = ''] = line.split(',').map((part) => part.trim())
        const usagePercent = Number(usage) || 0
        const vramUsedMb = Number(used) || 0
        const vramTotalMb = Number(total) || 0
        return { index, name, usagePercent, vramUsedMb, vramTotalMb, vramFreeMb: Math.max(0, vramTotalMb - vramUsedMb), vramPercent: vramTotalMb > 0 ? Math.round(vramUsedMb / vramTotalMb * 100) : 0 }
      })
      const primary = devices[0]
      finish({ available: devices.length > 0, name: primary?.name, usagePercent: primary?.usagePercent, vramUsedMb: primary?.vramUsedMb, vramTotalMb: primary?.vramTotalMb, vramPercent: primary?.vramPercent, devices })
    })
  })
}
