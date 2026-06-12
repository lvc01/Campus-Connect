"use client";

type MessageHandler<T = unknown> = (data: T) => void;
type Payload = Record<string, unknown>;

/**
 * Lightweight reconnecting WebSocket client.
 * Emits typed events so React components can subscribe to specific message types.
 */
export class WSClient {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string;
  private handlers = new Map<string, Set<MessageHandler>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;
  private isConnected = false;

  constructor(token: string) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = process.env.NEXT_PUBLIC_WS_HOST || window.location.host;
    this.url = `${protocol}//${host}/ws?token=${token}`;
    this.token = token;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    this.shouldReconnect = true;

    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.isConnected = true;
      this.emit("__connected", {});
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
      this.handlers.set(type, new Set() as Set<MessageHandler>);
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

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }
}

let _instance: WSClient | null = null;
let _refCount = 0;

export function getWSClient(token: string): WSClient {
  if (!_instance) {
    _instance = new WSClient(token);
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
