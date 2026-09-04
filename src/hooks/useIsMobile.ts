import { useSyncExternalStore } from 'react'

/** 與 Tailwind sm 斷點一致，用於必須由 JS 決定的行為（例如 Recharts 圖例） */
const MOBILE_QUERY = '(max-width: 639px)'

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(MOBILE_QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  )
}
