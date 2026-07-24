import { getAccessToken } from "./auth";
import { api } from "./api-client";

type MessageHandler<T = unknown> = (data: T) => void;
type Payload = Record<string, unknown>;

// Reconnect tuning: exponential backoff capped at 60s, with up to 2s of
// random jitter. Without jitter, an outage recovery triggers a thundering
// herd — every client reconnecting in the same tick overloads the server.
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 60000;
const JITTER_MAX_MS = 2000;
const WS_TOKEN_TTL_MS = 4 * 60 * 1000; // ws tokens live 5 min; refresh at 4

let _cachedWsToken: string | null = null;
let _wsTokenFetchedAt = 0;

/**
 * Fetch a short-lived ``ws`` token from the backend.
 *
 * The backend issues a dedicated JWT (``type: "ws"``) specifically for
 * WebSocket handshakes so the long-lived access token is never exposed in
 * the ``Sec-WebSocket-Protocol`` header. This avoids leaking the access
 * token into server logs / proxy access logs.
 */
async function fetchWsToken(): Promise<string> {
  const now = Date.now();
  if (_cachedWsToken && now - _wsTokenFetchedAt < WS_TOKEN_TTL_MS) {
    return _cachedWsToken;
  }
  const res = await api.post<{ access_token: string }>("/auth/ws-token");
  _cachedWsToken = res.access_token;
  _wsTokenFetchedAt = now;
  return _cachedWsToken;
}

export class WSClient {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers = new Map<string, Set<MessageHandler>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private tokenRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;
  private isConnected = false;
  private reconnectAttempts = 0;

  constructor(private wsToken: string) {
    const host = process.env.EXPO_PUBLIC_WS_HOST || "localhost:8001";
    const protocol = host.includes("localhost") ? "ws" : "wss";
    this.url = `${protocol}://${host}/ws`;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    this.shouldReconnect = true;

    try {
      this.ws = new WebSocket(this.url, [this.wsToken]);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.isConnected = true;
      this.reconnectAttempts = 0; // reset backoff on successful connect
      this.emit("__connected", {});
      this.scheduleTokenRefresh();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const type = data.type;
        if (type) {
          this.emit(type, data.payload || data);
        }
      } catch {
        // Ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      this.isConnected = false;
      this.clearTokenRefresh();
      this.emit("__disconnected", {});
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.clearTokenRefresh();
    this.ws?.close();
    this.ws = null;
    this.isConnected = false;
  }

  send(type: string, payload: Payload = {}) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  on<T = unknown>(type: string, handler: MessageHandler<T>): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler as MessageHandler);
    return () => {
      this.handlers.get(type)?.delete(handler as MessageHandler);
    };
  }

  get connected(): boolean {
    return this.isConnected;
  }

  private emit(type: string, payload: unknown) {
    this.handlers.get(type)?.forEach((fn) => fn(payload));
  }

  /**
   * Exponential backoff with jitter so reconnects spread out across clients
   * instead of firing in lockstep. ``delay = min(base * 2^attempts, max) + rand``.
   */
  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectAttempts += 1;
    const exp = Math.min(
      RECONNECT_BASE_MS * 2 ** this.reconnectAttempts,
      RECONNECT_MAX_MS
    );
    const jitter = Math.random() * JITTER_MAX_MS;
    const delay = exp + jitter;

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      // Re-fetch a fresh ws-token on reconnect — the previous one may have
      // expired while disconnected.
      try {
        this.wsToken = await fetchWsToken();
      } catch {
        // Fall back to the existing token; if it's expired the server will
        // close with 4001 and we'll reconnect again.
      }
      this.connect();
    }, delay);
  }

  /** Proactively refresh the ws-token before it expires (5-min lifetime). */
  private scheduleTokenRefresh() {
    this.clearTokenRefresh();
    this.tokenRefreshTimer = setTimeout(async () => {
      try {
        this.wsToken = await fetchWsToken();
      } catch {
        // Non-fatal: the current token may still be valid briefly.
      }
      this.scheduleTokenRefresh();
    }, WS_TOKEN_TTL_MS);
  }

  private clearTokenRefresh() {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }
  }
}

let _instance: WSClient | null = null;
let _refCount = 0;

export async function getWSClient(): Promise<WSClient> {
  if (!_instance) {
    // Use a dedicated ws-token rather than the access token so the
    // long-lived credential is never sent in the WebSocket handshake.
    const wsToken = await fetchWsToken();
    _instance = new WSClient(wsToken);
  }
  _refCount++;
  return _instance;
}

export function releaseWSClient() {
  _refCount = Math.max(0, _refCount - 1);
  if (_refCount === 0 && _instance) {
    _instance.disconnect();
    _instance = null;
  }
}
