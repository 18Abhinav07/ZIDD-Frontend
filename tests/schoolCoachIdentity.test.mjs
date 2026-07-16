import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const contextUrl = new URL(
  '../src/components/school/shell/SchoolCoachIdentityContext.ts',
  import.meta.url,
);
const contextPath = fileURLToPath(contextUrl);

test('null coach props inherit the persisted shell pair without weakening explicit identity validation', async () => {
  assert.equal(fs.existsSync(contextPath), true, 'School coach identity context must exist');

  const { resolveSchoolCoachIdentity } = await import(contextUrl.href);
  const persisted = {
    coach_avatar_id: 'brave_bella',
    coach_palette_id: 'brave_bella',
  };

  assert.deepEqual(
    resolveSchoolCoachIdentity({ avatarId: null, paletteId: null }, persisted),
    { avatarId: 'brave_bella', paletteId: 'brave_bella' },
  );
  assert.deepEqual(
    resolveSchoolCoachIdentity(
      { avatarId: 'fluent_finn', paletteId: 'fluent_finn' },
      persisted,
    ),
    { avatarId: 'fluent_finn', paletteId: 'fluent_finn' },
  );
  assert.deepEqual(
    resolveSchoolCoachIdentity({ avatarId: 'fluent_finn', paletteId: null }, persisted),
    { avatarId: 'fluent_finn', paletteId: null },
  );
});
