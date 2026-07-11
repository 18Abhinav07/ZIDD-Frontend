"use client";

interface EndSessionConfirmModalProps {
  open: boolean;
  type: 'gd' | 'interview';
  round: number;
  maxRounds: number;
  scorableTurns: number;
  minScorableTurns: number;
  isClosing?: boolean;
  showCancel?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function EndSessionConfirmModal({
  open,
  type,
  round,
  maxRounds,
  scorableTurns,
  minScorableTurns,
  isClosing = false,
  showCancel = true,
  onCancel,
  onConfirm,
}: EndSessionConfirmModalProps) {
  if (!open) return null;

  const hasEnoughEvidence = scorableTurns >= minScorableTurns;
  const testName = type === 'gd' ? 'group discussion' : 'interview';
  const reportCopy = hasEnoughEvidence
    ? 'A scored report should be available after ending. It may still include caveats if the simulator had repeated or invalid prompts.'
    : 'You can end now, but the report will likely be marked insufficient evidence until more score-eligible answers are completed.';

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/45 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${type}-end-session-title`}
    >
      <div className="w-full max-w-md rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-5">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
            End {testName} test
          </p>
          <h2 id={`${type}-end-session-title`} className="mt-2 text-xl font-black tracking-tight text-slate-950">
            End and generate the report?
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            You are at round {Math.min(Math.max(round, 1), maxRounds)}/{maxRounds}. You have {scorableTurns}/{minScorableTurns} score-eligible answers needed for a reliable final score.
          </p>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm font-bold text-slate-900">
            {hasEnoughEvidence ? 'Report available' : 'Insufficient evidence risk'}
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-600">{reportCopy}</p>
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {showCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isClosing}
              className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue Test
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            disabled={isClosing}
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
          >
            {isClosing ? 'Generating Report...' : hasEnoughEvidence ? 'End & Score' : 'End Anyway'}
          </button>
        </div>
      </div>
    </div>
  );
}
