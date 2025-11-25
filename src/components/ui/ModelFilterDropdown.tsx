'use client';

import Image from 'next/image';
import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAIModelLogo, shouldInvertAIModelLogo } from '@/lib/utils/logos';

interface ModelOption {
  id: string;
  name: string;
  icon: string;
  api_model: string;
}

interface ModelFilterDropdownProps {
  models: ModelOption[];
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
}

export function ModelFilterDropdown({ models, selectedModelId, onSelectModel }: ModelFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedModel = selectedModelId === 'all' 
    ? { id: 'all', name: 'All Models', icon: '', api_model: '' }
    : models.find(m => m.id === selectedModelId);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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

  const handleSelect = (modelId: string) => {
    onSelectModel(modelId);
    setIsOpen(false);
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
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 rounded border border-border bg-card px-3 py-1.5',
          'text-[10px] font-medium uppercase tracking-wide text-foreground',
          'transition-colors hover:bg-muted/50',
          'focus:outline-none focus:ring-1 focus:ring-primary',
          'min-w-[140px] justify-between'
        )}
      >
        <span className="truncate">{selectedModel?.name || 'Select Model'}</span>
        <ChevronDown 
          className={cn(
            'h-3 w-3 shrink-0 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          className={cn(
            'absolute top-full left-0 z-50 mt-1 w-[200px]',
            'rounded-md border border-border shadow-lg',
            'bg-card/95 backdrop-blur-md',
            'animate-in fade-in-0 zoom-in-95 duration-200'
          )}
        >
          <div className="p-2 max-h-[280px] overflow-y-auto">
            {/* All Models Option */}
            <button
              onClick={() => handleSelect('all')}
              className={cn(
                'flex w-full items-center gap-2.5 px-3 py-2 text-left',
                'text-[11px] font-medium tracking-wide text-foreground',
                'transition-colors duration-150 cursor-pointer',
                selectedModelId === 'all' && 'font-semibold'
              )}
            >
              <span>All Models</span>
            </button>

            {/* Divider */}
            <div className="my-1 h-px bg-border" />

            {/* Model Options */}
            {models.map((model) => {
              const logo = getAIModelLogo(model.api_model);
              const largerLogo = isLargerLogo(model.api_model);
              const deepSeek = isDeepSeek(model.api_model);
              const qwen = isQwen(model.api_model);

              return (
                <button
                  key={model.id}
                  onClick={() => handleSelect(model.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 px-3 py-2 text-left rounded-md',
                    'text-[11px] font-medium tracking-wide text-foreground',
                    'transition-colors duration-200 cursor-pointer',
                    selectedModelId === model.id && 'font-semibold'
                  )}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = document.documentElement.classList.contains('dark') ? '#334155' : '#ebe9e0';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '';
                  }}
                >
                  {/* Model Logo */}
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                    {logo ? (
                      <Image
                        src={logo}
                        alt={model.name}
                        width={deepSeek ? 24 : (qwen ? 22 : 18)}
                        height={deepSeek ? 24 : (qwen ? 22 : 18)}
                        className={cn(
                          deepSeek ? 'h-6 w-6' : (qwen ? 'h-[22px] w-[22px]' : 'h-[18px] w-[18px]'),
                          'object-contain',
                          shouldInvertAIModelLogo(model.api_model) && 'invert-on-dark'
                        )}
                        unoptimized
                      />
                    ) : (
                      <span className="text-sm">{model.icon}</span>
                    )}
                  </div>
                  <span className="truncate">{model.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
