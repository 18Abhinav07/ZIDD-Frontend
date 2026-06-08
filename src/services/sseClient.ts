export type SSEEventCallback = (eventName: string, data: any) => void;

export class ZiddSSEClient {
  private abortController: AbortController | null = null;
  private url: string;
  private body: any;
  private method: string;
  private headers: Record<string, string>;
  private onEvent: SSEEventCallback;
  private onError: (err: any) => void;
  private onComplete: () => void;

  constructor(
    url: string,
    options: {
      body?: any;
      method?: string;
      headers?: Record<string, string>;
      onEvent: SSEEventCallback;
      onError: (err: any) => void;
      onComplete?: () => void;
    }
  ) {
    this.url = url;
    this.body = options.body;
    this.method = options.method || 'GET';
    this.headers = options.headers || {};
    this.onEvent = options.onEvent;
    this.onError = options.onError;
    this.onComplete = options.onComplete || (() => {});
  }

  async connect() {
    this.abortController = new AbortController();
    try {
      const mergedHeaders: Record<string, string> = { ...this.headers };
      if (this.body) {
        mergedHeaders['Content-Type'] = 'application/json';
      }

      const response = await fetch(this.url, {
        method: this.method,
        headers: mergedHeaders,
        body: this.body ? JSON.stringify(this.body) : undefined,
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const processFrame = (frame: string) => {
        if (!frame.trim()) return;

        let eventName = 'message';
        let dataStr = '';

        const lines = frame.split('\n');
        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataStr += line.slice(5).trim();
          }
        }

        if (dataStr) {
          try {
            const parsedData = JSON.parse(dataStr);
            this.onEvent(eventName, parsedData);
          } catch (err) {
            console.error('Failed to parse SSE JSON:', dataStr, err);
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // Flush the decoder's remainder + any final buffered frame that was
          // NOT terminated by a trailing blank line. The backend flushes a last
          // frame on close; without a symmetric flush here a terminal
          // `done`/`complete` frame is dropped and the UI hangs.
          buffer += decoder.decode();
          if (buffer.trim()) processFrame(buffer);
          // EOF backstop: the stream closed cleanly. On the happy path the
          // `done` frame already cleared the consumer's streaming lock; but if
          // the backend generator died mid-token AFTER the 200 headers were
          // sent, the body just ends here with no `done` frame. Fire onComplete
          // on every clean EOF so the lock is ALWAYS released. It is never
          // called on an abort (that rejects reader.read() into the catch
          // below), so a new turn's lock can't be wrongly cleared.
          this.onComplete();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split('\n\n');
        buffer = frames.pop() || '';

        for (const frame of frames) {
          processFrame(frame);
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('SSE Stream aborted manually.');
      } else {
        this.onError(error);
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
