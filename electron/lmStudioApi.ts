type ModelEntry = { name: string; size: number; family: string; parameterSize: string; local: true }

export function lmStudioEndpoint(baseUrl: string, path: string) {
  const origin = new URL(baseUrl.trim()).origin
  const nativeModels = path === '/models' && /\/api\/v1\/?$/i.test(new URL(baseUrl.trim()).pathname)
  return `${origin}${nativeModels ? '/api/v1/models' : `/v1${path}`}`
}

export function parseLmStudioModels(value: unknown): ModelEntry[] {
  if (!value || typeof value !== 'object') return []
  const response = value as { models?: unknown; data?: unknown }
  if (Array.isArray(response.models)) {
    return response.models
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .filter((item) => item.type === 'llm' && typeof item.key === 'string' && item.key.trim().length > 0)
      .sort((a, b) => Number(Array.isArray(b.loaded_instances) && b.loaded_instances.length > 0) - Number(Array.isArray(a.loaded_instances) && a.loaded_instances.length > 0))
      .map((item) => ({ name: item.key as string, size: typeof item.size_bytes === 'number' ? item.size_bytes : 0, family: typeof item.architecture === 'string' ? item.architecture : 'lmstudio', parameterSize: typeof item.params_string === 'string' ? item.params_string : '', local: true as const }))
  }
  if (!Array.isArray(response.data)) return []
  return response.data
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .filter((item) => typeof item.id === 'string' && item.id.trim().length > 0 && !/embed(?:ding)?/i.test(item.id))
    .map((item) => ({ name: item.id as string, size: 0, family: typeof item.owned_by === 'string' ? item.owned_by : 'lmstudio', parameterSize: '', local: true as const }))
}
