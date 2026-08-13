'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface CommandItem {
  id: string;
  icon: string;
  label: string;
  sublabel: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (msg: string) => void;
  onToggleAutoListen: () => void;
  onOpenSchedule: () => void;
}

export default function CommandPalette({
  isOpen,
  onClose,
  onSend,
  onToggleAutoListen,
  onOpenSchedule,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const commands: CommandItem[] = [
    {
      id: 'briefing',
      icon: '⚡',
      label: 'Daily Briefing',
      sublabel: 'สรุปอากาศ ข่าว ผลบอล ตารางเรียน',
      action: () => { onSend('ขอ Daily Briefing สรุปภาพรวมวันนี้'); onClose(); },
    },
    {
      id: 'schedule',
      icon: '📅',
      label: 'The Hit List',
      sublabel: 'เปิดตารางเรียน Executive Dashboard',
      action: () => { onOpenSchedule(); onClose(); },
    },
    {
      id: 'schedule-today',
      icon: '📌',
      label: 'Today\'s Agenda',
      sublabel: 'เช็คคาบเรียนวันนี้',
      action: () => { onSend('วันนี้มีเรียนอะไรบ้าง?'); onClose(); },
    },
    {
      id: 'venture',
      icon: '⏳',
      label: 'New Venture',
      sublabel: 'บันทึกกำหนดส่งงาน สอบ หรือ deadline',
      action: () => { onSend('บันทึกกำหนดส่งรายงาน'); onClose(); },
    },
    {
      id: 'spotify',
      icon: '🎵',
      label: 'Spotify Vibe',
      sublabel: 'เปิดเพลงบน Spotify',
      action: () => { onSend('เปิดเพลง Lo-Fi บน Spotify'); onClose(); },
    },
    {
      id: 'spotify-phonk',
      icon: '🎧',
      label: 'Phonk Mode',
      sublabel: 'เปิด Phonk / Trap beats',
      action: () => { onSend('เปิดเพลง Phonk บน Spotify'); onClose(); },
    },
    {
      id: 'handsfree',
      icon: '🎤',
      label: 'Hands-Free Toggle',
      sublabel: 'เปิด/ปิดโหมดพูดต่อเนื่อง',
      action: () => { onToggleAutoListen(); onClose(); },
    },
    {
      id: 'weather',
      icon: '🌤️',
      label: 'Weather Check',
      sublabel: 'เช็คสภาพอากาศกรุงเทพวันนี้',
      action: () => { onSend('สภาพอากาศกรุงเทพวันนี้เป็นยังไง?'); onClose(); },
    },
    {
      id: 'news',
      icon: '📰',
      label: 'News Intel',
      sublabel: 'ข่าวเด่นวันนี้ 3 เรื่อง',
      action: () => { onSend('ข่าวเด่นวันนี้ 3 เรื่อง'); onClose(); },
    },
    {
      id: 'pl',
      icon: '⚽',
      label: 'Premier League',
      sublabel: 'ผลบอลพรีเมียร์ลีกล่าสุด',
      action: () => { onSend('ผลบอลพรีเมียร์ลีกล่าสุด'); onClose(); },
    },
  ];

  // Filter commands by query
  const filtered = query.trim()
    ? commands.filter(
        (c) =>
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          c.sublabel.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  // Reset active index when query or open state changes
  useEffect(() => {
    setActiveIndex(0);
  }, [query, isOpen]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector('[data-active="true"]');
    if (active) {
      active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeIndex]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[activeIndex]) {
          filtered[activeIndex].action();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [filtered, activeIndex, onClose]
  );

  // Click outside to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.80)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        animation: 'fadeIn 0.15s ease-out',
      }}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/[0.12] shadow-2xl"
        style={{
          background: 'linear-gradient(145deg, rgba(20, 20, 24, 0.95), rgba(10, 10, 14, 0.98))',
          boxShadow: '0 25px 60px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)',
          animation: 'slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input */}
        <div className="flex items-center px-4 border-b border-white/[0.08]">
          <svg
            className="w-4 h-4 text-slate-500 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands..."
            className="flex-1 bg-transparent px-3 py-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-500 bg-white/[0.06] border border-white/[0.1]">
            ESC
          </kbd>
        </div>

        {/* Command List */}
        <div ref={listRef} className="max-h-[340px] overflow-y-auto py-2 scrollbar-hide">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-slate-500">
              No commands found for &quot;{query}&quot;
            </div>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                data-active={i === activeIndex}
                onClick={cmd.action}
                onMouseEnter={() => setActiveIndex(i)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  i === activeIndex
                    ? 'bg-white/[0.07]'
                    : 'hover:bg-white/[0.04]'
                }`}
              >
                <span className="text-base flex-shrink-0 w-7 text-center">{cmd.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-medium truncate ${
                    i === activeIndex ? 'text-white' : 'text-slate-300'
                  }`}>
                    {cmd.label}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate mt-0.5">
                    {cmd.sublabel}
                  </div>
                </div>
                {i === activeIndex && (
                  <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-500 bg-white/[0.06] border border-white/[0.08]">
                    ↵
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/[0.08]">
          <div className="flex items-center gap-3 text-[10px] text-slate-600">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-white/[0.05] border border-white/[0.08] font-mono">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-white/[0.05] border border-white/[0.08] font-mono">↵</kbd>
              select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-white/[0.05] border border-white/[0.08] font-mono">esc</kbd>
              close
            </span>
          </div>
          <span className="text-[10px] text-slate-600 tracking-wider">V1CTOR CMD</span>
        </div>
      </div>
    </div>
  );
}
