import assert from 'node:assert/strict';
import test from 'node:test';

import { COACH_AVATARS } from '../src/lib/avatars.ts';
import {
  getSchoolAvatarPalette,
  getSchoolAvatarTheme,
  getSchoolAvatarThemeForAvatar,
  SCHOOL_AVATAR_PALETTES,
  SCHOOL_CANONICAL_PALETTE,
  SCHOOL_FALLBACK_PALETTE,
  type SchoolThemeVariable,
} from '../src/lib/schoolTheme.ts';

test('School avatar theme helper exists', () => {
  assert.equal(typeof getSchoolAvatarTheme, 'function');
});

test('theme selection is deterministic for persisted identity', () => {
  const first = getSchoolAvatarTheme('brave_bella', 'brave_bella');
  const second = getSchoolAvatarTheme('brave_bella', 'brave_bella');

  assert.equal(first.avatar.id, second.avatar.id);
  assert.deepEqual(first.roles, second.roles);
  assert.deepEqual(first.style, second.style);
});

test('every coach avatar keeps its identity without recoloring the canonical interface', () => {
  assert.deepEqual(
    Object.keys(SCHOOL_AVATAR_PALETTES).sort(),
    COACH_AVATARS.map((avatar) => avatar.id).sort(),
  );

  for (const avatar of COACH_AVATARS) {
    const theme = getSchoolAvatarThemeForAvatar(avatar);
    assert.equal(theme.avatar.id, avatar.id);
    assert.deepEqual(theme.roles, SCHOOL_CANONICAL_PALETTE);
    assert.notEqual(theme.roles.accent, avatar.bg, `${avatar.id} must not expose its raw avatar color as UI accent`);
  }
});

test('theme output contains only supported readable roles and CSS variables', () => {
  const expectedVariableKeys: SchoolThemeVariable[] = [
    '--school-accent',
    '--school-accent-border',
    '--school-accent-deep',
    '--school-accent-soft',
    '--school-on-accent',
  ];

  for (const avatar of COACH_AVATARS) {
    const theme = getSchoolAvatarThemeForAvatar(avatar);
    assert.deepEqual(Object.keys(theme.style).sort(), expectedVariableKeys);
    for (const value of Object.values(theme.roles) as string[]) {
      assert.match(value, /^#[0-9A-F]{6}$/);
    }
    const styleValues = expectedVariableKeys.map((key) => theme.style[key]);
    assert.deepEqual(styleValues.sort(), (Object.values(theme.roles) as string[]).sort());
  }

  assert.deepEqual(getSchoolAvatarPalette('unsupported-at-runtime'), SCHOOL_FALLBACK_PALETTE);
  assert.deepEqual(SCHOOL_FALLBACK_PALETTE, SCHOOL_CANONICAL_PALETTE);
});
