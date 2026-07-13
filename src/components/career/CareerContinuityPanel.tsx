"use client";

import { useState } from 'react';
import { ArrowUpRight, ChevronDown, ChevronUp, History } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type {
  ActiveCareerSessionSummary,
  LearningEventSummary,
  MeLearningGraph,
  SessionReportSummary,
} from '@/services/me';

type ContinuityItem = {
  id: string;
  sessionId: string;
  label: string;
  title: string;
  detail: string;
  status: string;
  score: number | null;
  occurredAt: string | number | null;
  href: string;
  active?: boolean;
};

function isGroupDiscussion(taskType?: string, moduleId?: string): boolean {
  if (moduleId === 'group_discussion') return true;
  if (moduleId === 'interview') return false;
  return taskType?.startsWith('gd') === true
    || taskType?.startsWith('group_discussion') === true;
}

function moduleLabel(taskType?: string, moduleId?: string): string {
  return isGroupDiscussion(taskType, moduleId) ? 'Group Discussion' : 'Interview';
}

function isCareerTask(taskType?: string, moduleId?: string): boolean {
  if (moduleId === 'interview' || moduleId === 'group_discussion') return true;
  if (moduleId) return false;
  return Boolean(
      taskType?.startsWith('interview')
      || taskType?.startsWith('gd')
      || taskType?.startsWith('group_discussion')
  );
}

