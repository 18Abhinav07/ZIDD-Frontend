// School / subjects API client — wraps the live /school/* endpoints (NCERT
// Class 2-5 English: classes -> chapters -> levels -> chapter tests + milestone
// exams, all scored server-side).
import { apiFetch } from '@/services/api';

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
}

export const getClasses = (): Promise<SchoolClassSummary[]> => apiFetch('/school/classes');

export const getClassDetail = (classNo: number): Promise<SchoolClassDetail> =>
  apiFetch(`/school/class/${classNo}`);

export const getTest = (testId: string): Promise<ServedTest> =>
  apiFetch(`/school/test/${testId}`);

export const submitTest = (testId: string, answers: Record<string, string>): Promise<TestResult> =>
  apiFetch(`/school/test/${testId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ answers }),
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
  skill_mastery: ServerSkillMastery[];
  weak_skills: string[];         // current weak skills, weakest-first
  overall: number;               // 0-1 average across taken assessments
}

export const getServerProgress = (classNo: number): Promise<SchoolProgressResponse> =>
  apiFetch(`/school/progress?class_no=${classNo}`);

// ---- progress shape the UI renders ----
// Sourced from the server when available (durable), with a localStorage cache
// for instant first paint + offline fallback.

export interface ClassProgress {
  passedChapters: string[];   // chapter ids whose test was passed
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
  return { passedChapters, testScores, firedMilestones };
}

// Turn a raw skill tag (new_words, asking_questions) into readable copy.
export const humanizeSkill = (s: string): string => s.replace(/_/g, ' ');

const _key = (classNo: number) => `zidd_school_progress_c${classNo}`;

export function getProgress(classNo: number): ClassProgress {
  if (typeof window === 'undefined') return { passedChapters: [], testScores: {}, firedMilestones: [] };
  try {
    const raw = localStorage.getItem(_key(classNo));
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { passedChapters: [], testScores: {}, firedMilestones: [] };
}

// Warm the localStorage cache with the authoritative server progress, so the
// next first paint (and offline) reflects the durable record.
export function cacheProgress(classNo: number, p: ClassProgress): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(_key(classNo), JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function recordResult(classNo: number, result: TestResult, chapterId?: string): void {
  if (typeof window === 'undefined') return;
  const p = getProgress(classNo);
  p.testScores[result.test_id] = result.score;
  if (result.kind === 'chapter' && chapterId && result.passed && !p.passedChapters.includes(chapterId)) {
    p.passedChapters.push(chapterId);
  }
  if (result.kind === 'milestone') {
    const pct = Number(result.test_id.split('_').pop());
    if (Number.isFinite(pct) && !p.firedMilestones.includes(pct)) p.firedMilestones.push(pct);
  }
  try {
    localStorage.setItem(_key(classNo), JSON.stringify(p));
  } catch {
    /* ignore */
  }
}
