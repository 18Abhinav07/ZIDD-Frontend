'use client';

import { useEffect, useState } from 'react';
import { LANDING_HERO_VIDEO, TOONHUB_INITIAL_AVATAR_PATH } from '@/lib/landingAssets';
import { ZiddLoaderOverlay } from './ZiddLoaderOverlay';

// The normal exit is the above-the-fold media settling. This is only a
// failsafe for a browser request that never resolves, not the standard reveal.
const MAX_WAIT_MS = 12_000;

function loadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const image = new window.Image();
    const settle = () => resolve();
    image.addEventListener('load', settle, { once: true });
    image.addEventListener('error', settle, { once: true });
    image.src = src;
    if (image.complete) settle();
  });
}

function loadVideo(src: string): Promise<void> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const settle = () => resolve();
    video.muted = true;
    video.preload = 'auto';
    video.addEventListener('canplay', settle, { once: true });
    video.addEventListener('error', settle, { once: true });
    video.src = src;
    video.load();
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) settle();
  });
}

export function LandingAssetGate() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const finish = () => {
      if (!active) return;
      setReady(true);
    };

    const timeout = window.setTimeout(finish, MAX_WAIT_MS);
    void Promise.allSettled([
      loadVideo(LANDING_HERO_VIDEO),
      loadImage(TOONHUB_INITIAL_AVATAR_PATH),
    ]).then(() => {
      window.clearTimeout(timeout);
      finish();
    });

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, []);

  if (ready) return null;

  return <ZiddLoaderOverlay />;
}
