"use client";

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { SessionRecapFrame } from '@/types';
import { Target, CheckCircle2, TrendingDown } from 'lucide-react';

interface SessionRecapProps {
  recap: SessionRecapFrame;
  onClose?: () => void;
}

export function SessionRecap({ recap, onClose }: SessionRecapProps) {
  const percentage = Math.round(recap.avg_score * 100);
  // Portal to <body>: this report renders inside the tutor shell, whose
  // transforms would otherwise trap this fixed overlay and offset it.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-rise overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl p-10 w-full max-w-lg shadow-2xl flex flex-col items-center">
        
        {/* Header */}
        <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6">
          <Target size={32} />
        </div>
        <h2 className="text-3xl font-display text-slate-900 mb-8 tracking-tight">Session Complete</h2>
        
        {/* Score Ring */}
        <div className="relative w-32 h-32 flex items-center justify-center rounded-full border-4 border-slate-100 mb-10">
          <div className="absolute inset-0 rounded-full border-4 border-indigo-500 opacity-20" />
          <svg className="absolute inset-0 w-full h-full -rotate-90">
            <circle 
              cx="64" cy="64" r="60" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="4" 
              strokeDasharray="377" 
              strokeDashoffset={377 - (377 * percentage) / 100} 
              className="text-indigo-600 transition-all duration-1000 ease-out" 
            />
          </svg>
          <div className="text-center">
            <div className="text-4xl font-black text-slate-900 leading-none">{percentage}<span className="text-xl text-slate-400">%</span></div>
            <div className="text-[10px] uppercase tracking-widest font-bold text-indigo-600 mt-1">Accuracy</div>
          </div>
        </div>

        <div className="w-full space-y-8">
          {/* Nodes Completed */}
          {recap.nodes_completed.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-widest font-black text-slate-400 mb-4 border-b border-slate-100 pb-2">Milestones Hit</h3>
              <ul className="space-y-3">
                {recap.nodes_completed.map((node, idx) => (
                  <li key={idx} className="flex items-center gap-3 text-slate-700 font-medium">
                    <CheckCircle2 size={18} className="text-emerald-500" />
                    {node}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Weaknesses */}
          {recap.weaknesses && recap.weaknesses.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-widest font-black text-slate-400 mb-4 border-b border-slate-100 pb-2">Focus Areas</h3>
              <ul className="space-y-3">
                {recap.weaknesses.map((w, idx) => (
                  <li key={idx} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex gap-3">
                    <TrendingDown size={18} className="text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-sm text-slate-900 font-bold mb-1">{w.skill_id}</strong>
                      {w.last_raw && <p className="text-sm text-slate-600 leading-relaxed">{w.last_raw}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <button 
          className="w-full mt-10 py-5 rounded-2xl bg-slate-900 text-white font-black text-sm transition-all hover:bg-indigo-600 active:scale-95"
          onClick={onClose}
        >
          Return to Path
        </button>
      </div>
    </div>,
    document.body
  );
}
