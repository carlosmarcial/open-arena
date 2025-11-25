/**
 * ExitPlanModal Component
 * Displays exit plan details for a position (target, stop, invalid condition)
 */

'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { ExitPlan } from '@/types';
import { formatCurrency } from '@/lib/utils';

const formatCurrencySafe = (value?: number | null) =>
  value == null ? '—' : formatCurrency(value);

interface ExitPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  exitPlan: ExitPlan;
  symbol: string;
  side: 'LONG' | 'SHORT';
}

export function ExitPlanModal({ isOpen, onClose, exitPlan, symbol, side }: ExitPlanModalProps) {
  // Close on ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden'; // Prevent background scroll
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 animate-in fade-in zoom-in-95 duration-200 p-4">
        <div className="relative bg-card border border-border rounded-lg shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-6 py-4">
            <div>
              <h3 className="text-lg font-bold">Exit Plan</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                {symbol} • <span className={side === 'LONG' ? 'text-green-600' : 'text-red-600'}>{side}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 hover:bg-muted/50 transition-colors"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5">
            {/* Target Price */}
            <div className="flex items-center justify-between pb-4 border-b border-border/50">
              <div>
                <p className="text-sm text-muted-foreground uppercase tracking-wide">Target:</p>
                <p className="text-2xl font-bold text-green-600 font-mono mt-1">
                  {formatCurrencySafe(exitPlan.target)}
                </p>
              </div>
              <div className="text-right">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-600">
                  TAKE PROFIT
                </div>
              </div>
            </div>

            {/* Stop Loss */}
            <div className="flex items-center justify-between pb-4 border-b border-border/50">
              <div>
                <p className="text-sm text-muted-foreground uppercase tracking-wide">Stop:</p>
                <p className="text-2xl font-bold text-red-600 font-mono mt-1">
                  {formatCurrencySafe(exitPlan.stop)}
                </p>
              </div>
              <div className="text-right">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-600">
                  STOP LOSS
                </div>
              </div>
            </div>

            {/* Invalid Condition */}
            <div>
              <p className="text-sm text-muted-foreground uppercase tracking-wide mb-2">Invalid Condition:</p>
              <div className="rounded-md bg-muted/30 border border-border/50 p-4">
                <p className="text-sm leading-relaxed text-foreground/90">
                  {exitPlan.invalidCondition}
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-border bg-muted/20 px-6 py-3">
            <button
              onClick={onClose}
              className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
