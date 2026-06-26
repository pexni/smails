import { useCallback, useEffect, useRef, useState } from "react";

export type WsStatus = "connecting" | "connected" | "disconnected";

/**
 * Close a socket we're intentionally replacing/disposing, detaching its handlers
 * first so its async `onclose` can't mutate shared state (status, ping timer,
 * reconnect) for the socket that replaced it — e.g. when the mailbox changes.
 */
function detachAndClose(ws: WebSocket | null) {
  if (!ws) return;
  ws.onopen = null;
  ws.onmessage = null;
  ws.onclose = null;
  ws.onerror = null;
  ws.close();
}

interface UseWebSocketOptions {
  url: string | null;
  onMessage?: (data: unknown) => void;
  maxRetries?: number;
  pingIntervalMs?: number;
}

export function useWebSocket({
  url,
  onMessage,
  maxRetries = Infinity,
  pingIntervalMs = 30000,
}: UseWebSocketOptions) {
  const [status, setStatus] = useState<WsStatus>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pingTimerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const urlRef = useRef(url);
  const onMessageRef = useRef(onMessage);
  const disposedRef = useRef(false);

  urlRef.current = url;
  onMessageRef.current = onMessage;

  const stopPing = useCallback(() => {
    clearInterval(pingTimerRef.current);
  }, []);

  const startPing = useCallback(
    (ws: WebSocket) => {
      stopPing();
      pingTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send("ping");
        }
      }, pingIntervalMs);
    },
    [pingIntervalMs, stopPing],
  );

  const connect = useCallback(() => {
    const currentUrl = urlRef.current;
    if (!currentUrl || disposedRef.current) return;

    detachAndClose(wsRef.current);
    setStatus("connecting");

    const ws = new WebSocket(currentUrl);

    ws.onopen = () => {
      if (disposedRef.current) {
        ws.close();
        return;
      }
      retriesRef.current = 0;
      setStatus("connected");
      startPing(ws);
    };

    ws.onmessage = (event) => {
      if (event.data === "pong") return;
      try {
        const data = JSON.parse(event.data);
        onMessageRef.current?.(data);
      } catch {}
    };

    ws.onclose = () => {
      stopPing();
      if (disposedRef.current) return;
      setStatus("disconnected");
      if (retriesRef.current < maxRetries) {
        const delay = Math.min(1000 * 2 ** retriesRef.current, 30000);
        retriesRef.current++;
        timerRef.current = setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, [maxRetries, startPing, stopPing]);

  // Reset the whole socket lifecycle (timers, ping, handlers, ref). Used by both
  // disconnect() and the effect cleanup so the teardown steps can't drift apart.
  const teardown = useCallback(() => {
    disposedRef.current = true;
    clearTimeout(timerRef.current);
    stopPing();
    detachAndClose(wsRef.current);
    wsRef.current = null;
  }, [stopPing]);

  const disconnect = useCallback(() => {
    teardown();
    setStatus("disconnected");
  }, [teardown]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `url` must stay so the effect re-runs and reconnects when the URL changes
  useEffect(() => {
    disposedRef.current = false;
    retriesRef.current = 0;
    connect();
    return teardown;
  }, [url, connect, teardown]);

  return { status, reconnect: connect, disconnect };
}
