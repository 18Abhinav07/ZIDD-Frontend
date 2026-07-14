import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { resolveSchoolStateDestination } from '../src/lib/schoolActivityPolicy.ts';
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

test('invalid or mismatched persisted identity fails closed to one neutral coach', () => {
  for (const [avatarId, paletteId] of [
    ['unknown-avatar', 'brave_bella'],
    ['brave_bella', 'unknown-palette'],
    ['brave_bella', 'fluent_finn'],
    [null, null],
  ] as const) {
    const theme = getSchoolAvatarTheme(avatarId, paletteId);
    assert.equal(theme.avatar.id, SCHOOL_NEUTRAL_AVATAR_ID);
    assert.deepEqual(theme.roles, SCHOOL_FALLBACK_PALETTE);
  }
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
  assert.match(setup, /catalog\.boards\.map/);
  assert.match(setup, /disabled=/);
  assert.match(setup, /Unavailable/);
  assert.match(setup, /UnavailableCatalogScope/);
  assert.match(setup, /unavailableBoard\.subjects\.map/);
  assert.match(setup, /subject\.classes\.map/);
  assert.match(service, /SchoolCatalogSupportStatus = 'available' \| 'unavailable'/);
  assert.doesNotMatch(service, /SchoolCatalogSupportStatus = [^;]*(?:supported|unsupported)/);
  assert.match(service, /\| 'start_masterclass'/);
});
