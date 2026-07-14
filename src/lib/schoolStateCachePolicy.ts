interface SchoolStateCacheEntry<T> {
  authKey: string;
  generation: number;
  value: T;
  expiresAt: number;
}

interface SchoolStateRequest<T> {
  authKey: string;
  force: boolean;
  load: () => Promise<T>;
  now?: number;
}

export interface SchoolLoadScope {
  readonly authKey: string;
  readonly generation: number;
  readonly key: string;
}

export class SchoolStateRequestCache<T> {
  private generation = 0;
  private cached: SchoolStateCacheEntry<T> | null = null;
  private readonly inFlight = new Map<string, Promise<T>>();
  private readonly ttlMs: number;

  constructor(ttlMs: number) {
    this.ttlMs = ttlMs;
  }

  invalidate() {
    this.generation += 1;
    this.cached = null;
  }

  loadScope(authKey: string): SchoolLoadScope {
    return Object.freeze({
      authKey,
      generation: this.generation,
      key: `${authKey}:school-generation:${this.generation}`,
    });
  }

  get({ authKey, force, load, now = Date.now() }: SchoolStateRequest<T>): Promise<T> {
    const scope = this.loadScope(authKey);
    const generation = scope.generation;
    if (
      !force
      && this.cached
      && this.cached.generation === generation
      && this.cached.authKey === authKey
      && this.cached.expiresAt > now
    ) {
      return Promise.resolve(this.cached.value);
    }

    const requestKey = scope.key;
    const existing = this.inFlight.get(requestKey);
    if (existing) return existing;

    const pending = load()
      .then((value) => {
        if (this.generation === generation) {
          this.cached = {
            authKey,
            generation,
            value,
            expiresAt: Date.now() + this.ttlMs,
          };
        }
        return value;
      })
      .finally(() => {
        if (this.inFlight.get(requestKey) === pending) {
          this.inFlight.delete(requestKey);
        }
      });
    this.inFlight.set(requestKey, pending);
    return pending;
  }
}
