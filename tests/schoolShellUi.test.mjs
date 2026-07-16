import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const shell = fs.readFileSync('src/components/school/shell/SchoolShell.tsx', 'utf8');
const surface = fs.readFileSync('src/components/school/SchoolSurface.module.css', 'utf8');
const coachPanel = fs.readFileSync('src/components/school/SchoolCoachPanel.tsx', 'utf8');

test('desktop School header exposes an accessible low-noise sign-out command', () => {
  assert.match(
    shell,
    /className=\{styles\.signOutButton\}[\s\S]*?aria-label="Sign out"[\s\S]*?signOut\(\{ callbackUrl: '\/auth\/login' \}\)/,
  );
  assert.match(shell, /<LogOut[^>]*aria-hidden="true"/);
  assert.match(
    surface,
    /\.signOutButton\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/,
  );
  assert.match(
    surface,
    /@media \(max-width: 860px\)[\s\S]*?\.signOutButton[\s\S]*?display: none/,
  );
});

test('compact mobile header retains School Prep identity and the persisted coach control', () => {
  assert.match(shell, /className=\{styles\.productName\}>School Prep<\/span>/);
  assert.match(
    shell,
    /className=\{styles\.profileButton\}[\s\S]*?src=\{coach\.url\}/,
  );
  assert.match(
    surface,
    /@media \(max-width: 860px\)[\s\S]*?\.nav,\s*\.signOutButton\s*\{\s*display: none/,
  );
  assert.doesNotMatch(
    surface,
    /@media \(max-width: 560px\)[\s\S]*?\.productName,\s*\.brandDivider\s*\{\s*display: none/,
  );
  assert.match(
    surface,
    /@media \(max-width: 560px\)[\s\S]*?\.productName\s*\{[^}]*font-size:/,
  );
});

test('School coach fallbacks inherit shell identity without another state request', () => {
  assert.match(shell, /SchoolShellCoachIdentityContext\.Provider/);
  assert.match(coachPanel, /useSchoolShellCoachIdentity\(\)/);
  assert.match(coachPanel, /resolveSchoolCoachIdentity/);
  assert.doesNotMatch(`${shell}\n${coachPanel}`, /getSchoolState(?:Response)?|apiFetch|schoolReadFetch/);
});

test('mobile School menu retains its sign-out command without prototype controls', () => {
  assert.match(
    shell,
    /id="school-mobile-menu"[\s\S]*?<span>Sign out<\/span>[\s\S]*?<LogOut/,
  );
  assert.doesNotMatch(shell, /Surface Review|data-review-|\?state=/);
});

test('nested School pages inherit the canonical shell palette instead of the legacy mode override', () => {
  assert.match(
    surface,
    /\.content > :global\(\.mode-school\)\s*\{[^}]*--school-canvas:\s*inherit[^}]*--school-accent:\s*inherit/s,
  );
});
