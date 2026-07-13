"use client";

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon } from '@radix-ui/react-icons';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ProgressNode } from '@/components/shared/PathMap';
import type { CareerProfile, ModuleId } from '@/services/me';
import type { SimulationScenarioConfig } from '@/types';
import { labelGdTopic } from '@/lib/gdTopics';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const GD_ENVIRONMENTS = [
  { id: 'campus_placement', label: 'Campus', description: 'Placement-style group round.' },
  { id: 'business_case', label: 'Case', description: 'Business judgment and trade-offs.' },
  { id: 'workplace_debate', label: 'Workplace', description: 'Professional disagreement.' },
  { id: 'high_pressure_panel', label: 'Pressure', description: 'Sharper interruptions and pushback.' },
] as const;

const GD_PERSONAS = [
  { id: 'aggressive_challenger', label: 'Challenger', description: 'Pushes weak claims.' },
  { id: 'data_driven_analyst', label: 'Analyst', description: 'Asks for evidence.' },
  { id: 'quiet_expert', label: 'Expert', description: 'Precise, lower-volume voice.' },
  { id: 'consensus_builder', label: 'Builder', description: 'Connects opposing views.' },
  { id: 'devils_advocate', label: 'Advocate', description: 'Tests the opposite side.' },
] as const;

const INTERVIEW_TYPES = [
  { id: 'technical_project', label: 'Technical', description: 'Projects, debugging, trade-offs.' },
  { id: 'behavioral', label: 'Behavioral', description: 'STAR stories and judgment.' },
  { id: 'hr', label: 'HR', description: 'Fit, motivation, strengths.' },
  { id: 'management', label: 'Management', description: 'People and stakeholder calls.' },
  { id: 'mixed', label: 'Mixed', description: 'A balanced interview loop.' },
] as const;

const PRESSURE_LEVELS = [
  { id: 'warm', label: 'Warm' },
  { id: 'standard', label: 'Standard' },
  { id: 'high', label: 'High' },
] as const;

const DEFAULT_GD_TOPICS = [
  'Is artificial intelligence a net positive for the future job market?',
  'Should college education be free for everyone?',
  'Is online learning as effective as classroom learning?',
  'Should companies prioritize profit or social responsibility?',
];

type InterviewType = NonNullable<SimulationScenarioConfig['interview_type']>;

interface ScenarioPickerProps {
  nodes: ProgressNode[];
  moduleId: ModuleId | null;
  careerProfile?: CareerProfile;
  onPick: (node: ProgressNode, config: SimulationScenarioConfig) => void;
  disabled?: boolean;
}

function uniqueClean(values: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const value = String(raw || '').trim();
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function defaultInterviewTypeForNode(node: ProgressNode): InterviewType {
  const key = `${node.node_id} ${node.title}`.toLowerCase();
  if (
    key.includes('tell me about yourself')
    || key.includes('strength')
    || key.includes('weakness')
    || key.includes('why this company')
    || key.includes('close and ask')
    || key.includes('gap')
  ) {
    return 'hr';
  }
  if (
    key.includes('star')
    || key.includes('failure')
    || key.includes('ambiguous')
    || key.includes('quantify')
    || key.includes('disagree')
  ) {
    return 'behavioral';
  }
  if (key.includes('negotiate')) {
    return 'management';
  }
  return 'mixed';
}

function TogglePill({
  active,
  onClick,
  title,
  body,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  body?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'text-left rounded-2xl border px-4 py-3 transition-all',
        active
          ? 'border-slate-900 bg-slate-900 text-white shadow-[0_18px_35px_rgba(15,23,42,0.18)]'
          : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/40'
      )}
    >
      <span className="block text-sm font-black tracking-tight">{title}</span>
      {body && (
        <span className={cn('mt-1 block text-[11px] leading-snug', active ? 'text-white/70' : 'text-slate-500')}>
          {body}
        </span>
      )}
    </button>
  );
}

