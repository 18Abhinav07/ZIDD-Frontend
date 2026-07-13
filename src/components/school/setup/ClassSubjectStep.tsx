"use client";

import type { ReactNode } from 'react';
import { ExclamationTriangleIcon, ReloadIcon } from '@radix-ui/react-icons';
import { schoolSecondaryActionClass } from '@/components/school/SchoolPrimitives';
import { isSchoolCatalogSupportAvailable } from '@/lib/schoolOnboardingPolicy';
import type { SchoolCatalog } from '@/services/schoolRebuild';

interface ClassSubjectStepProps {
  boardId: string | null;
  targetClassNo: number | null;
  subjectIds: string[];
  catalog: SchoolCatalog | null;
  loading: boolean;
  error: string;
  boardError: ReactNode;
  classError: ReactNode;
  subjectError: ReactNode;
  onBoardChange: (boardId: string) => void;
  onSubjectChange: (subjectId: string, classes: number[]) => void;
  onClassChange: (classNo: number) => void;
  onRetry: () => void;
}

export function ClassSubjectStep({
  boardId,
  targetClassNo,
  subjectIds,
  catalog,
  loading,
  error,
  boardError,
  classError,
  subjectError,
  onBoardChange,
  onSubjectChange,
  onClassChange,
  onRetry,
}: ClassSubjectStepProps) {
  const selectedSubjectId = subjectIds.length === 1 ? subjectIds[0] : null;
  const selectedBoard = catalog?.boards.find((board) => board.board_id === boardId);
  const selectedSubject = selectedBoard?.subjects.find(
    (subject) => subject.subject_id === selectedSubjectId,
  );

  if (loading) return <CatalogChoiceSkeleton />;
  if (error || !catalog) {
    return (
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-red-950">
        <div className="flex items-start gap-3">
          <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-6">{error || 'Curriculum choices are unavailable.'}</p>
            <button type="button" onClick={onRetry} className={`${schoolSecondaryActionClass} mt-3`}>
              <ReloadIcon className="h-4 w-4" aria-hidden="true" />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <fieldset>
        <legend className="text-sm font-semibold text-slate-800">Curriculum</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {catalog.boards.map((board) => {
            const supported = isSchoolCatalogSupportAvailable(board.support_status);
            return (
              <RadioCard
                key={board.board_id}
                name="board_id"
                value={board.board_id}
                checked={boardId === board.board_id}
                label={board.title}
                detail={supported ? board.description : board.unavailable_reason}
                disabled={!supported}
                onChange={() => onBoardChange(board.board_id)}
              />
            );
          })}
        </div>
        {catalog.boards
          .filter((board) => !isSchoolCatalogSupportAvailable(board.support_status))
          .map((unavailableBoard) => (
            <UnavailableCatalogScope
              key={unavailableBoard.board_id}
              unavailableBoard={unavailableBoard}
            />
          ))}
        {boardError}
      </fieldset>

      {selectedBoard && (
        <>
          <fieldset>
            <legend className="text-sm font-semibold text-slate-800">Subject</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {selectedBoard.subjects.map((subject) => {
                const supportedClasses = subject.classes
                  .filter((schoolClass) => isSchoolCatalogSupportAvailable(schoolClass.support_status))
                  .map((schoolClass) => schoolClass.class_no);
                const supported = isSchoolCatalogSupportAvailable(subject.support_status) && supportedClasses.length > 0;
                return (
                  <RadioCard
                    key={subject.subject_id}
                    name="subject_id"
                    value={subject.subject_id}
                    checked={selectedSubjectId === subject.subject_id}
                    label={subject.title}
                    detail={supported
                      ? `${supportedClasses.length} ${supportedClasses.length === 1 ? 'class' : 'classes'} available`
                      : subject.unavailable_reason}
                    disabled={!supported}
                    onChange={() => onSubjectChange(subject.subject_id, supportedClasses)}
                  />
                );
              })}
            </div>
            {subjectError}
          </fieldset>

          {selectedSubject && (
            <fieldset>
              <legend className="text-sm font-semibold text-slate-800">Target class</legend>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {selectedSubject.classes.map((schoolClass) => (
                  <RadioCard
                    key={schoolClass.class_no}
                    name="target_class_no"
                    value={String(schoolClass.class_no)}
                    checked={targetClassNo === schoolClass.class_no}
                    label={schoolClass.title}
                    detail={schoolClass.unavailable_reason}
                    compact
                    disabled={!isSchoolCatalogSupportAvailable(schoolClass.support_status)}
                    onChange={() => onClassChange(schoolClass.class_no)}
                  />
                ))}
              </div>
              {classError}
            </fieldset>
          )}
        </>
      )}
    </div>
  );
}

function UnavailableCatalogScope({
  unavailableBoard,
}: {
  unavailableBoard: SchoolCatalog['boards'][number];
}) {
  return (
    <section
      className="mt-4 border-y border-slate-200 py-4"
      aria-label={`${unavailableBoard.title} unavailable subject and class choices`}
    >
      <p className="text-xs font-semibold uppercase text-slate-500">
        {unavailableBoard.title} subject and class availability
      </p>
      <div className="mt-3 divide-y divide-slate-200">
        {unavailableBoard.subjects.map((subject) => (
          <div key={subject.subject_id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:items-start">
            <div>
              <p className="text-sm font-semibold text-slate-700">{subject.title}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">Unavailable</p>
              {subject.unavailable_reason ? (
                <p className="mt-1 text-xs leading-5 text-slate-500">{subject.unavailable_reason}</p>
              ) : null}
            </div>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-500 sm:grid-cols-4">
              {subject.classes.map((schoolClass) => (
                <li key={schoolClass.class_no}>
                  <span className="block font-semibold text-slate-700">{schoolClass.title}</span>
                  <span className="mt-0.5 block">Unavailable</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function CatalogChoiceSkeleton() {
  return (
    <div
      data-school-catalog-skeleton
      role="status"
      aria-label="Loading approved class and subject choices"
      className="space-y-7"
    >
      <div>
        <div className="h-5 w-20 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }, (_, index) => (
            <div key={index} className="h-[4.5rem] animate-pulse rounded-xl border border-slate-200 bg-slate-100 motion-reduce:animate-none" />
          ))}
        </div>
      </div>
      <div>
        <div className="h-5 w-24 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-xl border border-slate-200 bg-slate-100 motion-reduce:animate-none" />
          ))}
        </div>
      </div>
    </div>
  );
}

function RadioCard({
  name,
  value,
  checked,
  label,
  detail,
  compact = false,
  disabled = false,
  onChange,
}: {
  name: string;
  value: string;
  checked: boolean;
  label: string;
  detail?: string;
  compact?: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <label className={`block min-w-0 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="peer sr-only"
      />
      <span className={`block rounded-xl border border-slate-300 bg-[var(--school-surface,#fcfdff)] px-4 text-left text-slate-700 transition-[background-color,border-color,color,box-shadow] hover:border-[var(--school-accent-border)] peer-checked:border-[var(--school-accent)] peer-checked:bg-[var(--school-accent-soft)] peer-checked:text-slate-950 peer-checked:ring-1 peer-checked:ring-[var(--school-accent)] peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--school-accent)] peer-focus-visible:ring-offset-2 peer-disabled:border-slate-200 peer-disabled:bg-slate-50 peer-disabled:text-slate-400 ${
        compact ? 'flex h-16 items-center text-sm font-semibold' : 'min-h-[4.5rem] py-3'
      }`}>
        <span className="block break-words text-sm font-semibold">{label}</span>
        {disabled && <span className="mt-1 block text-xs font-semibold text-slate-500">Unavailable</span>}
        {detail && <span className="mt-1 block break-words text-sm leading-5 text-slate-600">{detail}</span>}
      </span>
    </label>
  );
}
