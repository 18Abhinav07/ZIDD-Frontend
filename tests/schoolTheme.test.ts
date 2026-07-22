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

function hexToLuminance(hex: string) {
  const channels = hex.slice(1).match(/.{2}/g)?.map((channel) => Number.parseInt(channel, 16) / 255);
  assert.ok(channels && channels.length === 3, `expected a six-digit hex color, got ${hex}`);
  const [red, green, blue] = channels.map((channel) => (
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}

function contrastRatio(first: string, second: string) {
  const [lighter, darker] = [hexToLuminance(first), hexToLuminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

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

test('every coach avatar keeps one accessible School control palette', () => {
  assert.deepEqual(
    Object.keys(SCHOOL_AVATAR_PALETTES).sort(),
    COACH_AVATARS.map((avatar) => avatar.id).sort(),
  );

  const accents = new Set<string>();
  for (const avatar of COACH_AVATARS) {
    const theme = getSchoolAvatarThemeForAvatar(avatar);
    assert.equal(theme.avatar.id, avatar.id);
    assert.deepEqual(theme.roles, SCHOOL_CANONICAL_PALETTE);
    assert.notEqual(theme.roles.accent, avatar.bg, `${avatar.id} must not expose its raw avatar color as UI accent`);
    accents.add(theme.roles.accent);
    assert.ok(
      contrastRatio(theme.roles.accent, theme.roles.onAccent) >= 4.5,
      `${avatar.id} accent must keep readable action text`,
    );
  }
  assert.equal(accents.size, 1);
});

test('theme output contains only supported readable roles and CSS variables', () => {
  const expectedVariableKeys: SchoolThemeVariable[] = [
    '--school-accent',
    '--school-accent-border',
    '--school-accent-deep',
    '--school-accent-soft',
    '--school-coach-surface',
    '--school-on-accent',
  ];

  for (const avatar of COACH_AVATARS) {
    const theme = getSchoolAvatarThemeForAvatar(avatar);
    assert.deepEqual(Object.keys(theme.style).sort(), expectedVariableKeys);
    for (const value of Object.values(theme.roles) as string[]) {
      assert.match(value, /^#[0-9A-F]{6}$/);
    }
    const styleValues = expectedVariableKeys.map((key) => theme.style[key]);
    for (const role of Object.values(theme.roles) as string[]) {
      assert.ok(styleValues.includes(role));
    }
    assert.equal(theme.style['--school-coach-surface'], avatar.bg);
  }

  assert.deepEqual(getSchoolAvatarPalette('unsupported-at-runtime'), SCHOOL_FALLBACK_PALETTE);
});

test('a mismatched flow palette is derived from the persisted avatar', () => {
  const persistedAvatarTheme = getSchoolAvatarTheme('quiet_quint', 'quiet_quint');
  const mismatchedFlowTheme = getSchoolAvatarTheme('quiet_quint', 'tech_black');

  assert.deepEqual(mismatchedFlowTheme.roles, persistedAvatarTheme.roles);
});
