import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(path, 'utf8');

const schoolHome = read('src/app/school/page.tsx');
const classPage = read('src/app/school/classes/[classNo]/page.tsx');
const chapterPage = read('src/app/school/classes/[classNo]/chapters/[chapterId]/page.tsx');
const profilePage = read('src/app/profile/page.tsx');

test('school home resolves into real learning instead of replaying setup history', () => {
  for (const lifecycleCopy of [
    'Meet your coach',
    'Readiness adventure',
    'Build your bridge',
    '<SchoolJourneyMap',
  ]) {
    assert.equal(
      schoolHome.includes(lifecycleCopy),
      false,
      `/school still exposes lifecycle UI: ${lifecycleCopy}`,
    );
  }
  assert.match(schoolHome, /resolveSchoolStateDestination/);
  assert.match(schoolHome, /getSchoolClassMap/);
  assert.match(schoolHome, /SchoolClassHome/);
  assert.match(schoolHome, /nextAction: state\.next_action/);
  const curriculumResolver = read('src/app/school/curriculum/page.tsx');
  assert.match(curriculumResolver, /resolveSchoolStateDestination/);
  assert.match(curriculumResolver, /router\.replace\(destination\)/);
  assert.doesNotMatch(curriculumResolver, /state\.active_flow|state\.active_session_id/);
});

test('class and chapter routes are real backend-driven surfaces', () => {
  assert.equal(classPage.includes("redirect('/school/curriculum')"), false);
  assert.equal(chapterPage.includes("redirect('/school/curriculum')"), false);
  assert.match(classPage, /SchoolChapterMap/);
  assert.match(chapterPage, /SchoolLevelMap/);
});

test('primary school navigation pages use skeletons instead of spinner loaders', () => {
  for (const [route, source] of [
    ['/school', schoolHome],
    ['/school/classes/[classNo]', classPage],
    ['/school/classes/[classNo]/chapters/[chapterId]', chapterPage],
  ]) {
    assert.equal(source.includes('Loader2'), false, `${route} uses a spinner loader`);
  }
});

test('school catalog routes use shared error actions and Radix icons', () => {
  for (const [route, source] of [
    ['/school', schoolHome],
    ['/school/classes/[classNo]', classPage],
    ['/school/classes/[classNo]/chapters/[chapterId]', chapterPage],
  ]) {
    assert.match(source, /schoolPrimaryActionClass/, `${route} misses the shared primary action`);
    assert.match(source, /@radix-ui\/react-icons/, `${route} misses Radix icons`);
    assert.doesNotMatch(source, /lucide-react|font-black|gradient|(?:rose|sky|cyan)-/i);
  }
});

test('School profile recommendations cannot fall back to Career actions', () => {
  assert.match(profilePage, /const fallbackRecommendation/);
  assert.match(profilePage, /primaryMotive === 'school'[\s\S]*?'Continue School Prep'/);
  assert.match(profilePage, /primaryMotive === 'school' \? '\/school' : '\/career'/);
  assert.doesNotMatch(profilePage, /allRecommendations\.slice\(0, 1\)/);
});
