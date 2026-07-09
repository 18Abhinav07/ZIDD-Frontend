import { apiFetch, getAuthCacheKey } from '@/services/api';
import type { ModuleId } from '@/services/me';
import type { ProgressNode } from '@/components/shared/PathMap';

const PROGRESSION_CACHE_MS = 5_000;
const progressionCache = new Map<string, { value: ProgressNode[]; expiresAt: number }>();
const progressionRequests = new Map<string, Promise<ProgressNode[]>>();

function progressionCacheKey(authKey: string, moduleId: ModuleId): string {
  return `${authKey}:module:${moduleId}`;
}

export function invalidateProgressionCache(moduleId?: ModuleId) {
  if (moduleId) {
    for (const key of Array.from(progressionCache.keys())) {
      if (key.endsWith(`:module:${moduleId}`)) progressionCache.delete(key);
    }
    for (const key of Array.from(progressionRequests.keys())) {
      if (key.endsWith(`:module:${moduleId}`)) progressionRequests.delete(key);
    }
    return;
  }
  progressionCache.clear();
  progressionRequests.clear();
}

export async function getProgressionMap(
  moduleId: ModuleId,
  options: { force?: boolean } = {},
): Promise<ProgressNode[]> {
  const authKey = await getAuthCacheKey();
  const cacheKey = progressionCacheKey(authKey, moduleId);
  const now = Date.now();
  const cached = progressionCache.get(cacheKey);
  if (!options.force && cached && cached.expiresAt > now) {
    return Promise.resolve(cached.value);
  }

  if (!options.force) {
    const pending = progressionRequests.get(cacheKey);
    if (pending) return pending;
  }

  const request = apiFetch(`/session/progress/me?module_id=${moduleId}`)
    .then((nodes: ProgressNode[]) => {
      progressionCache.set(cacheKey, { value: nodes, expiresAt: Date.now() + PROGRESSION_CACHE_MS });
      return nodes;
    })
    .finally(() => {
      progressionRequests.delete(cacheKey);
    });
  progressionRequests.set(cacheKey, request);
  return request;
}
