import { useCallback, useRef, useState } from 'react'
import { writeLocalJson } from './localPersistence'

export function useLocalPersistence() {
  const pending = useRef(new Map<string, unknown>())
  const [failedKeys, setFailedKeys] = useState<string[]>([])
  const persist = useCallback((key: string, value: unknown) => {
    if (writeLocalJson(key, value)) {
      if (pending.current.delete(key)) setFailedKeys([...pending.current.keys()])
      return true
    }
    const alreadyFailed = pending.current.has(key)
    pending.current.set(key, value)
    if (!alreadyFailed) setFailedKeys([...pending.current.keys()])
    return false
  }, [])
  const retry = useCallback(() => {
    for (const [key, value] of pending.current) persist(key, value)
  }, [persist])
  return { persist, failedKeys, retry }
}
