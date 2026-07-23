type HealthResponse = {
  ok: boolean;
  json: () => Promise<unknown>;
};

type HealthFetch = (
  input: string,
  init?: RequestInit,
) => Promise<HealthResponse>;

type BackendReadinessOptions = {
  endpoint?: string;
  fetchImpl?: HealthFetch;
  maxWaitMs?: number;
  now?: () => number;
  requestTimeoutMs?: number;
  retryDelayMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
};

const DEFAULT_ENDPOINT = '/api/health';
const DEFAULT_MAX_WAIT_MS = 120_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 45_000;
const DEFAULT_RETRY_DELAY_MS = 1_500;

export class BackendUnavailableError extends Error {
  constructor() {
    super('backend_unavailable');
    this.name = 'BackendUnavailableError';
  }
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, milliseconds);
  });
}

function isReadyPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  return (payload as { status?: unknown }).status === 'ok';
}

export function createBackendReadinessGate(options: BackendReadinessOptions = {}) {
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const maxWaitMs = options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
  const now = options.now ?? Date.now;
  const requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const sleep = options.sleep ?? defaultSleep;

  let activeWait: Promise<void> | null = null;

  function probeBackend(timeoutMs = requestTimeoutMs): Promise<boolean> {
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(
      () => controller.abort(),
      Math.max(1, timeoutMs),
    );

    return Promise.resolve()
      .then(() => fetchImpl(endpoint, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      }))
      .then(async (response) => {
        if (!response.ok) return false;
        return isReadyPayload(await response.json());
      })
      .catch(() => false)
      .finally(() => {
        globalThis.clearTimeout(timeout);
      });
  }

  async function warmBackend(): Promise<void> {
    await probeBackend();
  }

  function waitUntilReady(): Promise<void> {
    if (activeWait) return activeWait;

    const startedAt = now();
    const wait = (async () => {
      while (true) {
        const elapsedBeforeProbe = Math.max(0, now() - startedAt);
        const remainingBeforeProbe = maxWaitMs - elapsedBeforeProbe;
        if (remainingBeforeProbe <= 0) throw new BackendUnavailableError();

        const ready = await probeBackend(
          Math.min(requestTimeoutMs, remainingBeforeProbe),
        );
        if (ready) return;

        const elapsedAfterProbe = Math.max(0, now() - startedAt);
        const remainingAfterProbe = maxWaitMs - elapsedAfterProbe;
        if (remainingAfterProbe <= 0) throw new BackendUnavailableError();

        await sleep(Math.min(retryDelayMs, remainingAfterProbe));
      }
    })().finally(() => {
      if (activeWait === wait) activeWait = null;
    });

    activeWait = wait;
    return wait;
  }

  return {
    waitUntilReady,
    warmBackend,
  };
}

const backendReadinessGate = createBackendReadinessGate();

export const waitForBackendReady = backendReadinessGate.waitUntilReady;
export const warmBackend = backendReadinessGate.warmBackend;
