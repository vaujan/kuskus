import { useEffect, useState } from 'react'

export function useTrailingValue<T>(value: T, delayMs: number): T {
  const [trailing, setTrailing] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setTrailing(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [delayMs, value])
  return trailing
}
