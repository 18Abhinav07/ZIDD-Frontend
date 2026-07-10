export type SSEEventCallback = (eventName: string, data: unknown) => void;
export type SSECompleteCallback = (info: { doneSeen: boolean }) => void;
export type SSEError = Error & { status?: number; code?: string };

const DEFAULT_IDLE_TIMEOUT_MS = 240_000;
const DEFAULT_STARTUP_TIMEOUT_MS = 120_000;

export class ZiddSSEClient {
  private abortController: AbortController | null = null;
  private url: string;
  private body: unknown;
  private method: string;
  private headers: Record<string, string>;
  private onEvent: SSEEventCallback;
  private onOpen: () => void;
  private onError: (err: SSEError) => void;
  private onComplete: SSECompleteCallback;
  private idleTimeoutMs: number;
  private startupTimeoutMs: number;

  constructor(
    url: string,
    options: {
      body?: unknown;
      method?: string;
      headers?: Record<string, string>;
      onOpen?: () => void;
      onEvent: SSEEventCallback;
      onError: (err: SSEError) => void;
      onComplete?: SSECompleteCallback;
      idleTimeoutMs?: number;
      startupTimeoutMs?: number;
    }
  ) {
    this.url = url;
    this.body = options.body;
    this.method = options.method || 'GET';
    this.headers = options.headers || {};
    this.onOpen = options.onOpen || (() => {});
    this.onEvent = options.onEvent;
    this.onError = options.onError;
    this.onComplete = options.onComplete || (() => {});
    this.idleTimeoutMs = options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
    this.startupTimeoutMs = options.startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS;
  }

  async connect() {
    this.abortController = new AbortController();
    let startupTimer: ReturnType<typeof setTimeout> | null = null;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let doneSeen = false;
    let startupTimedOut = false;
    let idleTimedOut = false;
    let opened = false;
    const clearStartupTimer = () => {
      if (startupTimer) clearTimeout(startupTimer);
      startupTimer = null;
    };
    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        idleTimedOut = true;
        this.abortController?.abort(new Error('SSE stream idle timeout'));
      }, this.idleTimeoutMs);
    };
    const clearIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = null;
    };
    try {
      const mergedHeaders: Record<string, string> = { ...this.headers };
      if (this.body !== undefined) {
        mergedHeaders['Content-Type'] = 'application/json';
      }

      startupTimer = setTimeout(() => {
        startupTimedOut = true;
        this.abortController?.abort(new Error('SSE stream startup timeout'));
      }, this.startupTimeoutMs);

      const response = await fetch(this.url, {
        method: this.method,
        headers: mergedHeaders,
        body: this.body !== undefined ? JSON.stringify(this.body) : undefined,
        signal: this.abortController.signal,
      });
      clearStartupTimer();

      if (!response.ok) {
        const body = await response.json().catch((): Record<string, unknown> => ({}));
        const detail = body.detail;
        const detailObject =
          typeof detail === 'object' && detail !== null
            ? (detail as { code?: unknown; message?: unknown })
            : null;
        const code = typeof detailObject?.code === 'string' ? detailObject.code : undefined;
        const message = typeof detail === 'string'
          ? detail
          : typeof detailObject?.message === 'string'
            ? detailObject.message
            : `HTTP error! status: ${response.status}`;
        const err = new Error(message) as SSEError;
        err.status = response.status;
        err.code = code;
        throw err;
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }
      opened = true;
      this.onOpen();

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const processFrame = (frame: string) => {
        if (!frame.trim()) return;

        let eventName = 'message';
        const dataLines: string[] = [];

        const lines = frame.replace(/\r\n/g, '\n').split('\n');
        for (const rawLine of lines) {
          const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
          if (!line || line.startsWith(':')) continue;
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).replace(/^ /, ''));
          }
        }

        const dataStr = dataLines.join('\n');
        if (dataStr) {
          try {
            const parsedData = JSON.parse(dataStr);
            if (eventName === 'done') doneSeen = true;
            this.onEvent(eventName, parsedData);
          } catch {
            this.onError(new Error(`Failed to parse SSE JSON for ${eventName}`));
          }
        }
      };

      resetIdleTimer();
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // Flush the decoder's remainder + any final buffered frame that was
          // NOT terminated by a trailing blank line. The backend flushes a last
          // frame on close; without a symmetric flush here a terminal
          // `done`/`complete` frame is dropped and the UI hangs.
          buffer += decoder.decode();
          if (buffer.trim()) processFrame(buffer);
          clearIdleTimer();
          if (!doneSeen) {
            this.onError(new Error('SSE stream ended before terminal done frame'));
          }
          this.onComplete({ doneSeen });
          break;
        }

        resetIdleTimer();
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.replace(/\r\n/g, '\n').split('\n\n');
        buffer = frames.pop() || '';

        for (const frame of frames) {
          processFrame(frame);
        }
      }
    } catch (error: unknown) {
      clearStartupTimer();
      clearIdleTimer();
      const err = error instanceof Error ? error : new Error(String(error));
      if (startupTimedOut) {
        this.onError(new Error('SSE stream startup timeout'));
        this.onComplete({ doneSeen });
      } else if (idleTimedOut) {
        this.onError(new Error('SSE stream idle timeout'));
        this.onComplete({ doneSeen });
      } else if (err.name !== 'AbortError') {
        this.onError(err);
        if (opened) {
          this.onComplete({ doneSeen });
        }
      }
    }
  }

  disconnect() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}
