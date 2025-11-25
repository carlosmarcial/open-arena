/**
 * ExitPlanPopover Component
 * Compact inline popover to display exit plan details near the VIEW button
 */

'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { ExitPlan } from '@/types';
import { formatCurrency } from '@/lib/utils';

const formatCurrencySafe = (value?: number | null) =>
  value == null ? '—' : formatCurrency(value);

interface ExitPlanPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  exitPlan: ExitPlan;
  symbol: string;
  side: 'LONG' | 'SHORT';
  anchorEl: HTMLElement | null;
}

export function ExitPlanPopover({ isOpen, onClose, exitPlan, symbol, side, anchorEl }: ExitPlanPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node) && 
          anchorEl && !anchorEl.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, anchorEl]);

  if (!isOpen || !anchorEl) return null;

  // Calculate position relative to anchor element
  const rect = anchorEl.getBoundingClientRect();
  const popoverWidth = 320;
  const viewportWidth = window.innerWidth;
  
  // Position popover to the left of button if it would overflow right edge
  let leftPosition = rect.left;
  if (rect.left + popoverWidth > viewportWidth - 20) {
    leftPosition = rect.right - popoverWidth;
  }
  
  const popoverStyle: React.CSSProperties = {
    position: 'fixed',
    top: rect.bottom + 8,
    left: Math.max(10, leftPosition), // Ensure at least 10px from left edge
    zIndex: 1000,
  };

  return (
    <>
      {/* Backdrop (invisible, just for click detection) */}
      <div
        className="fixed inset-0 z-[999]"
        onClick={onClose}
      />

      {/* Popover */}
      <div 
        ref={popoverRef}
        style={popoverStyle}
        className="z-[1000] w-[320px] animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="bg-card/95 backdrop-blur-md border border-border rounded-md shadow-lg overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between bg-muted/50 px-3 py-2 border-b border-border">
            <div className="text-xs font-bold">
              Exit Plan:
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-0.5 hover:bg-muted transition-colors"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-3 space-y-2 text-xs">
            {/* Target */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Target:</span>
              <span className="font-mono font-semibold text-green-600">
                {formatCurrencySafe(exitPlan.target)}
              </span>
            </div>

            {/* Stop */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Stop:</span>
              <span className="font-mono font-semibold text-red-600">
                {formatCurrencySafe(exitPlan.stop)}
              </span>
            </div>

            {/* Invalid Condition */}
            <div className="pt-2 border-t border-border/50">
              <div className="text-[10px] text-muted-foreground mb-1">Invalid Condition:</div>
              <div className="text-[11px] leading-relaxed text-foreground/90 bg-muted/30 rounded px-2 py-1.5">
                {exitPlan.invalidCondition}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
