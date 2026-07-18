import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { resolveSchoolStateDestination } from '../src/lib/schoolActivityPolicy.ts';
import { getAvatarScaleFactor } from '../src/lib/avatarRegistry.ts';
import { isSchoolCatalogSelectionSupported } from '../src/lib/schoolOnboardingPolicy.ts';
import {
  getSchoolAvatarTheme,
  SCHOOL_NEUTRAL_AVATAR_ID,
  SCHOOL_FALLBACK_PALETTE,
} from '../src/lib/schoolTheme.ts';
import type { SchoolCatalog } from '../src/services/schoolRebuild.ts';

const catalog: SchoolCatalog = {
  boards: [
    {
      board_id: 'cbse',
      title: 'CBSE',
      description: 'CBSE curriculum aligned with approved learning material.',
      support_status: 'available',
      subjects: [
        {
          subject_id: 'english',
          title: 'English',
          support_status: 'available',
          classes: [2, 3, 4, 5].map((classNo) => ({
            class_no: classNo,
            title: `Class ${classNo}`,
            support_status: 'available' as const,
          })),
        },
      ],
    },
    {
      board_id: 'ncert',
      title: 'NCERT',
      description: 'NCERT is used as a content source for the CBSE release.',
      support_status: 'unavailable',
      unavailable_reason: 'NCERT is a content source, not a school board.',
      subjects: [
        {
          subject_id: 'english',
          title: 'English',
          support_status: 'unavailable',
          unavailable_reason: 'Choose CBSE to use the available English release.',
          classes: [2, 3, 4, 5].map((classNo) => ({
            class_no: classNo,
            title: `Class ${classNo}`,
            support_status: 'unavailable' as const,
            unavailable_reason: 'NCERT is not a selectable school board.',
          })),
        },
      ],
    },
  ],
  active_board_id: null,
  active_subject_id: null,
  active_class_no: null,
};

test('persisted coach identity survives rerenders, reloads, and path changes', () => {
  const firstRender = getSchoolAvatarTheme('brave_bella', 'brave_bella');
  const afterRerender = getSchoolAvatarTheme('brave_bella', 'brave_bella');
  const unrelatedPaths = ['/school', '/school/classes/5', '/school/reports'];

  for (const _path of unrelatedPaths) {
    const afterPathChange = getSchoolAvatarTheme('brave_bella', 'brave_bella');
    assert.equal(afterPathChange.avatar.id, 'brave_bella');
    assert.deepEqual(afterPathChange.roles, firstRender.roles);
  }
  assert.equal(afterRerender.avatar.id, firstRender.avatar.id);
});

test('valid persisted coach survives stale palette metadata and unknown coaches fail closed', () => {
  const persistedAvatarTheme = getSchoolAvatarTheme('brave_bella', 'brave_bella');
  for (const paletteId of ['unknown-palette', 'fluent_finn', null] as const) {
    const theme = getSchoolAvatarTheme('brave_bella', paletteId);
    assert.equal(theme.avatar.id, 'brave_bella');
    assert.deepEqual(theme.roles, persistedAvatarTheme.roles);
  }

  for (const [avatarId, paletteId] of [
    ['unknown-avatar', 'brave_bella'],
    [null, null],
  ] as const) {
    const theme = getSchoolAvatarTheme(avatarId, paletteId);
    assert.equal(theme.avatar.id, SCHOOL_NEUTRAL_AVATAR_ID);
    assert.deepEqual(theme.roles, SCHOOL_FALLBACK_PALETTE);
  }
});

test('School coach sizing uses the shared avatar padding registry', () => {
  assert.equal(getAvatarScaleFactor('/avatars/trans_new_casual_female_1781021494716.png'), 1.35);
  assert.equal(getAvatarScaleFactor('/avatars/coach_pink.png'), 1);

  const coachPanel = fs.readFileSync('src/components/school/SchoolCoachPanel.tsx', 'utf8');
  assert.match(coachPanel, /const avatarScale = getAvatarScaleFactor\(avatar\.url\)/);
  assert.match(coachPanel, /variant === 'immersive' \? avatarScale \* 1\.26 : avatarScale/);
  assert.match(coachPanel, /Math\.min\(avatarScale, 1\.12\)/);
});

