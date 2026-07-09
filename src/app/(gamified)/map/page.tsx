"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { friendlySessionStartErrorMessage, startSessionWithPaywall } from '@/services/billing';
import { getMe, homeForMe, type CareerProfile, type ModuleId } from '@/services/me';
import { getProgressionMap } from '@/services/progression';
import { PathMap, type ProgressNode } from '@/components/shared/PathMap';
import { ScenarioPicker } from '@/components/shared/ScenarioPicker';
import { CreditsBadge, type CreditsBadgeHandle } from '@/components/billing/CreditsBadge';
import { PaywallModal } from '@/components/billing/PaywallModal';
import { PathMapSkeleton } from '@/components/shared/RouteSkeletons';
import Image from 'next/image';
import { AVATAR_PATHS } from '@/lib/avatarRegistry';
import type { PaywallDetail, SimulationScenarioConfig } from '@/types';
import { ExitIcon } from '@radix-ui/react-icons';

type FailedStart = {
  nodeId: string;
  confirm: boolean;
  reattempt: boolean;
  simulationConfig?: SimulationScenarioConfig;
};



export default function MapPage() {
  const router = useRouter();
  const { data: authSession } = useSession();
  const [nodes, setNodes] = useState<ProgressNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isTestMode, setIsTestMode] = useState<boolean>(false);
  const [currentModule, setCurrentModule] = useState<ModuleId | null>(null);
  const [careerProfile, setCareerProfile] = useState<CareerProfile>({});
  // Paywall surfaced from a 402 on /session/start; the pending node lets us
  // retry the exact same start with confirm: true once the learner agrees / pays.
  const [paywall, setPaywall] = useState<PaywallDetail | null>(null);
  const [pendingNodeId, setPendingNodeId] = useState<string | null>(null);
  const [pendingReattempt, setPendingReattempt] = useState(false);
  const [pendingSimulationConfig, setPendingSimulationConfig] = useState<SimulationScenarioConfig | undefined>();
  const [reattemptNode, setReattemptNode] = useState<ProgressNode | null>(null);
  const [reattemptSimulationConfig, setReattemptSimulationConfig] = useState<SimulationScenarioConfig | undefined>();
  const [confirming, setConfirming] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const badgeRef = useRef<CreditsBadgeHandle>(null);
  const startIdsRef = useRef<Map<string, string>>(new Map());
  const failedStartRef = useRef<FailedStart | null>(null);

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        setLoading(true);
        setError('');
        const profile = await getMe();
        const moduleId = profile.preferences.active_module;
        if (!moduleId) {
          router.replace(homeForMe(profile));
          return;
        }
        if (moduleId === 'school_english') {
          router.replace('/subjects');
          return;
        }
        setCurrentModule(moduleId);
        setCareerProfile(profile.career_profile || {});
        setIsTestMode(Boolean(profile.preferences.test_mode));
        const data = await getProgressionMap(moduleId, { force: reloadKey > 0 });
        
        if (data && data.length > 0) {
          setNodes(data);
        } else {
          setNodes([]);
        }
      } catch (err: unknown) {
        console.error(err);
        const raw = err instanceof Error ? err.message : '';
        setError(raw === 'progression_unavailable'
          ? 'progression_unavailable'
          : 'Failed to load progression map.');
      } finally {
        setLoading(false);
      }
    };
    fetchProgress();

  }, [reloadKey, router]);

  const routeToSession = (sessionId: string, simulationConfig?: SimulationScenarioConfig) => {
    if (isTestMode && currentModule === 'group_discussion') {
      const params = new URLSearchParams({ session_id: sessionId });
      const topicHint = simulationConfig?.custom_topic || simulationConfig?.topic;
      if (topicHint) params.set('topic', topicHint);
      router.push(`/simulator/gd?${params.toString()}`);
    } else if (isTestMode && currentModule === 'interview') {
      router.push(`/simulator/interview?session_id=${sessionId}`);
    } else {
      router.push(`/session/${sessionId}`);
    }
  };

  const stableConfigKey = (simulationConfig?: SimulationScenarioConfig) => (
    simulationConfig ? JSON.stringify(simulationConfig) : '{}'
  );

  const startIntentKey = (
    nodeId: string,
    reattempt: boolean,
    simulationConfig?: SimulationScenarioConfig,
  ) => [
    currentModule || 'module',
    isTestMode ? 'test' : 'prep',
    reattempt ? 'reattempt' : 'start',
    nodeId,
    stableConfigKey(simulationConfig),
  ].join(':');

  const startIdForIntent = (intentKey: string) => {
    const existing = startIdsRef.current.get(intentKey);
    if (existing) return existing;
    const next = crypto.randomUUID();
    startIdsRef.current.set(intentKey, next);
    return next;
  };

  const clearStartId = (intentKey: string | null | undefined) => {
    if (!intentKey) return;
    startIdsRef.current.delete(intentKey);
  };

  // Core start. Returns true on navigation, false if a paywall was surfaced
  // (state is set so the PaywallModal can drive the confirm/top-up retry).
  const startNode = async (
    nodeId: string,
    confirm: boolean,
    reattempt = false,
    simulationConfig?: SimulationScenarioConfig,
  ): Promise<boolean> => {
    const intentKey = startIntentKey(nodeId, reattempt, simulationConfig);
    let result;
    try {
      result = await startSessionWithPaywall({
        competency_node: nodeId,
        test_mode: isTestMode,
        confirm,
        reattempt_confirmed: reattempt,
        simulation_config: simulationConfig,
        client_start_id: startIdForIntent(intentKey),
      });
    } catch (err) {
      failedStartRef.current = { nodeId, confirm, reattempt, simulationConfig };
      throw err;
    }

    if (result.ok) {
      failedStartRef.current = null;
      clearStartId(intentKey);
      setPaywall(null);
      setPendingNodeId(null);
      setPendingReattempt(false);
      setPendingSimulationConfig(undefined);
      badgeRef.current?.refresh();
      routeToSession(result.session_id, simulationConfig);
      return true;
    }

    // 402 — surface the paywall and remember which node to retry.
    setPaywall(result.paywall);
    setPendingNodeId(nodeId);
    setPendingReattempt(reattempt);
    setPendingSimulationConfig(simulationConfig);
    return false;
  };

  const startErrorMessage = (err: unknown): string => {
    return friendlySessionStartErrorMessage(err);
  };

  const retryFailedStart = async () => {
    const failed = failedStartRef.current;
    if (!failed) {
      setReloadKey((value) => value + 1);
      return;
    }
    try {
      setLoading(true);
      setError('');
      const navigated = await startNode(
        failed.nodeId,
        failed.confirm,
        failed.reattempt,
        failed.simulationConfig,
      );
      if (!navigated) setLoading(false);
    } catch (err: unknown) {
      console.error(err);
      setError(startErrorMessage(err));
      setLoading(false);
    }
  };

  const handleNodeClick = async (node: ProgressNode) => {
    const status = node.display_status ?? node.status;
    const mastered = Boolean(node.mastered ?? node.node_mastered ?? status === 'mastered');
    const completed = Boolean(mastered);
    if (status === 'locked') return;
    if (completed) {
      setReattemptNode(node);
      return;
    }

    try {
      setLoading(true);
      const navigated = await startNode(node.node_id, false);
      if (!navigated) {
        // Paywall is up; stop the loading spinner so the modal is usable.
        setLoading(false);
      }
    } catch (err: unknown) {
      console.error(err);
      setError(startErrorMessage(err));
      setLoading(false);
    }
  };

  // TEST mode: every scenario is independently startable (the backend gates on
  // the attempt meter, not on prep mastery), so there is NO locked-node guard —
  // the picker offers them all.
  const handleScenarioPick = async (node: ProgressNode, simulationConfig: SimulationScenarioConfig) => {
    try {
      setLoading(true);
      const navigated = await startNode(node.node_id, false, false, simulationConfig);
      if (!navigated) setLoading(false);
    } catch (err: unknown) {
      console.error(err);
      setError(startErrorMessage(err));
      setLoading(false);
    }
  };

  // Retry the pending node with confirm: true (learner agreed to spend, or just
  // topped up). On a fresh 402 the modal simply re-renders with the new state.
  const handleConfirmStart = async () => {
    if (!pendingNodeId) return;
    setConfirming(true);
    try {
      const navigated = await startNode(pendingNodeId, true, pendingReattempt, pendingSimulationConfig);
      if (navigated) setLoading(true); // hold the spinner through the route push
    } catch (err: unknown) {
      console.error(err);
      setError(startErrorMessage(err));
      setPaywall(null);
      setPendingNodeId(null);
      setPendingReattempt(false);
    } finally {
      setConfirming(false);
    }
  };

  const handlePaywallClose = () => {
    clearStartId(
      pendingNodeId
        ? startIntentKey(pendingNodeId, pendingReattempt, pendingSimulationConfig)
        : null,
    );
    setPaywall(null);
    setPendingNodeId(null);
    setPendingReattempt(false);
    setPendingSimulationConfig(undefined);
  };

  const handleReattemptConfirm = async () => {
    if (!reattemptNode) return;
    setLoading(true);
    let clearIntent = false;
    try {
      const navigated = await startNode(
        reattemptNode.node_id,
        true,
        true,
        reattemptSimulationConfig,
      );
      clearIntent = navigated;
      if (!navigated) setLoading(false);
    } catch (err: unknown) {
      console.error(err);
      setError(startErrorMessage(err));
      setLoading(false);
      clearIntent = true;
    } finally {
      if (clearIntent) {
        clearStartId(startIntentKey(
          reattemptNode.node_id,
          true,
          reattemptSimulationConfig,
        ));
      }
      setReattemptNode(null);
      setReattemptSimulationConfig(undefined);
    }
  };

  const moduleLabel = currentModule === 'group_discussion' ? 'Group Discussion' : 'Interview';
  const profileImage = authSession?.user?.image || AVATAR_PATHS.casual_male;

  return (
    <div className="min-h-[100dvh] bg-[#FCFCFC] text-slate-900 font-body relative overflow-hidden selection:bg-indigo-100 selection:text-indigo-900">

      {/* Dynamic Background Pattern */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-50" style={{ backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-rose-500/5 rounded-full blur-[100px] pointer-events-none z-0" />

      {/* Top Glassmorphic Navigation — always present, even during data load */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button
              onClick={() => router.push('/career')}
              className="flex items-baseline gap-1 hover:opacity-80 transition-opacity"
            >
              <span className="font-sans font-black text-2xl tracking-tighter text-slate-900">ZIDD<span className="text-indigo-600">.</span></span>
            </button>
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <h1 className="font-bold tracking-tight text-slate-500 hidden sm:block text-sm">{isTestMode ? 'Assessment Scenarios' : 'Your Learning Path'}</h1>
          </div>

          <div className="flex items-center gap-6">
            <CreditsBadge ref={badgeRef} />
            <button
              onClick={() => router.push('/career')}
              className="hidden sm:block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 hover:text-indigo-600 transition-colors"
            >
              Switch Module
            </button>
            <button
              onClick={() => router.push('/profile')}
              aria-label="Profile"
              title="Profile"
              className="relative w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 shadow-sm overflow-hidden hover:scale-105 active:scale-95 transition-all"
            >
              <Image
                src={profileImage}
                alt="Profile"
                fill
                sizes="40px"
                className="object-cover object-top scale-[1.2] translate-y-1"
                unoptimized
              />
            </button>
            <button
              onClick={() => signOut({ callbackUrl: '/auth/login' })}
              className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 shadow-sm text-slate-500 flex items-center justify-center hover:bg-slate-100 hover:text-red-500 transition-all hover:scale-105 active:scale-95"
              title="Sign Out"
            >
              <ExitIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Content Area */}
      {loading ? (
        <PathMapSkeleton label={currentModule ? 'Loading path' : 'Resolving path'} />
      ) : (
        <main className="pt-28 pb-32 relative z-10 min-h-[100dvh]">
          {error && (
            <div className="max-w-lg mx-auto mb-12 bg-red-50 text-red-700 border border-red-200 px-6 py-5 rounded-[1.5rem] text-center shadow-sm animate-fade-rise">
              <p className="text-[10px] tracking-[0.2em] uppercase font-bold">
                {error === 'progression_unavailable' ? 'Path unavailable' : 'Path error'}
              </p>
              <p className="mt-2 text-sm font-semibold text-red-900">
                {error === 'progression_unavailable'
                  ? 'We could not read your saved progress from the server. Your mode is saved, so retry instead of setting up again.'
                  : error}
              </p>
              <div className="mt-5 flex flex-col sm:flex-row justify-center gap-3">
                <button
                  onClick={error && error !== 'progression_unavailable' ? retryFailedStart : () => setReloadKey((value) => value + 1)}
                  className="rounded-full bg-red-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-800"
                >
                  Retry
                </button>
                <button
                  onClick={() => router.push('/career')}
                  className="rounded-full border border-red-200 bg-white px-5 py-2.5 text-sm font-bold text-red-700 hover:bg-red-100"
                >
                  Back to career
                </button>
              </div>
            </div>
          )}

          {!error && nodes.length === 0 ? (
            <div className="max-w-xl mx-auto mt-24 rounded-[2rem] border border-slate-200 bg-white px-8 py-10 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-indigo-500">No levels found</p>
              <h2 className="mt-3 font-display text-4xl tracking-tight text-slate-900">{moduleLabel} path is unavailable</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">
                Your mode is saved, but the server did not return any levels for this module. Retry loading the path or go back to career prep.
              </p>
              <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => setReloadKey((value) => value + 1)}
                  className="rounded-full bg-slate-900 px-6 py-3 text-sm font-bold text-white hover:bg-slate-800 transition-colors"
                >
                  Retry path
                </button>
                <button
                  onClick={() => router.push('/career')}
                  className="rounded-full border border-slate-200 px-6 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Back to career
                </button>
              </div>
            </div>
          ) : isTestMode
            ? (
              <ScenarioPicker
                nodes={nodes}
                moduleId={currentModule}
                careerProfile={careerProfile}
                onPick={handleScenarioPick}
              />
            )
            : <PathMap nodes={nodes} onNodeClick={handleNodeClick} />}
        </main>
      )}

      <PaywallModal
        paywall={paywall}
        confirming={confirming}
        onClose={handlePaywallClose}
        onConfirm={handleConfirmStart}
        onBalanceChange={() => badgeRef.current?.refresh()}
      />
      {reattemptNode && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-3xl bg-white border border-slate-200 p-7 shadow-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-600">Completed</p>
            <h2 className="mt-2 font-display text-3xl tracking-tight text-slate-900">Reattempt this level?</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              Your completed progress stays saved. This starts a fresh practice attempt for {reattemptNode.title}.
            </p>
            <div className="mt-7 flex gap-3">
              <button
                onClick={() => {
                  setReattemptNode(null);
                  setReattemptSimulationConfig(undefined);
                }}
                className="flex-1 rounded-full border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReattemptConfirm}
                className="flex-1 rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800"
              >
                Reattempt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