function skillLabel(value?: string): string {
  const clean = String(value || '').trim();
  if (!clean) return 'Career practice';
  return clean
    .replace(/^(gd|int)_\d+_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function reportStatus(report: SessionReportSummary): string {
  const persistedValidity = String(
    report.validity_json?.validity_status
    || report.validity_json?.status
    || report.status,
  ).trim();
  if (persistedValidity === 'final') return 'Final report';
  if (persistedValidity === 'partial') return 'Partial report';
  if (persistedValidity === 'insufficient_evidence') return 'Insufficient evidence';
  if (persistedValidity === 'invalid_simulation') return 'Simulator issue';
  return persistedValidity.replace(/_/g, ' ');
}

function reportHref(report: SessionReportSummary): string {
  const route = isGroupDiscussion(report.task_type, report.module_id) ? 'gd' : 'interview';
  const params = new URLSearchParams({
    session_id: report.session_id,
    return_to: 'career',
  });
  return `/simulator/${route}?${params.toString()}`;
}

function reportItem(report: SessionReportSummary): ContinuityItem {
  const label = moduleLabel(report.task_type, report.module_id);
  const context = report.public_context_json || {};
  const contextTitle = String(context.role_focus || context.topic || context.scenario_label || '').trim();
  const persistedValidity = String(
    report.validity_json?.validity_status
    || report.validity_json?.status
    || report.status,
  ).trim();
  const isScored = !['insufficient_evidence', 'invalid_simulation'].includes(persistedValidity);
  return {
    id: report.report_id || `report:${report.session_id}`,
    sessionId: report.session_id,
    label: `${label} test`,
    title: contextTitle || `${label} assessment`,
    detail: String(report.summary || report.recommended_actions_json?.[0] || 'Open the saved outcome.'),
    status: reportStatus(report),
    score: isScored ? Number(report.score || 0) : null,
    occurredAt: report.created_at ?? null,
    href: reportHref(report),
  };
}

function eventItem(event: LearningEventSummary): ContinuityItem {
  const label = moduleLabel(event.task_type, event.module_id);
  const evidence = event.evidence_json || {};
  const quote = String(evidence.latest_quote || evidence.evidence_quote || '').trim();
  const reviewNode = String(event.skill_id || event.node_id || '').trim();
  return {
    id: event.source_event_key,
    sessionId: String(event.session_id || ''),
    label: `${label} practice`,
    title: skillLabel(event.skill_id || event.node_id),
    detail: quote || event.gap || 'Open the saved practice transcript.',
    status: event.attempt_type ? `${skillLabel(event.attempt_type)} attempt` : 'Practice evidence',
    score: Number.isFinite(event.score) ? Number(event.score) : null,
    occurredAt: event.occurred_at ?? null,
    href: `/session/${encodeURIComponent(String(event.session_id || ''))}?review=1&node=${encodeURIComponent(reviewNode)}`,
  };
}

function activeSessionItem(session: ActiveCareerSessionSummary): ContinuityItem {
  const label = moduleLabel(session.task_type, session.module_id);
  const isTest = session.test_mode || session.task_type.endsWith('_test');
  const route = isGroupDiscussion(session.task_type, session.module_id) ? 'gd' : 'interview';
  const transition = session.pending_transition || {};
  const checkpointTitle = String(transition.from_title || '').trim();
  const checkpointNode = String(transition.from_node || session.current_node || '').trim();
  const nextTitle = String(transition.to_title || '').trim();
  return {
    id: `active:${session.session_id}`,
    sessionId: session.session_id,
    label: `${label} ${isTest ? 'test' : 'practice'}`,
    title: checkpointTitle || skillLabel(checkpointNode),
    detail: nextTitle
      ? `Checkpoint saved. Next up: ${nextTitle}.`
      : 'Your transcript and current checkpoint are saved.',
    status: 'Resume active',
    score: null,
    occurredAt: session.updated_at ?? null,
    href: isTest
      ? `/simulator/${route}?session_id=${encodeURIComponent(session.session_id)}`
      : `/session/${encodeURIComponent(session.session_id)}`,
    active: true,
  };
}

function timestamp(value: string | number | null | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }
  const clean = String(value || '').trim();
  if (/^\d+$/.test(clean)) {
    const numeric = Number(clean);
    return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
  }
  const parsed = Date.parse(clean);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function careerContinuityItems(graph: MeLearningGraph | null): ContinuityItem[] {
  if (!graph) return [];
  const activeSessions = graph.active_sessions || [];
  const activeSessionIds = new Set(activeSessions.map((session) => session.session_id));
  const reports = graph.reports.filter((report) => isCareerTask(report.task_type, report.module_id));
  const reportSessionIds = new Set(reports.map((report) => report.session_id));
  const prepBySession = new Map<string, LearningEventSummary>();
  for (const event of graph.events) {
    const sessionId = String(event.session_id || '');
    if (
      event.domain !== 'career'
      || !isCareerTask(event.task_type, event.module_id)
      || !sessionId
      || activeSessionIds.has(sessionId)
      || reportSessionIds.has(sessionId)
      || !event.source.startsWith('prep')
    ) continue;
    const previous = prepBySession.get(sessionId);
    if (!previous || timestamp(event.occurred_at) > timestamp(previous.occurred_at)) {
      prepBySession.set(sessionId, event);
    }
  }
  const history = [
    ...reports.filter((report) => !activeSessionIds.has(report.session_id)).map(reportItem),
    ...Array.from(prepBySession.values()).map(eventItem),
  ].sort((left, right) => timestamp(right.occurredAt) - timestamp(left.occurredAt));
  return [
    ...activeSessions.map(activeSessionItem).sort((left, right) => timestamp(right.occurredAt) - timestamp(left.occurredAt)),
    ...history,
  ];
}

export function careerEvidenceProvenance(
  graph: MeLearningGraph | null,
  skillId?: string,
): string {
  if (!graph || !skillId) return '';
  const event = graph.events
    .filter((item) => item.domain === 'career' && item.skill_id === skillId)
    .sort((left, right) => timestamp(right.occurred_at) - timestamp(left.occurred_at))[0];
  if (!event) return '';
  const source = event.source.includes('test') ? 'Scored test' : 'Practice';
  const occurredAt = timestamp(event.occurred_at);
  const date = occurredAt
    ? new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(occurredAt))
    : '';
  return [source, date].filter(Boolean).join(' - ');
}

export function CareerContinuityPanel({
  graph,
  compact = false,
}: {
  graph: MeLearningGraph | null;
  compact?: boolean;
}) {
  const router = useRouter();
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const allItems = careerContinuityItems(graph);
  const activeItems = allItems.filter((item) => item.active);
  const allHistoryItems = allItems.filter((item) => !item.active);
  const collapsedHistoryLimit = compact ? 3 : 5;
  const historyItems = allHistoryItems.slice(
    0,
    historyExpanded ? Math.max(12, collapsedHistoryLimit) : collapsedHistoryLimit,
  );
  const items = [...activeItems, ...historyItems];
  const canExpandHistory = allHistoryItems.length > collapsedHistoryLimit;
  if (!items.length) return null;

  return (
    <section className="mt-8 border-y border-slate-200 py-7">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
          <History className="h-4 w-4" />
        </span>
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Session continuity</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">Your recent career work</h2>
          {!compact && (
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              Reopen saved practice and assessment outcomes without losing the thread.
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 divide-y divide-slate-100 border-t border-slate-100">
        {items.map((item) => {
          const occurredAt = timestamp(item.occurredAt);
          const date = occurredAt
            ? new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(occurredAt))
            : '';
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => router.push(item.href)}
              className={`group grid w-full grid-cols-[minmax(0,1fr)_auto] gap-4 py-4 text-left ${item.active ? 'bg-indigo-50/60 px-3' : ''}`}
            >
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                  <span>{item.label}</span>
                  <span>{item.status}</span>
                  {date && <span>{date}</span>}
                </span>
                <span className="mt-1 block truncate text-sm font-black text-slate-900">{item.title}</span>
                {!compact && (
                  <span className="mt-1 block line-clamp-2 text-xs leading-relaxed text-slate-500">{item.detail}</span>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-3 self-center">
                {item.score !== null && (
                  <span className="text-sm font-black tabular-nums text-slate-700">{Math.round(item.score * 100)}%</span>
                )}
                <ArrowUpRight className="h-4 w-4 text-slate-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-slate-900" />
              </span>
            </button>
          );
        })}
      </div>
      {canExpandHistory && (
        <button
          type="button"
          onClick={() => setHistoryExpanded((current) => !current)}
          aria-expanded={historyExpanded}
          className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-bold text-slate-700 hover:text-slate-950"
        >
          {historyExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {historyExpanded ? 'Show less history' : 'Show more history'}
        </button>
      )}
    </section>
  );
}
