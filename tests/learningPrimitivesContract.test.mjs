import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';

const journeyMap = read('src/components/learning/JourneyMap.tsx');
const learningWorkspace = read('src/components/learning/LearningWorkspace.tsx');
const schoolJourneyMap = read('src/components/school/SchoolJourneyMap.tsx');
const schoolLearningShell = read('src/components/school/SchoolLearningShell.tsx');
const schoolCoachPanel = read('src/components/school/SchoolCoachPanel.tsx');
const schoolTutorWorkspace = read('src/components/school/tutor/SchoolTutorWorkspace.tsx');
const schoolSkeletons = read('src/components/learning/LearningSkeletons.tsx');
const schoolPrimitives = read('src/components/school/SchoolPrimitives.tsx');

test('JourneyMap exposes a neutral five-state learning progression contract', () => {
  assert.match(journeyMap, /export type JourneyNodeStatus/);
  for (const status of ['complete', 'active', 'ready', 'support', 'locked']) {
    assert.match(journeyMap, new RegExp(`'${status}'`));
  }
  assert.match(journeyMap, /export interface JourneyNode\b/);
  assert.match(journeyMap, /export interface JourneyMapLabels\b/);
  assert.match(journeyMap, /statusLabels: Record<JourneyNodeStatus, string>/);
  assert.match(journeyMap, /export interface JourneyMapProps\b/);
  assert.match(journeyMap, /export function JourneyMap/);

  assert.doesNotMatch(journeyMap, /\b(?:setup|placement|recap)\b/i);
});

test('compact School coach uses portrait framing instead of full-body scale compensation', () => {
  assert.match(schoolCoachPanel, /compact[\s\S]*?object-cover object-top/);
});

test('JourneyMap keeps status, motion, and action semantics accessible', () => {
  assert.match(journeyMap, /useReducedMotion/);
  assert.match(journeyMap, /aria-current=/);
  assert.match(journeyMap, /aria-label=/);
  assert.match(journeyMap, /data-status=/);
  assert.match(journeyMap, /disabled={!actionable}/);
  assert.match(journeyMap, /rounded-lg/);
  assert.doesNotMatch(journeyMap, /rounded-(?:xl|2xl|3xl)/);
  assert.doesNotMatch(journeyMap, /gradient/i);
});

test('LearningWorkspace exposes stable coach, activity, and progress regions', () => {
  assert.match(learningWorkspace, /export interface LearningWorkspaceProps\b/);
  for (const prop of ['coach', 'compactCoach', 'children', 'progress']) {
    assert.match(learningWorkspace, new RegExp(`\\b${prop}\\??:`));
  }
  assert.match(learningWorkspace, /export function LearningWorkspace/);
  assert.match(learningWorkspace, /useReducedMotion/);
  assert.match(learningWorkspace, /aria-label={coachLabel}/);
  assert.match(learningWorkspace, /aria-label={progressLabel}/);
  assert.match(learningWorkspace, /lg:grid-cols-\[380px_minmax\(0,1fr\)\]/);
  assert.match(learningWorkspace, /xl:grid-cols-\[380px_minmax\(0,1fr\)_280px\]/);
  const progressRegionClasses = learningWorkspace.match(
    /className="([^"]*lg:col-span-2[^"]*)"\s+aria-label={progressLabel}/,
  )?.[1] ?? '';
  assert.match(progressRegionClasses, /\blg:col-span-2\b/);
  assert.match(progressRegionClasses, /\bxl:col-span-1\b/);
  assert.match(learningWorkspace, /rounded-\[2\.5rem\]/);
  assert.match(learningWorkspace, /themeStyle\?:/);
  assert.match(learningWorkspace, /style={themeStyle}/);
  assert.match(learningWorkspace, /min-h-\[100dvh\]/);
  assert.match(learningWorkspace, /@radix-ui\/react-icons/);
  assert.doesNotMatch(learningWorkspace, /lucide-react|font-black|(?:sky|rose)-/);
  assert.doesNotMatch(learningWorkspace, /gradient/i);
});

test('School components remain compatibility adapters over shared primitives', () => {
  assert.match(schoolJourneyMap, /from '@\/components\/learning\/JourneyMap'/);
  assert.match(schoolJourneyMap, /<JourneyMap/);
  assert.match(schoolJourneyMap, /testId="school-journey-map"/);
  for (const prop of ['nodes', 'startLabel', 'destinationTitle', 'destinationLabel', 'compact']) {
    assert.match(schoolJourneyMap, new RegExp(`\\b${prop}\\??:`));
  }

  assert.match(schoolLearningShell, /from '@\/components\/learning\/LearningWorkspace'/);
  assert.match(schoolLearningShell, /getSchoolAvatarTheme/);
  assert.match(schoolLearningShell, /<LearningWorkspace/);
  assert.match(schoolLearningShell, /themeStyle={theme\.style}/);
  assert.match(schoolLearningShell, /variant="immersive"/);
  assert.match(schoolTutorWorkspace, /getSchoolAvatarTheme\(session\.session_id\)/);
  assert.match(schoolTutorWorkspace, /themeStyle={theme\.style}/);
  for (const prop of [
    'title',
    'eyebrow',
    'coachStatus',
    'coachNote',
    'avatarSeed',
    'onBack',
    'children',
    'progress',
    'headerMeta',
  ]) {
    assert.match(schoolLearningShell, new RegExp(`\\b${prop}\\??:`));
  }
});

test('School coach variants keep immersive art bounded and reports compact', () => {
  assert.match(schoolCoachPanel, /'immersive' \| 'supporting'/);
  assert.match(schoolCoachPanel, /getSchoolAvatarTheme/);
  assert.match(schoolCoachPanel, /variant === 'immersive'/);
  assert.match(schoolCoachPanel, /object-cover object-top/);
  assert.match(schoolCoachPanel, /<motion\.div/);
  assert.doesNotMatch(schoolCoachPanel, /<\/?motion\.aside/);
  assert.doesNotMatch(schoolCoachPanel, /font-ghost|COACH|avatar\.bg|lucide-react|backdrop-blur/);
});

test('School skeletons mirror route-specific linear layouts without spinners', () => {
  for (const name of [
    'SchoolClassHomeSkeleton',
    'SchoolMapSkeleton',
    'SchoolLevelMapSkeleton',
    'SchoolTutorSkeleton',
    'SchoolReportSkeleton',
  ]) {
    assert.match(schoolSkeletons, new RegExp(`export function ${name}`));
  }
  assert.match(schoolSkeletons, /380px_minmax\(0,1fr\)_280px/);
  assert.doesNotMatch(schoolSkeletons, /Loader|spinner|md:grid-cols-3/);
});

test('School primitives centralize headings, actions, status, and native disclosures', () => {
  for (const primitive of [
    'SchoolPageHeading',
    'schoolPrimaryActionClass',
    'schoolSecondaryActionClass',
    'SchoolStatusChip',
    'SchoolDisclosure',
  ]) {
    assert.match(schoolPrimitives, new RegExp(`export (?:const|function) ${primitive}`));
  }
  assert.match(schoolPrimitives, /font-display/);
  assert.match(schoolPrimitives, /min-h-11/);
  assert.match(schoolPrimitives, /<details/);
  assert.match(schoolPrimitives, /<summary/);
  assert.match(schoolPrimitives, /@radix-ui\/react-icons/);
  assert.doesNotMatch(schoolPrimitives, /lucide-react|gradient|font-black|border-l-[2-9]|(?:sky|emerald|amber)-/);
});
