import type { ReactNode, Ref } from 'react';
import { ChevronDownIcon } from '@radix-ui/react-icons';

export const schoolPrimaryActionClass = [
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-transparent',
  'bg-[var(--school-accent-deep)] px-5 py-2.5 text-sm font-semibold text-[var(--school-on-accent)]',
  'transition-[transform,background-color,opacity] duration-200 hover:bg-[var(--school-accent)]',
  'active:translate-y-px focus-visible:outline-none focus-visible:ring-2',
  'focus-visible:ring-[var(--school-accent)] focus-visible:ring-offset-2',
  'disabled:cursor-not-allowed disabled:opacity-55',
].join(' ');

export const schoolSecondaryActionClass = [
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300',
  'bg-[var(--school-surface,#fcfdff)] px-4 py-2.5 text-sm font-semibold text-slate-700',
  'transition-[transform,background-color,border-color,color,opacity] duration-200',
  'hover:border-[var(--school-accent-border)] hover:bg-[var(--school-accent-soft)]',
  'hover:text-[var(--school-accent-deep)] active:translate-y-px focus-visible:outline-none',
  'focus-visible:ring-2 focus-visible:ring-[var(--school-accent)] focus-visible:ring-offset-2',
  'disabled:cursor-not-allowed disabled:opacity-50',
].join(' ');

interface SchoolPageHeadingProps {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  level?: 'h1' | 'h2';
  id?: string;
  titleRef?: Ref<HTMLHeadingElement>;
  titleTabIndex?: number;
  size?: 'page' | 'section';
  className?: string;
}

export function SchoolPageHeading({
  eyebrow,
  title,
  description,
  level = 'h1',
  id,
  titleRef,
  titleTabIndex,
  size = 'page',
  className = '',
}: SchoolPageHeadingProps) {
  const Heading = level;
  const titleClass = size === 'page'
    ? 'text-[2.75rem] leading-[0.98] sm:text-[3.5rem]'
    : 'text-[2.15rem] leading-[1.02] sm:text-[2.65rem]';

  return (
    <div className={className}>
      <p className="text-[11px] font-semibold uppercase text-[var(--school-accent-deep)]">
        {eyebrow}
      </p>
      <Heading
        id={id}
        ref={titleRef}
        tabIndex={titleTabIndex}
        className={`mt-2 max-w-3xl font-display font-normal text-slate-950 outline-none ${titleClass}`}
      >
        {title}
      </Heading>
      {description ? (
        <div className="mt-3 max-w-[68ch] text-sm leading-6 text-slate-600 sm:text-[15px]">
          {description}
        </div>
      ) : null}
    </div>
  );
}

type SchoolStatusTone = 'accent' | 'neutral' | 'success' | 'error' | 'support';

const SCHOOL_STATUS_TONES: Record<SchoolStatusTone, string> = {
  accent: 'border-[var(--school-accent-border)] bg-[var(--school-accent-soft)] text-[var(--school-accent-deep)]',
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
  success: 'border-teal-200 bg-teal-50 text-teal-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  support: 'border-orange-200 bg-orange-50 text-orange-900',
};

export function SchoolStatusChip({
  children,
  tone = 'accent',
}: {
  children: ReactNode;
  tone?: SchoolStatusTone;
}) {
  return (
    <span className={`inline-flex min-h-8 items-center rounded-full border px-3 py-1 text-xs font-semibold ${SCHOOL_STATUS_TONES[tone]}`}>
      {children}
    </span>
  );
}

export function SchoolDisclosure({
  title,
  summary,
  children,
}: {
  title: string;
  summary?: string;
  children: ReactNode;
}) {
  return (
    <details className="group border-b border-slate-200 first:border-t">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--school-accent)] focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-900">{title}</span>
          {summary ? <span className="mt-1 block text-xs leading-5 text-slate-500">{summary}</span> : null}
        </span>
        <ChevronDownIcon
          className="h-5 w-5 flex-none text-[var(--school-accent-deep)] transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </summary>
      <div className="pb-5 text-sm leading-6 text-slate-600">{children}</div>
    </details>
  );
}
