import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const masterclass = readFileSync('src/app/school/masterclass/[sessionId]/page.tsx', 'utf8');
const supportActivity = readFileSync('src/components/school/support/SchoolSupportActivity.tsx', 'utf8');
const service = readFileSync('src/services/schoolRebuild.ts', 'utf8');

function officialNcertSourceUrlFromSupportActivity() {
  const match = supportActivity.match(/function officialNcertSourceUrl\([\s\S]*?\n}\n\nfunction sourceAnchorLabel/);
  assert.ok(match, 'support activity must define the official NCERT URL policy');
  const functionSource = match[0].replace(/\n\nfunction sourceAnchorLabel$/, '');
  const compiled = ts.transpileModule(
    `${functionSource}\nmodule.exports = { officialNcertSourceUrl };`,
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', compiled)(module, module.exports);
  return module.exports.officialNcertSourceUrl;
}

test('masterclass source details are sanitized to official NCERT learner metadata', () => {
  assert.match(masterclass, /sourceReference=\{activity\.source_reference\}/);
  assert.match(supportActivity, /sourceReference\?: SchoolSourceReference \| null;/);
  assert.match(supportActivity, /new URL\(sourceUrl\)/);
  assert.match(supportActivity, /url\.protocol === 'https:'/);
  assert.match(supportActivity, /url\.hostname === 'ncert\.nic\.in'/);
  assert.match(supportActivity, /url\.username === ''/);
  assert.match(supportActivity, /url\.password === ''/);
  assert.match(supportActivity, /url\.port === ''/);
  assert.match(supportActivity, /sourceReference\?\.anchors\?\.length/);
  assert.match(supportActivity, /<details/);
  assert.match(supportActivity, /target="_blank"/);
  assert.match(supportActivity, /rel="noopener noreferrer"/);
  assert.match(supportActivity, />Book</);
  assert.match(supportActivity, />Chapter</);
  assert.match(supportActivity, /section_label/);
  assert.match(supportActivity, /page_start/);
  assert.match(supportActivity, /page_end/);

  assert.doesNotMatch(supportActivity, /anchor_id|coverage_treatment|accepted_answers|answer_key|model_answer|rubric/);
  assert.doesNotMatch(masterclass, /anchor_id|coverage_treatment|accepted_answers|answer_key|model_answer|rubric/);
});

test('masterclass UI rejects credential-bearing and non-default-port NCERT links', () => {
  const officialNcertSourceUrl = officialNcertSourceUrlFromSupportActivity();

  assert.equal(
    officialNcertSourceUrl('https://ncert.nic.in/textbook.php?eeng101=0-10'),
    'https://ncert.nic.in/textbook.php?eeng101=0-10',
  );
  assert.equal(
    officialNcertSourceUrl('https://learner:secret@ncert.nic.in/textbook.php'),
    null,
  );
  assert.equal(
    officialNcertSourceUrl('https://ncert.nic.in:444/textbook.php'),
    null,
  );
});

test('masterclass API type includes returned phase progress fields', () => {
  assert.match(service, /remediation_phase: string;/);
  assert.match(service, /completed_phases: number;/);
  assert.match(service, /total_phases: number;/);
  assert.match(service, /phase_index: number;/);
  assert.match(service, /phase_count: number;/);
});
