'use client';

import Image from 'next/image';
import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAIModelLogo, shouldInvertAIModelLogo } from '@/lib/utils/logos';

interface WalletOption {
  id: string;
  name: string;
  address: string;
  color: string;
  apiModel: string;
}

interface WalletDropdownProps {
  wallets: WalletOption[];
}

export function WalletDropdown({ wallets }: WalletDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownMenuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
    maxHeight: number;
    origin: 'top' | 'bottom';
  } | null>(null);

  const MENU_WIDTH = 280;
  const MENU_PADDING = 12;
  const MENU_SPACING = 6;
  const MENU_MAX_HEIGHT = 320;
  const MENU_MIN_HEIGHT = 160;

  useLayoutEffect(() => {
    if (!isOpen || !dropdownRef.current) {
      return;
    }

    const updatePosition = () => {
      const rect = dropdownRef.current?.getBoundingClientRect();
      if (!rect) return;

      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      const constrainedLeft = Math.min(
        Math.max(rect.left, MENU_PADDING),
        viewportWidth - MENU_WIDTH - MENU_PADDING
      );

      const desiredTop = rect.bottom + MENU_SPACING;
      const availableBelow = viewportHeight - desiredTop - MENU_PADDING;
      let top = desiredTop;
      let origin: 'top' | 'bottom' = 'top';
      let maxHeight = Math.min(MENU_MAX_HEIGHT, availableBelow);

      if (maxHeight < MENU_MIN_HEIGHT) {
        const availableAbove = rect.top - MENU_SPACING - MENU_PADDING;
        const heightAbove = Math.min(MENU_MAX_HEIGHT, availableAbove);
        if (heightAbove > maxHeight) {
          maxHeight = Math.max(heightAbove, MENU_MIN_HEIGHT / 2);
          top = Math.max(
            MENU_PADDING,
            rect.top - maxHeight - MENU_SPACING
          );
          origin = 'bottom';
        } else {
          maxHeight = Math.max(maxHeight, MENU_MIN_HEIGHT / 2);
        }
      }

      setMenuPosition({
        top,
        left: constrainedLeft,
        maxHeight: Math.max(120, maxHeight),
        origin,
      });
    };

    updatePosition();

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideTrigger = dropdownRef.current?.contains(target);
      const clickedInsideMenu = dropdownMenuRef.current?.contains(target);
      if (!clickedInsideTrigger && !clickedInsideMenu) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleCopyAddress = async (address: string, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }

    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 2000);
      // Don't close the dropdown - let user copy multiple addresses if needed
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  const isDeepSeek = (apiModel?: string) => apiModel?.toLowerCase().includes('deepseek');
  const isQwen = (apiModel?: string) => {
    const normalized = apiModel?.toLowerCase();
    return normalized?.includes('qwen') || normalized?.includes('alibaba');
  };
  const isLargerLogo = (apiModel?: string) => isDeepSeek(apiModel) || isQwen(apiModel);

  return (
  <div className="relative" ref={dropdownRef}>
  {/* Trigger Button */}
  <button
  onClick={(e) => {
    e.stopPropagation();
  setIsOpen(!isOpen);
  }}
  className={cn(
  'flex items-center gap-2 rounded border border-border bg-card px-3 py-1.5',
  'text-[10px] font-medium uppercase tracking-wide text-foreground',
    'transition-colors hover:bg-muted/50',
      'focus:outline-none focus:ring-1 focus:ring-primary',
    'min-w-[180px] justify-between'
  )}
  >
  <span className="truncate">Public Wallets</span>
  <ChevronDown
  className={cn(
      'h-3 w-3 shrink-0 transition-transform duration-200',
        isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && dropdownRef.current && createPortal(
      <div
        className={cn(
          'fixed z-[9999] w-[280px]',
          'rounded-md border border-border shadow-lg',
          'bg-card/95 backdrop-blur-md',
          'animate-in fade-in-0 zoom-in-95 duration-200'
        )}
        ref={dropdownMenuRef}
        style={{
        top: menuPosition?.top ?? dropdownRef.current.getBoundingClientRect().bottom + 4,
      left: menuPosition?.left ?? dropdownRef.current.getBoundingClientRect().left,
      transformOrigin: menuPosition?.origin === 'bottom' ? 'bottom' : 'top',
      }}
      >
      <div
      className="p-2 overflow-y-auto"
      style={{ maxHeight: menuPosition?.maxHeight ?? MENU_MAX_HEIGHT }}
      >
            {/* Header */}
      <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground border-b border-border">
        AI Model Wallets (BNB Chain)
      </div>

      {/* Wallet Options */}
      {wallets.map((wallet) => {
      const logo = getAIModelLogo(wallet.apiModel);
              const largerLogo = isLargerLogo(wallet.apiModel);
      const deepSeek = isDeepSeek(wallet.apiModel);
      const qwen = isQwen(wallet.apiModel);
      const isCopied = copiedAddress === wallet.address;

      return (
      <div
      key={wallet.id}
      onClick={(e) => {
        e.stopPropagation();
        handleCopyAddress(wallet.address);
      }}
      className={cn(
          'flex w-full items-center gap-2.5 px-3 py-2.5 text-left rounded-md group',
        'text-[11px] font-medium tracking-wide text-foreground',
        'transition-colors duration-200 cursor-pointer hover:bg-muted/50'
      )}
      >
      {/* Model Logo */}
      <div className="flex h-5 w-5 shrink-0 items-center justify-center pointer-events-none">
      {logo ? (
      <Image
      src={logo}
      alt={wallet.name}
      width={deepSeek || qwen ? 24 : 18}
      height={deepSeek || qwen ? 24 : 18}
      className={cn(
        deepSeek || qwen ? 'h-6 w-6' : 'h-[18px] w-[18px]',
          'object-contain',
            shouldInvertAIModelLogo(wallet.apiModel) && 'invert-on-dark'
        )}
          unoptimized
          />
                    ) : (
          <span className="text-sm">🤖</span>
        )}
      </div>

      {/* Model Name */}
      <div className="flex-1 min-w-0 pointer-events-none">
      <div className="font-semibold text-[10px]" style={{ color: wallet.color }}>
        {wallet.name}
        </div>
                    <div className="text-[9px] font-mono text-muted-foreground truncate">
          {wallet.address}
        </div>
      </div>

      {/* Copy Icon */}
      <div className="flex h-5 w-5 shrink-0 items-center justify-center pointer-events-none">
      {isCopied ? (
          <Check className="h-3 w-3 text-green-500 animate-in fade-in duration-200" />
          ) : (
              <Copy className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-colors" />
              )}
              </div>
              </div>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
