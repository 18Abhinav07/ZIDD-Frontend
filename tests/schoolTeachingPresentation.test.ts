import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveSchoolCoachPresentation,
  selectVisibleSchoolCoachFeedback,
} from '../src/lib/schoolTeachingPresentation.ts';

const base = {
  status: 'Practise together',
  fallbackMessage: 'Use the sentence clues.',
  activityKey: 'activity-1',
  teachingBlock: 'Read the words around the difficult phrase.',
};

test('optional teaching guidance becomes one reopenable coach hint', () => {
  const result = resolveSchoolCoachPresentation(base);

  assert.equal(result.message, base.fallbackMessage);
  assert.equal(result.hint?.text, base.teachingBlock);
  assert.match(result.hint?.key ?? '', /^activity-1:/);
});

test('pending, transitions, and errors replace optional hints', () => {
  const cases = [
    { pendingMessage: 'I am reviewing your answer.', expected: 'I am reviewing your answer.', tone: 'pending' },
    { transitionMessage: 'Your place is saved.', expected: 'Your place is saved.', tone: 'neutral' },
    { error: 'The lesson could not refresh.', expected: 'The lesson could not refresh.', tone: 'error' },
  ] as const;

  for (const entry of cases) {
    const result = resolveSchoolCoachPresentation({ ...base, ...entry });
    assert.equal(result.message, entry.expected);
    assert.equal(result.tone, entry.tone);
    assert.equal(result.hint, null);
  }
});

test('same-activity feedback keeps the current authored hint', () => {
  const result = resolveSchoolCoachPresentation({
    ...base,
    feedback: 'You found the right clue.',
  });

  assert.equal(result.message, 'You found the right clue.');
  assert.equal(result.hint?.text, base.teachingBlock);
});

test('hidden and stale feedback never reaches the coach dialogue', () => {
  const current = 'activity-2';
  const feedback = { activity_id: current, message: 'Correct.', result_visible: true };

  assert.equal(selectVisibleSchoolCoachFeedback(current, feedback), feedback);
  assert.equal(selectVisibleSchoolCoachFeedback(current, { ...feedback, result_visible: false }), null);
  assert.equal(selectVisibleSchoolCoachFeedback(current, { ...feedback, activity_id: 'activity-1' }), null);
  assert.equal(selectVisibleSchoolCoachFeedback(null, feedback), null);
  assert.equal(selectVisibleSchoolCoachFeedback(undefined, feedback), null);
});

test('a learning surface can keep previous scored feedback visible after advancing', () => {
  const feedback = {
    activity_id: 'activity-1',
    message: 'You used the curtain clue to support your inference.',
    result_visible: true,
  };

  assert.equal(
    selectVisibleSchoolCoachFeedback('activity-2', feedback, { includePrevious: true }),
    feedback,
  );
  assert.equal(
    selectVisibleSchoolCoachFeedback(
      'activity-2',
      { ...feedback, result_visible: false },
      { includePrevious: true },
    ),
    null,
  );
});

test('empty backend copy falls back to learner-safe coach language', () => {
  const result = resolveSchoolCoachPresentation({ status: '', fallbackMessage: '' });

  assert.equal(result.status, 'Your coach');
  assert.equal(result.message, 'Take this one step at a time.');
});
