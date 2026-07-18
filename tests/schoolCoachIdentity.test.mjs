import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const contextUrl = new URL(
  '../src/components/school/shell/SchoolCoachIdentityContext.ts',
  import.meta.url,
);
const contextPath = fileURLToPath(contextUrl);

test('a valid persisted shell identity wins over conflicting flow identities', async () => {
  assert.equal(fs.existsSync(contextPath), true, 'School coach identity context must exist');

  const { resolveSchoolCoachIdentity } = await import(contextUrl.href);
  const persisted = {
    coach_avatar_id: 'quiet_quint',
    coach_palette_id: 'quiet_quint',
  };

  for (const [surface, flowIdentity] of [
    ['placement', { avatarId: 'tech_black', paletteId: 'tech_black' }],
    ['recap', { avatarId: 'brave_bella', paletteId: 'brave_bella' }],
    ['masterclass', { avatarId: 'fluent_finn', paletteId: 'fluent_finn' }],
  ]) {
    assert.deepEqual(
      resolveSchoolCoachIdentity(flowIdentity, persisted),
      { avatarId: 'quiet_quint', paletteId: 'quiet_quint' },
      `${surface} must retain the persisted learner coach`,
    );
  }
});

test('flow identity is used only when no valid shell identity exists', async () => {
  const { resolveSchoolCoachIdentity } = await import(contextUrl.href);
  const flowIdentity = { avatarId: 'brave_bella', paletteId: 'brave_bella' };

  assert.deepEqual(resolveSchoolCoachIdentity(flowIdentity, null), flowIdentity);
  assert.deepEqual(
    resolveSchoolCoachIdentity(flowIdentity, {
      coach_avatar_id: null,
      coach_palette_id: null,
    }),
    flowIdentity,
    'the shell has no persisted identity before onboarding chooses a coach',
  );
  assert.deepEqual(
    resolveSchoolCoachIdentity(flowIdentity, {
      coach_avatar_id: 'unknown-avatar',
      coach_palette_id: 'unknown-avatar',
    }),
    { avatarId: 'tech_black', paletteId: 'tech_black' },
    'an invalid persisted identity must fail closed',
  );
});

test('a malformed persisted identity fails closed instead of borrowing a flow coach', async () => {
  const { resolveSchoolCoachIdentity } = await import(contextUrl.href);

  assert.deepEqual(
    resolveSchoolCoachIdentity(
      { avatarId: 'brave_bella', paletteId: 'brave_bella' },
      {
        coach_avatar_id: 'quiet_quint',
        coach_palette_id: 'tech_black',
      },
    ),
    { avatarId: 'tech_black', paletteId: 'tech_black' },
    'a stale persisted palette must not replace the learner coach with a local flow coach',
  );

  assert.deepEqual(
    resolveSchoolCoachIdentity(
      { avatarId: 'brave_bella', paletteId: 'brave_bella' },
      { coach_avatar_id: '', coach_palette_id: '' },
    ),
    { avatarId: 'tech_black', paletteId: 'tech_black' },
    'blank persisted fields are malformed identity, not onboarding state',
  );
});
