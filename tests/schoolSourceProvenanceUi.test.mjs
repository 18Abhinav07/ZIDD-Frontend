import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const service = readFileSync('src/services/schoolRebuild.ts', 'utf8');
const renderer = readFileSync('src/components/school/tutor/SchoolActivityRenderer.tsx', 'utf8');

test('School activity source provenance stays metadata-only and only exposes verified NCERT anchors', () => {
  assert.match(service, /export interface SchoolSourceReferenceAnchor\b/);
  assert.match(service, /section_label\??: string \| null;/);
  assert.match(service, /page_start\??: number \| null;/);
  assert.match(service, /page_end\??: number \| null;/);
  assert.match(service, /source_url\??: string \| null;/);
  assert.match(service, /export interface SchoolSourceReference\b/);
  assert.match(service, /book_title\??: string \| null;/);
  assert.match(service, /chapter_title\??: string \| null;/);
  assert.match(service, /anchors\??: SchoolSourceReferenceAnchor\[\] \| null;/);
  assert.equal((service.match(/source_reference\??: SchoolSourceReference \| null;/g) ?? []).length, 2);

  assert.match(renderer, /activity\.source_reference/);
  assert.match(renderer, /new URL\(sourceUrl\)/);
  assert.match(renderer, /url\.protocol === 'https:'/);
  assert.match(renderer, /url\.hostname === 'ncert\.nic\.in'/);
  assert.match(renderer, /sourceReference\?\.anchors\?\.length/);
  assert.match(renderer, /<details/);
  assert.match(renderer, /target="_blank"/);
  assert.match(renderer, /rel="noopener noreferrer"/);
  assert.match(renderer, />Book</);
  assert.match(renderer, />Chapter</);
  assert.match(renderer, /book_title/);
  assert.match(renderer, /chapter_title/);
  assert.match(renderer, /section_label/);
  assert.match(renderer, /page_start/);
  assert.match(renderer, /page_end/);
  assert.doesNotMatch(renderer, /anchor_id|coverage_treatment|teaching_block/);
});
