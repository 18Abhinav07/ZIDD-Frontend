import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const helperPath = 'src/components/school/catalog/schoolPathMap.mjs';
const stylesPath = 'src/components/school/catalog/SchoolPathMap.module.css';

test('path-map helper deterministically maps backend ids to local avatar assets', async () => {
  assert.equal(fs.existsSync(helperPath), true, 'school path-map helper is missing');
  const helper = await import(pathToFileURL(`${process.cwd()}/${helperPath}`).href);

  const first = helper.getSchoolPathAvatar('chapter:papa-spectacles');
  const repeated = helper.getSchoolPathAvatar('chapter:papa-spectacles');
  const samples = Array.from({ length: 8 }, (_, index) => helper.getSchoolPathAvatar(`chapter:${index}`));

  assert.equal(first, repeated);
  assert.match(first, /^\/avatars\/.*\.png$/);
  assert.ok(new Set(samples).size >= 3, 'decorative path avatars should visibly vary by stable id');
  assert.doesNotMatch(fs.readFileSync(helperPath, 'utf8'), /Math\.random/);
});

test('path-map helper produces stable winding geometry for arbitrary backend counts', async () => {
  assert.equal(fs.existsSync(helperPath), true, 'school path-map helper is missing');
  const helper = await import(pathToFileURL(`${process.cwd()}/${helperPath}`).href);

  const chapterMetrics = helper.schoolPathMetrics(6, 'chapters');
  const levelMetrics = helper.schoolPathMetrics(5, 'levels');
  const firstPath = helper.buildSchoolWindingPath(6, 'chapters');

  assert.ok(chapterMetrics.desktopHeight > chapterMetrics.mobileHeight);
  assert.ok(levelMetrics.desktopHeight > 0);
  assert.equal(firstPath, helper.buildSchoolWindingPath(6, 'chapters'));
  assert.notEqual(firstPath, helper.buildSchoolWindingPath(5, 'chapters'));
  assert.match(firstPath, /^M\s/);
  assert.match(firstPath, /\sC\s/);
  assert.doesNotMatch(firstPath, /NaN|Infinity/);
});

test('catalog-local map styles preserve canonical variables and responsive bounds', () => {
  assert.equal(fs.existsSync(stylesPath), true, 'school path-map styles are missing');
  const styles = fs.readFileSync(stylesPath, 'utf8');

  for (const variable of [
    '--school-canvas',
    '--school-paper',
    '--school-line',
    '--school-accent',
    '--school-green',
    '--school-orange',
  ]) {
    assert.match(styles, new RegExp(variable));
  }
  assert.match(styles, /@media \(max-width: 780px\)/);
  assert.match(styles, /@media \(max-width: 420px\)/);
  assert.match(styles, /--school-path-map-height-mobile/);
  assert.match(styles, /overflow-x:\s*(?:clip|hidden)/);
  assert.doesNotMatch(styles, /linear-gradient|radial-gradient|letter-spacing:\s*-/i);
});
