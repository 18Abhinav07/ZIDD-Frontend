// School / subjects API client — wraps the live /school/* endpoints (NCERT
// Class 2-5 English: classes -> chapters -> levels -> chapter tests + milestone
// exams, all scored server-side).
import { apiFetch, getAuthCacheKey } from '@/services/api';
import { invalidateMeActivityCache } from '@/services/me';

const SCHOOL_CACHE_MS = 30_000;
const schoolCache = new Map<string, { value: unknown; expiresAt: number }>();
const schoolRequests = new Map<string, Promise<unknown>>();

async function cachedSchoolFetch<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const authKey = await getAuthCacheKey();
  const scopedKey = `${authKey}:${key}`;
  const now = Date.now();
  const cached = schoolCache.get(scopedKey);
  if (cached && cached.expiresAt > now) {
    return Promise.resolve(cached.value as T);
  }
  const pending = schoolRequests.get(scopedKey);
  if (pending) return pending as Promise<T>;

  const request = loader()
    .then((value) => {
      schoolCache.set(scopedKey, { value, expiresAt: Date.now() + SCHOOL_CACHE_MS });
      return value;
    })
    .finally(() => {
      schoolRequests.delete(scopedKey);
    });
  schoolRequests.set(scopedKey, request);
  return request;
}

export function invalidateSchoolCache() {
  schoolCache.clear();
  schoolRequests.clear();
}

export interface SchoolClassSummary {
  class_no: number;
  title: string;
  description: string;
  chapter_count: number;
}

export interface SchoolLevel {
  id: string;
  title: string;
}

export interface SchoolChapter {
  id: string;
  title: string;
  ncert_unit: string;
  chapter_no: number;
  genre: string | null;
  levels: SchoolLevel[];
  chapter_test_id: string | null;
}

export interface SchoolMilestone {
  id: string;
  title: string;
  at_percent: number;
}

export interface SchoolClassDetail {
  class_no: number;
  title: string;
  description: string;
  chapters: SchoolChapter[];
  milestones: SchoolMilestone[];
}

export interface TestItem {
  id: string;
  type: 'fill_blank' | 'multiple_choice';
  prompt: string;
  options: string[] | null;
  skill: string;
}

export interface ServedTest {
  id: string;
  title: string;
  kind: 'chapter' | 'milestone' | 'class_final';
  pass_mark: number;
  items: TestItem[];
}

export interface SkillScore {
  skill: string;
  correct: number;
  total: number;
  mastery: number;
}

export interface TestResult {
  test_id: string;
  title: string;
  kind: string;
  score: number;
  correct: number;
  total: number;
  passed: boolean;
  by_skill: SkillScore[];
  weak_skills: string[];
  missed_item_ids: string[];
  saved: boolean;
  degraded: boolean;
  persistence_error?: string | null;
}

export const getClasses = (): Promise<SchoolClassSummary[]> =>
  cachedSchoolFetch('classes', () => apiFetch('/school/classes'));

export const getClassDetail = (classNo: number): Promise<SchoolClassDetail> =>
  cachedSchoolFetch(`class:${classNo}`, () => apiFetch(`/school/class/${classNo}`));

export const getTest = (testId: string): Promise<ServedTest> =>
  apiFetch(`/school/test/${testId}`);

export const submitTest = (testId: string, answers: Record<string, string>): Promise<TestResult> =>
  apiFetch(`/school/test/${testId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ answers }),
  }).then((result) => {
    invalidateSchoolCache();
    invalidateMeActivityCache();
    return result;
  });

export const getDueMilestone = (
  classNo: number,
  chaptersDone: number,
  fired: number[],
): Promise<{ due: SchoolMilestone | null }> =>
  apiFetch(`/school/class/${classNo}/milestone?chapters_done=${chaptersDone}&fired=${fired.join(',')}`);

// ---- durable server-side progress ----
// The graded /school/test submit now persists each result and folds per-skill
// ratios into a bidirectional mastery EMA. /school/progress reads it back, so a
// learner's record survives a cache clear and the live tutor targets real gaps.

export interface ServerSkillMastery {
  skill: string;
  mastery: number;   // 0-1 EMA, rises on success
  attempts: number;
}

export interface ServerResultRow {
  test_id: string;
  class_no: number;
  kind: string;
  score: number;
  passed: boolean;
  weak_skills: string[];
}

export interface SchoolProgressResponse {
  class_no: number | null;
  results: ServerResultRow[];
  passed_tests: string[];        // test ids (chapter tests + milestones) passed
  lesson_progress: Record<string, 'learn' | 'in_progress' | 'completed' | 'reattempting'>;
  skill_mastery: ServerSkillMastery[];
  weak_skills: string[];         // current weak skills, weakest-first
  overall: number;               // 0-1 average across taken assessments
}

export const getServerProgress = (classNo: number): Promise<SchoolProgressResponse> =>
  cachedSchoolFetch(`progress:${classNo}`, () => apiFetch(`/school/progress?class_no=${classNo}`));

// ---- progress shape the UI renders ----
// Sourced from the server. Browser storage is intentionally not used for product
// progress so clearing site data cannot change completion history.

export interface ClassProgress {
  passedChapters: string[];   // chapter ids whose test was passed
  lessonProgress: Record<string, 'learn' | 'in_progress' | 'completed' | 'reattempting'>;
  testScores: Record<string, number>;   // testId -> score (0-1)
  firedMilestones: number[];  // milestone at_percent values already taken
}

// Map a server progress payload onto the UI's ClassProgress shape. Needs the
// class detail to translate passed chapter-TEST ids into chapter ids.
export function serverToProgress(
  detail: SchoolClassDetail,
  server: SchoolProgressResponse,
): ClassProgress {
  const passed = new Set(server.passed_tests);
  const passedChapters = detail.chapters
    .filter((ch) => ch.chapter_test_id && passed.has(ch.chapter_test_id))
    .map((ch) => ch.id);
  const testScores: Record<string, number> = {};
  const firedMilestones: number[] = [];
  for (const r of server.results) {
    testScores[r.test_id] = r.score;
    if (r.kind === 'milestone') {
      const pct = Number(r.test_id.split('_').pop());
      if (Number.isFinite(pct) && !firedMilestones.includes(pct)) firedMilestones.push(pct);
    }
  }
  return { passedChapters, lessonProgress: server.lesson_progress || {}, testScores, firedMilestones };
}

// Turn a raw skill tag (new_words, asking_questions) into readable copy.
export const humanizeSkill = (s: string): string => s.replace(/_/g, ' ');

export function getProgress(classNo: number): ClassProgress {
  void classNo;
  return { passedChapters: [], lessonProgress: {}, testScores: {}, firedMilestones: [] };
}

export function cacheProgress(classNo: number, p: ClassProgress): void {
  void classNo;
  void p;
}

export function recordResult(classNo: number, result: TestResult, chapterId?: string): void {
  void classNo;
  void result;
  void chapterId;
}