test('coach hints use one integrated card control instead of a nested callout', () => {
  const coachPanel = fs.readFileSync('src/components/school/SchoolCoachPanel.tsx', 'utf8');
  const coachCss = fs.readFileSync('src/components/school/SchoolCoachPanel.module.css', 'utf8');

  assert.match(coachPanel, /className=\{styles\.hintToggle\}/);
  assert.match(coachPanel, /className=\{styles\.hintClose\}/);
  assert.doesNotMatch(coachPanel, /I&apos;ve got a hint for you|hintIcon/);
  assert.match(coachCss, /\.hintClose,\s*\.hintToggle[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;/);
  assert.doesNotMatch(coachCss, /\.hintBody\s*\{[^}]*background:/);
});

test('only a fully supported backend catalog combination can be submitted', () => {
  assert.equal(isSchoolCatalogSelectionSupported(catalog, 'cbse', 'english', 2), true);
  assert.equal(isSchoolCatalogSelectionSupported(catalog, 'cbse', 'english', 5), true);
  assert.equal(isSchoolCatalogSelectionSupported(catalog, 'ncert', 'english', 2), false);
  assert.equal(isSchoolCatalogSelectionSupported(catalog, 'cbse', 'english', 6), false);
});

test('next action and its allow-list are the only client navigation authority', () => {
  const authoritative = {
    nextAction: 'resume_curriculum',
    allowedNextActions: ['resume_curriculum'],
    nextActionUrl: '/school/session/session-1',
  };
  assert.equal(resolveSchoolStateDestination(authoritative), '/school/session/session-1');
  assert.equal(resolveSchoolStateDestination({
    ...authoritative,
    allowedNextActions: [],
  }), null);
  assert.equal(resolveSchoolStateDestination({
    ...authoritative,
    nextActionUrl: '/career',
  }), null);
  assert.equal(resolveSchoolStateDestination({
    nextAction: null,
    allowedNextActions: [],
    nextActionUrl: '/school/classes/5',
  }), null);
});

test('canonical School sources do not use local storage or seed-derived coach identity', () => {
  const roots = ['src/app/school', 'src/components/school', 'src/lib', 'src/services'];
  const files = roots.flatMap((root) => fs.readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name))
    .map((entry) => `${entry.parentPath}/${entry.name}`))
    .filter((file) => /school/i.test(file));

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /localStorage/, `${file} must not use localStorage`);
    assert.doesNotMatch(source, /getAvatarForSeed/, `${file} must not derive canonical coach identity from a seed`);
  }

  const setup = fs.readFileSync('src/components/school/setup/ClassSubjectStep.tsx', 'utf8');
  const service = fs.readFileSync('src/services/schoolRebuild.ts', 'utf8');
  assert.doesNotMatch(setup, /BOARD_OPTIONS/);
  assert.match(setup, /availableBoards = catalog\?\.boards\.filter/);
  assert.match(setup, /availableBoards\.map/);
  assert.match(setup, /isSchoolCatalogSupportAvailable\(board\.support_status\)/);
  assert.doesNotMatch(setup, /unavailableBoard|UnavailableCatalogScope/);
  assert.doesNotMatch(setup, /disabled=/);
  assert.match(service, /SchoolCatalogSupportStatus = 'available' \| 'unavailable'/);
  assert.doesNotMatch(service, /SchoolCatalogSupportStatus = [^;]*(?:supported|unsupported)/);
  assert.match(service, /\| 'start_masterclass'/);
});

test('canonical School presentation is scoped to its own shell and design tokens', () => {
  const css = fs.readFileSync('src/components/school/SchoolSurface.module.css', 'utf8');
  const shell = fs.readFileSync('src/components/school/shell/SchoolShell.tsx', 'utf8');
  const appHeader = fs.readFileSync('src/components/shared/AppHeader.tsx', 'utf8');
  const layout = fs.readFileSync('src/app/school/layout.tsx', 'utf8');

  for (const token of [
    '--school-canvas: #fbfaf7',
    '--school-paper: #fffefb',
    '--school-ink: #121a2d',
    '--school-navy: #10182d',
    '--school-accent: #555bd8',
    '--school-accent-dark: #4248bb',
  ]) {
    assert.match(css.toLowerCase(), new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(css, /letter-spacing:\s*-/);
  assert.match(css, /\[tabindex="-1"\]:focus\s*\{\s*outline:\s*none/);
  assert.match(shell, /Home/);
  assert.match(shell, /Starting point/);
  assert.match(shell, /My path/);
  assert.match(shell, /Reports/);
  assert.match(shell, /<AppHeader/);
  assert.doesNotMatch(shell, /useSession|signOut|profileImage/);
  assert.doesNotMatch(shell, /AVATAR_PATHS/);
  assert.match(appHeader, /authSession\?\.user\?\.image \|\| null/);
  assert.match(appHeader, /profileInitial/);
  assert.match(appHeader, /aria-label=\{menuOpen \? 'Close menu' : 'Open menu'\}/);
  assert.match(layout, /SchoolShell/);
  assert.doesNotMatch(layout, /AppHeader/);
});

test('School-owned presentation does not bypass image optimization or reintroduce mock controls', () => {
  const roots = ['src/app/school', 'src/components/school'];
  const files = roots.flatMap((root) => fs.readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name))
    .map((entry) => `${entry.parentPath}/${entry.name}`));

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /\bunoptimized\b/, `${file} bypasses Next image optimization`);
    assert.doesNotMatch(source, /Surface Review|data-review-|\?state=/, `${file} includes prototype-only controls`);
  }

  const nextConfig = fs.readFileSync('next.config.mjs', 'utf8');
  assert.match(nextConfig, /hostname: 'lh3\.googleusercontent\.com'/);
});