export const ScenarioPicker: React.FC<ScenarioPickerProps> = ({
  nodes,
  moduleId,
  careerProfile,
  onPick,
  disabled = false,
}) => {
  const [selectedNode, setSelectedNode] = useState<ProgressNode | null>(null);
  const profileTopics = useMemo(
    () => uniqueClean([
      ...(careerProfile?.custom_gd_topics || []),
      ...(careerProfile?.gd_topic_ids || []).map(labelGdTopic),
    ]),
    [careerProfile]
  );
  const targetRoles = useMemo(
    () => uniqueClean(careerProfile?.target_roles || []),
    [careerProfile]
  );

  const topicOptions = profileTopics.length ? profileTopics : DEFAULT_GD_TOPICS;
  const [topicMode, setTopicMode] = useState<'profile' | 'custom' | 'random'>('profile');
  const [selectedTopic, setSelectedTopic] = useState(topicOptions[0] || DEFAULT_GD_TOPICS[0]);
  const [customTopic, setCustomTopic] = useState('');
  const [environment, setEnvironment] = useState<SimulationScenarioConfig['environment']>('campus_placement');
  const [personaIds, setPersonaIds] = useState<string[]>([
    'aggressive_challenger',
    'data_driven_analyst',
    'consensus_builder',
  ]);
  const [targetRole, setTargetRole] = useState(targetRoles[0] || '');
  const [interviewType, setInterviewType] = useState<InterviewType>('mixed');
  const [pressureLevel, setPressureLevel] = useState<SimulationScenarioConfig['pressure_level']>('standard');

  const isGd = moduleId === 'group_discussion';
  const isInterview = moduleId === 'interview';
  const canStartGd = topicMode !== 'custom' || customTopic.trim().length >= 8;
  const canStartInterview = targetRole.trim().length >= 2;

  const togglePersona = (id: string) => {
    setPersonaIds((current) => {
      if (current.includes(id)) {
        return current.length <= 2 ? current : current.filter((item) => item !== id);
      }
      return [...current, id].slice(0, 4);
    });
  };

  const selectScenarioNode = (node: ProgressNode) => {
    setSelectedNode(node);
    if (moduleId === 'interview') {
      setInterviewType(defaultInterviewTypeForNode(node));
    }
  };

  const start = () => {
    if (!selectedNode || disabled) return;
    if (isGd) {
      const config: SimulationScenarioConfig = {
        topic_mode: topicMode,
        topic: topicMode === 'profile' ? selectedTopic : undefined,
        custom_topic: topicMode === 'custom' ? customTopic.trim() : undefined,
        environment,
        persona_ids: personaIds,
      };
      onPick(selectedNode, config);
      return;
    }
    if (isInterview) {
      onPick(selectedNode, {
        target_role: targetRole.trim(),
        interview_type: interviewType,
        pressure_level: pressureLevel,
      });
      return;
    }
    onPick(selectedNode, {});
  };

  if (selectedNode) {
    return (
      <div className="max-w-5xl mx-auto px-6 lg:px-12">
        <button
          type="button"
          onClick={() => setSelectedNode(null)}
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500 hover:bg-slate-50"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Scenarios
        </button>

        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-indigo-500">
              Selected assessment
            </p>
            <h2 className="mt-3 font-display text-4xl tracking-tight text-slate-900">
              {selectedNode.title}
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-500">
              {isGd
                ? 'Your topic, room pressure, and panel voices stay fixed for the full GD.'
                : 'Your interviewer will use this role focus and pressure level throughout the round.'}
            </p>
            <button
              type="button"
              onClick={start}
              disabled={disabled || (isGd ? !canStartGd : isInterview ? !canStartInterview : false)}
              className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-4 text-sm font-black text-white shadow-[0_24px_45px_rgba(15,23,42,0.22)] transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
            >
              {disabled ? 'Starting...' : 'Start assessment'}
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </section>

          {isGd ? (
            <section className="space-y-6">
              <div>
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Topic</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <TogglePill active={topicMode === 'profile'} onClick={() => setTopicMode('profile')} title="Profile" body="Use your saved topics." />
                  <TogglePill active={topicMode === 'custom'} onClick={() => setTopicMode('custom')} title="Custom" body="Bring your own motion." />
                  <TogglePill active={topicMode === 'random'} onClick={() => setTopicMode('random')} title="Random" body="Let Zidd pick." />
                </div>
                {topicMode === 'profile' && (
                  <select
                    value={selectedTopic}
                    onChange={(event) => setSelectedTopic(event.target.value)}
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                  >
                    {topicOptions.map((topic) => (
                      <option key={topic} value={topic}>{topic}</option>
                    ))}
                  </select>
                )}
                {topicMode === 'custom' && (
                  <input
                    value={customTopic}
                    onChange={(event) => setCustomTopic(event.target.value)}
                    placeholder="Example: Should AI replace campus interviews?"
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                  />
                )}
              </div>

              <div>
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Environment</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {GD_ENVIRONMENTS.map((item) => (
                    <TogglePill
                      key={item.id}
                      active={environment === item.id}
                      onClick={() => setEnvironment(item.id)}
                      title={item.label}
                      body={item.description}
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Panel</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {GD_PERSONAS.map((persona) => {
                    const active = personaIds.includes(persona.id);
                    return (
                      <button
                        key={persona.id}
                        type="button"
                        onClick={() => togglePersona(persona.id)}
                        className={cn(
                          'flex items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-all',
                          active
                            ? 'border-indigo-300 bg-indigo-50 text-indigo-950'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-200'
                        )}
                      >
                        <span className={cn(
                          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                          active ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-slate-300'
                        )}>
                          {active && <CheckIcon className="h-3.5 w-3.5" />}
                        </span>
                        <span>
                          <span className="block text-sm font-black">{persona.label}</span>
                          <span className="mt-1 block text-[11px] leading-snug text-slate-500">{persona.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          ) : (
            <section className="space-y-6">
              <div>
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Target role</p>
                <input
                  value={targetRole}
                  onChange={(event) => setTargetRole(event.target.value)}
                  placeholder="Example: Backend Engineer"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                />
                {targetRoles.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {targetRoles.map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setTargetRole(role)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 hover:border-indigo-200 hover:text-indigo-600"
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Interview type</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {INTERVIEW_TYPES.map((item) => (
                    <TogglePill
                      key={item.id}
                      active={interviewType === item.id}
                      onClick={() => setInterviewType(item.id)}
                      title={item.label}
                      body={item.description}
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Pressure</p>
                <div className="grid grid-cols-3 gap-3">
                  {PRESSURE_LEVELS.map((item) => (
                    <TogglePill
                      key={item.id}
                      active={pressureLevel === item.id}
                      onClick={() => setPressureLevel(item.id)}
                      title={item.label}
                    />
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-12">
      <div className="text-center max-w-2xl mx-auto mb-14">
        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-indigo-500">Assessment</span>
        <h2 className="mt-3 font-display text-4xl md:text-5xl tracking-tight text-slate-900 leading-[1.05]">
          Choose your scenario
        </h2>
        <p className="mt-4 text-slate-500 text-[15px] leading-relaxed">
          Pick a scored round, then tune the role, topic, pressure, and panel before it starts.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {nodes.map((node, index) => {
          const status = node.display_status ?? node.status;
          const mastered = Boolean(node.mastered ?? node.node_mastered ?? status === 'mastered');
          const ready = !mastered && (status === 'ready_to_advance' || status === 'proficient');

          return (
          <motion.button
            key={node.node_id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: Math.min(index * 0.04, 0.4), ease: [0.16, 1, 0.3, 1] }}
            onClick={() => selectScenarioNode(node)}
            className={cn(
              "group relative text-left bg-white rounded-[1.75rem] border border-slate-200/70 p-6 pb-5",
              "shadow-[0_4px_20px_rgba(15,23,42,0.04)] overflow-hidden",
              "transition-all duration-300 ease-out hover:-translate-y-1 hover:border-indigo-200",
              "hover:shadow-[0_24px_40px_rgba(79,70,229,0.12)] focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"
            )}
          >
            <span className="pointer-events-none absolute -top-4 right-3 font-anton text-[5.5rem] leading-none tracking-tighter text-slate-900/[0.04] group-hover:text-indigo-500/10 transition-colors duration-300 select-none">
              {String(index + 1).padStart(2, '0')}
            </span>

            <div className="relative">
              {mastered && (
                <span className="inline-block mb-3 text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-600">
                  Mastered
                </span>
              )}
              {ready && (
                <span className="inline-block mb-3 text-[9px] font-bold uppercase tracking-[0.2em] text-amber-600">
                  Ready for next skill
                </span>
              )}
              <h3 className="font-bold text-lg text-slate-900 leading-tight tracking-tight pr-12">
                {node.title}
              </h3>
              <div className="mt-6 flex items-center gap-2 text-indigo-600">
                <span className="text-[11px] font-bold uppercase tracking-[0.18em]">Configure</span>
                <ArrowRightIcon className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
              </div>
            </div>
          </motion.button>
          );
        })}
      </div>
    </div>
  );
};
