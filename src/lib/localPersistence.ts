export function writeLocalJson(key: string, value: unknown, storage: Pick<Storage, 'setItem'> = localStorage): boolean {
  try {
    storage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}
