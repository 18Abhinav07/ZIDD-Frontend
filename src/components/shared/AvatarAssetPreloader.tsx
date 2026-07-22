"use client";

import { useEffect } from "react";
import { preloadAvatarDisplayAssets } from "@/lib/avatarRegistry";

type IdleCapableWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export function AvatarAssetPreloader() {
  useEffect(() => {
    const browser = window as IdleCapableWindow;
    const warmAvatarCache = () => preloadAvatarDisplayAssets();

    if (browser.requestIdleCallback) {
      const idleHandle = browser.requestIdleCallback(warmAvatarCache, { timeout: 1_500 });
      return () => browser.cancelIdleCallback?.(idleHandle);
    }

    const timeout = window.setTimeout(warmAvatarCache, 300);
    return () => window.clearTimeout(timeout);
  }, []);

  return null;
}
