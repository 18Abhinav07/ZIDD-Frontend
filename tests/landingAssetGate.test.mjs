import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Render landing avoids the Next image optimizer for Toonhub avatars', () => {
  const config = read('next.config.mjs');
  const toonHub = read('src/components/shared/ToonHub.tsx');
  const assets = read('src/lib/landingAssets.ts');

  assert.match(config, /unoptimized:\s*true/);
  assert.match(toonHub, /\bunoptimized\b/);
  assert.match(toonHub, /getToonHubAvatarPath/);
  assert.match(assets, /\/avatars\/toonhub\/coach_pink\.png/);

  for (const file of [
    'public/avatars/toonhub/coach_pink.png',
    'public/avatars/toonhub/coach_orange.png',
    'public/avatars/toonhub/coach_green.png',
    'public/avatars/toonhub/coach_blue.png',
  ]) {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} should be a committed landing asset`);
  }
});

test('landing blocks only until its critical media settles or the timeout expires', () => {
  const page = read('src/app/page.tsx');
  const loader = read('src/components/shared/LandingAssetGate.tsx');
  const assets = read('src/lib/landingAssets.ts');

  assert.match(page, /LandingAssetGate/);
  assert.match(assets, /Zidd-hero\.mp4/);
  assert.match(loader, /TOONHUB_AVATAR_PATHS/);
  assert.match(loader, /setTimeout/);
  assert.match(loader, /30_000/);
  assert.match(loader, /reveal0/);
  assert.doesNotMatch(loader, /(?:localStorage|sessionStorage)/);
});
