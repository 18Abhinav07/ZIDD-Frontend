"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/services/api';
import { startSessionWithPaywall } from '@/services/billing';
import { PathMap, type ProgressNode } from '@/components/shared/PathMap';
import { CreditsBadge, type CreditsBadgeHandle } from '@/components/billing/CreditsBadge';
import { PaywallModal } from '@/components/billing/PaywallModal';
import type { PaywallDetail } from '@/types';
import { ExitIcon } from '@radix-ui/react-icons';

// Resolve the learner's id from the JWT `sub`, falling back to 'anonymous'.
// Module-level (stable reference) so it can be used inside the effect without
// becoming a react-hooks dependency.
function resolveUserId(): string {
  const token = typeof window !== 'undefined' ? localStorage.getItem('zidd_token') : null;
  if (token) {
    try {
      // JWT payloads are base64URL: restore standard base64 ('-'/'_' -> '+'/'/')
      // and pad before atob. Without this, a token whose payload contains '-' or
      // '_' throws and we silently fall back to 'anonymous' -> wrong-progress (the
      // backend filters on user_id, returns 0 rows, and all mastery reads 0.0).
      const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = part.padEnd(part.length + ((4 - (part.length % 4)) % 4), '=');
      return JSON.parse(atob(padded)).sub;
    } catch {
      // ignore malformed token
    }
  }
  return 'anonymous';
}

export default function MapPage() {
  const router = useRouter();
  const [nodes, setNodes] = useState<ProgressNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isTestMode, setIsTestMode] = useState(false);
  const [currentModule, setCurrentModule] = useState('communication');
  // Paywall surfaced from a 402 on /session/start; the pending node lets us
  // retry the exact same start with confirm: true once the learner agrees / pays.
  const [paywall, setPaywall] = useState<PaywallDetail | null>(null);
  const [pendingNodeId, setPendingNodeId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const badgeRef = useRef<CreditsBadgeHandle>(null);

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const moduleId = typeof window !== 'undefined' ? localStorage.getItem('zidd_active_module') || 'communication' : 'communication';
        setCurrentModule(moduleId);
        // Use the resolved learner id, NOT the literal 'current_user' (which the
        // backend filtered on user_id == 'current_user' -> 0 rows -> all node
        // mastery rendered 0.0). The backend also enforces this matches the JWT.
        const data = await apiFetch(`/session/progress/${resolveUserId()}?module_id=${moduleId}`);
        
        if (data && data.length > 0) {
          setNodes(data);
        } else {
          setNodes([]);
        }
      } catch (err: unknown) {
        console.error(err);
        setError('Failed to load progression map.');
      } finally {
        setLoading(false);
      }
    };
    fetchProgress();

    if (typeof window !== 'undefined') {
      const mode = localStorage.getItem('zidd_test_mode');
      setIsTestMode(mode === 'true');
    }
  }, []);

  const routeToSession = (sessionId: string) => {
    if (isTestMode && currentModule === 'group_discussion') {
      router.push(`/simulator/gd?session_id=${sessionId}`);
    } else if (isTestMode && currentModule === 'interview') {
      router.push(`/simulator/interview?session_id=${sessionId}`);
    } else {
      router.push(`/session/${sessionId}`);
    }
  };

  // Core start. Returns true on navigation, false if a paywall was surfaced
  // (state is set so the PaywallModal can drive the confirm/top-up retry).
  const startNode = async (nodeId: string, confirm: boolean): Promise<boolean> => {
    const result = await startSessionWithPaywall({
      user_id: resolveUserId(),
      competency_node: nodeId,
      test_mode: isTestMode,
      confirm,
    });

    if (result.ok) {
      setPaywall(null);
      setPendingNodeId(null);
      routeToSession(result.session_id);
      return true;
    }

    // 402 — surface the paywall and remember which node to retry.
    setPaywall(result.paywall);
    setPendingNodeId(nodeId);
    return false;
  };

  const handleNodeClick = async (node: ProgressNode) => {
    if (node.status === 'locked') return;

    try {
      setLoading(true);
      const navigated = await startNode(node.node_id, false);
      if (!navigated) {
        // Paywall is up; stop the loading spinner so the modal is usable.
        setLoading(false);
      }
    } catch (err: unknown) {
      console.error(err);
      setError('Failed to start session. Please try again.');
      setLoading(false);
    }
  };

  // Retry the pending node with confirm: true (learner agreed to spend, or just
  // topped up). On a fresh 402 the modal simply re-renders with the new state.
  const handleConfirmStart = async () => {
    if (!pendingNodeId) return;
    setConfirming(true);
    try {
      const navigated = await startNode(pendingNodeId, true);
      if (navigated) setLoading(true); // hold the spinner through the route push
    } catch (err: unknown) {
      console.error(err);
      setError('Failed to start session. Please try again.');
      setPaywall(null);
      setPendingNodeId(null);
    } finally {
      setConfirming(false);
    }
  };

  const handlePaywallClose = () => {
    setPaywall(null);
    setPendingNodeId(null);
  };

  const supportsTestMode = currentModule === 'interview' || currentModule === 'group_discussion';

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center font-body mode-gamified">
        <div className="flex flex-col items-center gap-6 text-slate-400">
          <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-accent animate-spin" />
          <p className="font-bold tracking-[0.2em] uppercase text-[10px]">Loading Path...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#FCFCFC] text-slate-900 font-body relative overflow-hidden selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* Dynamic Background Pattern */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-50" style={{ backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-rose-500/5 rounded-full blur-[100px] pointer-events-none z-0" />

      {/* Top Glassmorphic Navigation */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-baseline gap-1">
              <span className="font-sans font-black text-2xl tracking-tighter text-slate-900">ZIDD<span className="text-indigo-600">.</span></span>
            </div>
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <h1 className="font-bold tracking-tight text-slate-500 hidden sm:block text-sm">Your Learning Path</h1>
          </div>
          
          <div className="flex items-center gap-6">
            <CreditsBadge ref={badgeRef} />
            <button
              onClick={() => router.push('/onboarding')}
              className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 hover:text-indigo-600 transition-colors"
            >
              Change Path
            </button>
            <button 
              onClick={() => {
                  if(typeof window !== 'undefined') localStorage.removeItem('zidd_token');
                  router.push('/auth/login');
              }}
              className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 shadow-sm text-slate-500 flex items-center justify-center hover:bg-slate-100 hover:text-red-500 transition-all hover:scale-105 active:scale-95"
              title="Sign Out"
            >
              <ExitIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>
      
      {/* Content Area */}
      <main className="pt-32 pb-32 relative z-10 min-h-[100dvh]">
        {error && (
          <div className="max-w-md mx-auto mb-12 bg-red-50 text-red-600 border border-red-200 px-6 py-4 rounded-[1.5rem] text-center text-xs tracking-widest uppercase font-bold shadow-sm animate-fade-rise">
            {error}
          </div>
        )}

        <PathMap nodes={nodes} onNodeClick={handleNodeClick} />
      </main>

      <PaywallModal
        paywall={paywall}
        confirming={confirming}
        onClose={handlePaywallClose}
        onConfirm={handleConfirmStart}
        onBalanceChange={() => badgeRef.current?.refresh()}
      />
    </div>
  );
}
