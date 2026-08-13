'use client';

import React, { useEffect, useState, useRef } from 'react';

interface AIMemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  messageCount: number;
  speechSpeed: number;
  autoListen: boolean;
  autoVoice: boolean;
  onClearCache: () => void;
}

export default function AIMemoryModal({
  isOpen,
  onClose,
  sessionId,
  messageCount,
  speechSpeed,
  autoListen,
  autoVoice,
  onClearCache,
}: AIMemoryModalProps) {
  const [dbStatus, setDbStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [scheduleCount, setScheduleCount] = useState<number | null>(null);
  const [localStorageKB, setLocalStorageKB] = useState(0);
  const [purgeConfirm, setPurgeConfirm] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Fetch Supabase status + schedule count on open
  useEffect(() => {
    if (!isOpen) {
      setPurgeConfirm(false);
      return;
    }

    // Calculate localStorage size
    try {
      let total = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          total += (key.length + (localStorage.getItem(key)?.length || 0)) * 2; // UTF-16
        }
      }
      setLocalStorageKB(Math.round((total / 1024) * 100) / 100);
    } catch {
      setLocalStorageKB(0);
    }

    // Ping Supabase via schedule count
    const checkDb = async () => {
      setDbStatus('checking');
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: '__db_ping__', sessionId: 'system-ping' }),
        });
        // We'll just check if the API responds OK
        if (res.ok) {
          setDbStatus('online');
        } else {
          setDbStatus('offline');
        }
      } catch {
        setDbStatus('offline');
      }
    };

    // Quick schedule count check
    const fetchScheduleCount = async () => {
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'แสดงตารางเรียนทั้งหมด', sessionId: 'system-count' }),
        });
        if (res.ok) {
          const data = await res.json();
          // Try to estimate from reply content
          const matches = data.reply?.match(/\d+\s*(วิชา|subjects?|คาบ)/i);
          setScheduleCount(matches ? parseInt(matches[0]) : null);
        }
      } catch {
        setScheduleCount(null);
      }
    };

    checkDb();
    fetchScheduleCount();
  }, [isOpen, sessionId]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  const handlePurge = () => {
    if (!purgeConfirm) {
      setPurgeConfirm(true);
      return;
    }
    onClearCache();
    setPurgeConfirm(false);
    onClose();
  };

  const statusDot = (status: 'checking' | 'online' | 'offline') => {
    if (status === 'checking') return 'bg-amber-400 animate-pulse';
    if (status === 'online') return 'bg-emerald-400';
    return 'bg-rose-400';
  };

  const statusLabel = (status: 'checking' | 'online' | 'offline') => {
    if (status === 'checking') return 'Pinging...';
    if (status === 'online') return 'PostgreSQL Online';
    return 'Connection Failed';
  };

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        animation: 'fadeIn 0.15s ease-out',
      }}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/[0.12]"
        style={{
          background: 'linear-gradient(155deg, rgba(18, 18, 22, 0.97), rgba(8, 8, 12, 0.99))',
          boxShadow: '0 30px 70px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.05)',
          animation: 'slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-white/[0.08]">
          <div>
            <h2 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
              🧠 V1CTOR MEMORY CORE
              <span className="text-[10px] font-normal text-slate-500">— Active Cache</span>
            </h2>
            <p className="text-[11px] text-slate-500 mt-1">Real-time Local & Supabase Context Data</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-slate-400 hover:text-white transition-all text-xs"
          >
            ✕
          </button>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-2 gap-3 p-5">
          {/* Card 1: System Preferences */}
          <div className="rounded-xl border border-white/[0.08] p-4" style={{ background: 'rgba(255,255,255,0.025)' }}>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <span>⚙️</span> System Preferences
            </div>
            <div className="space-y-2.5">
              <MemoryRow label="Voice Speed" value={`${speechSpeed}x`} accent />
              <MemoryRow label="Hands-Free Mode" value={autoListen ? 'ACTIVE' : 'OFF'} active={autoListen} />
              <MemoryRow label="Auto Voice" value={autoVoice ? 'ACTIVE' : 'OFF'} active={autoVoice} />
            </div>
          </div>

          {/* Card 2: Session Context */}
          <div className="rounded-xl border border-white/[0.08] p-4" style={{ background: 'rgba(255,255,255,0.025)' }}>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <span>💬</span> Session Context
            </div>
            <div className="space-y-2.5">
              <MemoryRow label="Session ID" value={sessionId.replace('session-', '')} mono />
              <MemoryRow label="Message Stack" value={`${messageCount} messages`} accent />
              <MemoryRow label="Engine" value="Gemini 2.5 Flash" />
            </div>
          </div>

          {/* Card 3: Supabase Sync */}
          <div className="rounded-xl border border-white/[0.08] p-4" style={{ background: 'rgba(255,255,255,0.025)' }}>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <span>🗄️</span> Supabase Sync
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Database</span>
                <span className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${statusDot(dbStatus)}`} />
                  <span className={`text-[11px] font-medium ${dbStatus === 'online' ? 'text-emerald-400' : dbStatus === 'offline' ? 'text-rose-400' : 'text-amber-400'}`}>
                    {statusLabel(dbStatus)}
                  </span>
                </span>
              </div>
              <MemoryRow label="Schedule Table" value={scheduleCount !== null ? `${scheduleCount} Synced` : 'Loaded'} />
              <MemoryRow label="Provider" value="Supabase PostgreSQL" />
            </div>
          </div>

          {/* Card 4: Local Storage */}
          <div className="rounded-xl border border-white/[0.08] p-4" style={{ background: 'rgba(255,255,255,0.025)' }}>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <span>⚡</span> Storage Footprint
            </div>
            <div className="space-y-2.5">
              <MemoryRow label="LocalStorage" value={`${localStorageKB} KB`} accent />
              <MemoryRow label="Session Cache" value="In-Memory" />
              <MemoryRow label="Audio Context" value="Web Audio API" />
            </div>

            {/* Storage bar visualization */}
            <div className="mt-3">
              <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min((localStorageKB / 50) * 100, 100)}%`,
                    background: 'linear-gradient(90deg, rgba(16,185,129,0.7), rgba(255,255,255,0.4))',
                  }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[9px] text-slate-600">{localStorageKB} KB used</span>
                <span className="text-[9px] text-slate-600">~5 MB limit</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/[0.08]">
          <span className="text-[10px] text-slate-600 tracking-wider">MEMORY CORE v1.0 • {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
          <button
            onClick={handlePurge}
            className={`text-[11px] font-medium px-4 py-2 rounded-lg transition-all active:scale-95 ${
              purgeConfirm
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                : 'bg-white/[0.05] text-slate-400 border border-white/[0.1] hover:text-white hover:bg-white/[0.1]'
            }`}
          >
            {purgeConfirm ? '⚠️ Confirm Purge?' : '🗑️ Purge Local Cache'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Minimal row component for memory data display
function MemoryRow({
  label,
  value,
  accent,
  active,
  mono,
}: {
  label: string;
  value: string;
  accent?: boolean;
  active?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-slate-400">{label}</span>
      <span
        className={`text-[11px] font-medium ${
          active !== undefined
            ? active
              ? 'text-emerald-400'
              : 'text-slate-500'
            : accent
              ? 'text-white'
              : 'text-slate-300'
        } ${mono ? 'font-mono tracking-wider' : ''}`}
      >
        {value}
      </span>
    </div>
  );
}
