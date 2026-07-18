import fs from 'node:fs';
import {
  SCHOOL_STAGE_ORDER,
  buildSchoolLevelStages,
} from '../src/components/school/catalog/schoolLevelStages.mjs';

const read = (path) => fs.readFileSync(path, 'utf8');
const failures = [];

const requiredFiles = [
  'src/app/school/layout.tsx',
  'src/app/school/page.tsx',
  'src/app/school/onboarding/page.tsx',
  'src/app/school/placement/page.tsx',
  'src/app/school/recap/page.tsx',
  'src/app/school/classes/[classNo]/page.tsx',
  'src/app/school/classes/[classNo]/chapters/[chapterId]/page.tsx',
  'src/app/school/masterclass/[sessionId]/page.tsx',
  'src/components/learning/JourneyMap.tsx',
  'src/components/learning/LearningWorkspace.tsx',
  'src/components/learning/LearningSkeletons.tsx',
  'src/components/school/catalog/SchoolChapterMap.tsx',
  'src/components/school/catalog/SchoolLevelMap.tsx',
  'src/components/school/setup/ClassSubjectStep.tsx',
  'src/services/schoolRebuild.ts',
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) failures.push(`missing ${file}`);
}

if (failures.length === 0) {
  const schoolHome = read('src/app/school/page.tsx');
  const classPage = read('src/app/school/classes/[classNo]/page.tsx');
  const chapterPage = read('src/app/school/classes/[classNo]/chapters/[chapterId]/page.tsx');
  const chapterMap = read('src/components/school/catalog/SchoolChapterMap.tsx');
  const levelMap = read('src/components/school/catalog/SchoolLevelMap.tsx');
  const setup = read('src/components/school/setup/ClassSubjectStep.tsx');
  const onboarding = read('src/components/school/onboarding/SchoolOnboardingWizard.tsx');
  const service = read('src/services/schoolRebuild.ts');
  const css = read('src/app/globals.css');

  for (const staleCopy of ['Meet your coach', 'Readiness adventure', 'Build your bridge', '<SchoolJourneyMap']) {
    if (schoolHome.includes(staleCopy)) failures.push(`/school still exposes lifecycle UI: ${staleCopy}`);
  }
  for (const token of ['getSchoolState', 'resolveSchoolStateDestination', 'router.replace(destination)', '<SchoolClassHomeSkeleton']) {
    if (!schoolHome.includes(token)) failures.push(`/school resolver missing ${token}`);
  }
  if (schoolHome.includes('Loader2')) failures.push('/school resolver must use a skeleton, not a spinner');

  for (const [file, source, component, loader, skeleton] of [
    ['class page', classPage, '<SchoolChapterMap', 'getSchoolClassMap', '<SchoolMapSkeleton'],
    ['chapter page', chapterPage, '<SchoolLevelMap', 'getSchoolChapterMap', '<SchoolLevelMapSkeleton'],
  ]) {
    if (source.includes("redirect('/school/curriculum')")) failures.push(`${file} is still a redirect`);
    if (!source.includes(component)) failures.push(`${file} missing ${component}`);
    if (!source.includes(loader)) failures.push(`${file} missing ${loader}`);
    if (!source.includes(skeleton)) failures.push(`${file} missing map skeleton`);
    if (source.includes('Loader2')) failures.push(`${file} must not use a spinner loader`);
  }

  for (const token of ["chapter.status !== 'locked'", 'completed_levels', 'total_levels', 'Change class or subject']) {
    if (!chapterMap.includes(token)) failures.push(`chapter map contract missing ${token}`);
  }
  for (const label of ['Discover', 'Practise Together', 'Try It Yourself', 'Use It Somewhere New', 'Chapter Challenge']) {
    if (!levelMap.includes(label)) failures.push(`level map missing learner stage ${label}`);
  }
  const renderedStageFixture = buildSchoolLevelStages(
    [
      { level_id: 'discover', learner_stage: 'Discover', title: 'Meet the idea', status: 'complete' },
      { level_id: 'practise-1', learner_stage: 'Practise Together', title: 'Guided practice one', status: 'complete' },
      { level_id: 'practise-2', learner_stage: 'Practise Together', title: 'Guided practice two', status: 'active' },
      { level_id: 'independent', learner_stage: 'Try It Yourself', title: 'Independent practice', status: 'locked' },
      { level_id: 'transfer', learner_stage: 'Use It Somewhere New', title: 'Fresh situation', status: 'locked' },
    ],
    { title: 'Chapter check', status: 'locked' },
    'surface-guard-chapter',
  );
  const expectedStageLabels = [...SCHOOL_STAGE_ORDER, 'Chapter Challenge'];
  if (renderedStageFixture.length !== 5) failures.push(`level map stage builder returned ${renderedStageFixture.length} nodes instead of 5`);
  if (renderedStageFixture.map((stage) => stage.label).join('|') !== expectedStageLabels.join('|')) {
    failures.push('level map stage builder returned the wrong stage order');
  }
  if (renderedStageFixture[1]?.authoredLevelIds.length !== 2) {
    failures.push('level map stage builder dropped a grouped authored level');
  }
  if (!levelMap.includes('buildSchoolLevelStages(chapter.levels, chapter.chapter_check, chapter.chapter_id)')) {
    failures.push('level map does not render from the guarded five-stage builder');
  }
  for (const hidden of ['guided_check', 'transfer_check', 'certification', 'EMA']) {
    if (levelMap.includes(hidden)) failures.push(`level map exposes engine term ${hidden}`);
  }

  for (const token of [
    'getSchoolCatalog',
    'catalog?.boards.filter',
    'availableBoards.map',
    'selectedBoard.subjects.filter',
    'selectedSubject.classes',
    'isSchoolCatalogSupportAvailable',
    'CatalogChoiceSkeleton',
  ]) {
    if (!`${setup}\n${onboarding}`.includes(token)) failures.push(`backend-driven setup missing ${token}`);
  }
  if (setup.includes('coming soon') || setup.includes('Coming soon')) {
    failures.push('setup renders unsupported coming-soon choices');
  }

  for (const token of [
    "schoolReadFetch('/school/catalog')",
    'getSchoolClassMap',
    'getSchoolChapterMap',
    'chapter_id: chapterId',
    'client_start_id: clientStartId',
  ]) {
    if (!service.includes(token)) failures.push(`school catalog client missing ${token}`);
  }

  const schoolLayout = read('src/app/school/layout.tsx');
  for (const token of [
    'getSchoolStateResponse',
    'state.available === false',
    'School learning is not available in this release',
    "router.push('/career?view=career')",
  ]) {
    if (!schoolLayout.includes(token)) failures.push(`School route guard missing ${token}`);
  }

  for (const token of ['schoolReadFetch', 'schoolControlFetch', 'schoolEvaluatorFetch']) {
    if (!service.includes(token)) failures.push(`School request policy missing ${token}`);
  }

  if (css.includes('oklch(0.985 0.008 88)')) failures.push('School still uses the rejected yellow canvas');
}

for (const legacyRoute of [
  'src/app/subjects/page.tsx',
  'src/app/subjects/v2/page.tsx',
  'src/app/subjects/v3/page.tsx',
  'src/app/subjects/class/[classNo]/page.tsx',
  'src/app/subjects/test/[testId]/page.tsx',
]) {
  if (!fs.existsSync(legacyRoute)) continue;
  const source = read(legacyRoute);
  if (!source.includes("redirect('/school')") || source.includes('"use client"')) {
    failures.push(`legacy learner route is not a small /school redirect: ${legacyRoute}`);
  }
}

if (failures.length) {
  throw new Error(`School hierarchy contract failed:\n- ${failures.join('\n- ')}`);
}

console.log('School hierarchy contract passed.');
