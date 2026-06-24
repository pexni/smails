import { useEffect, useRef, useState, useCallback } from "react"

export type WsStatus = "connecting" | "connected" | "disconnected"

interface UseWebSocketOptions {
  url: string | null
  onMessage?: (data: unknown) => void
  maxRetries?: number
  pingIntervalMs?: number
}

export function useWebSocket({
  url,
  onMessage,
  maxRetries = Infinity,
  pingIntervalMs = 30000,
}: UseWebSocketOptions) {
  const [status, setStatus] = useState<WsStatus>("disconnected")
  const wsRef = useRef<WebSocket | null>(null)
  const retriesRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const pingTimerRef = useRef<ReturnType<typeof setInterval>>(undefined)
  const urlRef = useRef(url)
  const onMessageRef = useRef(onMessage)
  const disposedRef = useRef(false)

  urlRef.current = url
  onMessageRef.current = onMessage

  const stopPing = useCallback(() => {
    clearInterval(pingTimerRef.current)
  }, [])

  const startPing = useCallback((ws: WebSocket) => {
    stopPing()
    pingTimerRef.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send("ping")
      }
    }, pingIntervalMs)
  }, [pingIntervalMs, stopPing])

  const connect = useCallback(() => {
    const currentUrl = urlRef.current
    if (!currentUrl || disposedRef.current) return

    wsRef.current?.close()
    setStatus("connecting")

    const ws = new WebSocket(currentUrl)

    ws.onopen = () => {
      if (disposedRef.current) { ws.close(); return }
      retriesRef.current = 0
      setStatus("connected")
      startPing(ws)
    }

    ws.onmessage = (event) => {
      if (event.data === "pong") return
      try {
        const data = JSON.parse(event.data)
        onMessageRef.current?.(data)
      } catch {}
    }

    ws.onclose = () => {
      stopPing()
      if (disposedRef.current) return
      setStatus("disconnected")
      if (retriesRef.current < maxRetries) {
        const delay = Math.min(1000 * 2 ** retriesRef.current, 30000)
        retriesRef.current++
        timerRef.current = setTimeout(connect, delay)
      }
    }

    ws.onerror = () => {
      ws.close()
    }

    wsRef.current = ws
  }, [maxRetries, startPing, stopPing])

  const disconnect = useCallback(() => {
    clearTimeout(timerRef.current)
    stopPing()
    disposedRef.current = true
    wsRef.current?.close()
    wsRef.current = null
    setStatus("disconnected")
  }, [stopPing])

  useEffect(() => {
    disposedRef.current = false
    retriesRef.current = 0
    connect()
    return () => {
      disposedRef.current = true
      clearTimeout(timerRef.current)
      stopPing()
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [url, connect, stopPing])

  return { status, reconnect: connect, disconnect }
}
