import type { SchoolLoadScope } from './schoolStateCachePolicy.ts';

export interface SchoolRouteLoadSingleFlight<T> {
  run(operation: () => Promise<T>, key?: string): Promise<T>;
}

export interface SchoolRouteLoadOwner {
  requestId: number;
  scopeKey: string;
}

export function schoolRouteLoadKey(scope: SchoolLoadScope, routeKey: string): string {
  return `${scope.key}:route:${routeKey}`;
}

export function createSchoolRouteLoadSingleFlight<T>(): SchoolRouteLoadSingleFlight<T> {
  const inFlight = new Map<string, Promise<T>>();
  return {
    run(operation, key = 'default') {
      const existing = inFlight.get(key);
      if (existing) return existing;
      const pending = operation().finally(() => {
        if (inFlight.get(key) === pending) inFlight.delete(key);
      });
      inFlight.set(key, pending);
      return pending;
    },
  };
}

export function isSchoolRouteLoadCurrent(
  currentOwner: SchoolRouteLoadOwner | null,
  requestOwner: SchoolRouteLoadOwner,
  mounted: boolean,
  currentScope: SchoolLoadScope,
): boolean {
  return mounted
    && currentOwner?.requestId === requestOwner.requestId
    && currentOwner.scopeKey === requestOwner.scopeKey
    && currentScope.key === requestOwner.scopeKey;
}

export function schoolRouteLoadDisposition(
  currentOwner: SchoolRouteLoadOwner | null,
  requestOwner: SchoolRouteLoadOwner,
  mounted: boolean,
  currentScope: SchoolLoadScope,
): 'commit' | 'retry' | 'ignore' {
  if (!mounted || currentOwner?.requestId !== requestOwner.requestId) return 'ignore';
  if (currentOwner.scopeKey !== requestOwner.scopeKey) return 'ignore';
  return currentScope.key === requestOwner.scopeKey ? 'commit' : 'retry';
}
