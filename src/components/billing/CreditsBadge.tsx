"use client";

import { useCallback, useEffect, useImperativeHandle, useState, forwardRef } from 'react';
import { LightningBoltIcon } from '@radix-ui/react-icons';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { CreditsBalance } from '@/types';
import { getBalance } from '@/services/billing';
import { PacksModal } from './PacksModal';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface CreditsBadgeHandle {
  refresh: () => void;
}

interface CreditsBadgeProps {
  className?: string;
}

// Compact wallet pill. Shows the live credit balance (∞ when demo_unlimited);
// clicking opens the PacksModal. Parents can grab a ref and call refresh() after
// a gated action spends credits. The badge also self-refreshes after a purchase.
export const CreditsBadge = forwardRef<CreditsBadgeHandle, CreditsBadgeProps>(
  function CreditsBadge({ className }, ref) {
    const [balance, setBalance] = useState<CreditsBalance | null>(null);
    const [packsOpen, setPacksOpen] = useState(false);

    const refresh = useCallback(() => {
      getBalance()
        .then((b) => setBalance(b))
        .catch(() => {
          /* keep the last known balance on a transient failure */
        });
    }, []);

    useEffect(() => {
      refresh();
    }, [refresh]);

    useImperativeHandle(ref, () => ({ refresh }), [refresh]);

    const unlimited = balance?.demo_unlimited === true;
    // Show the number only when we actually have a balance. While loading OR
    // after a failed fetch (balance stays null), leave the label empty and
    // render a quiet skeleton pill instead — never a bare '0', which would
    // falsely read as "you have no credits".
    const label = unlimited ? '∞' : balance ? String(balance.credits) : '';

    return (
      <>
        <button
          onClick={() => setPacksOpen(true)}
          className={cn(
            'px-4 py-2 rounded-full bg-white/60 backdrop-blur border border-slate-200/50 shadow-sm flex items-center gap-2 text-slate-800 transition-all hover:bg-white active:scale-95',
            className
          )}
          aria-label="Credit balance — open packs"
          title={unlimited ? 'Unlimited credits (demo)' : 'Credit balance'}
        >
          <LightningBoltIcon className="text-accent w-4 h-4" />
          {label === '' ? (
            <span className="inline-block w-4 h-3 rounded bg-slate-200 animate-pulse align-middle" />
          ) : (
            <span className="text-sm font-bold font-mono leading-none">{label}</span>
          )}
          {!unlimited && (
            <span className="text-[9px] uppercase tracking-widest font-bold text-slate-400 leading-none">
              credits
            </span>
          )}
        </button>

        <PacksModal
          open={packsOpen}
          onClose={() => setPacksOpen(false)}
          onPurchased={refresh}
        />
      </>
    );
  }
);
