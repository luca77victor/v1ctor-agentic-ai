'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import AudioVisualizer from './components/AudioVisualizer';
import CommandPalette from './components/CommandPalette';
import AIMemoryModal from './components/AIMemoryModal';

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  spotifyUrl?: string;
  spotifyEmbedUrl?: string;
}

export default function JarvisFramelessUI() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoVoice, setAutoVoice] = useState(true);
  const [speechSpeed, setSpeechSpeed] = useState<number>(1.0);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [autoListen, setAutoListen] = useState(false);
  const autoListenRef = useRef<boolean>(false);
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showMemoryModal, setShowMemoryModal] = useState(false);
  const [sessionId] = useState('session-' + Math.random().toString(36).substring(2, 9));

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const pendingVoiceRef = useRef<string | null>(null);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);

  // Fix mic: use ref to avoid stale closure on handleSend
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'th-TH';

        recognition.onstart = () => setIsListening(true);
        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInput(transcript);
          pendingVoiceRef.current = transcript; // store for effect pickup
          setIsListening(false);
        };
        recognition.onerror = (e: any) => {
          console.error('SpeechRecognition error:', e.error);
          setIsListening(false);
        };
        recognition.onend = () => setIsListening(false);

        recognitionRef.current = recognition;
      }
    }
  }, []);

  // Trigger send after voice result lands
  useEffect(() => {
    if (!isListening && pendingVoiceRef.current) {
      const msg = pendingVoiceRef.current;
      pendingVoiceRef.current = null;
      handleSend(msg);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Close settings dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };
    if (showSettings) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSettings]);

  // Global Ctrl+K / Cmd+K listener for Command Palette
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
    };
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Dark Executive Male Voice (Web Audio API pitch shifted to deep male tone)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const cancelledRef = useRef<boolean>(false);

  // Keep autoListenRef in sync with autoListen state
  useEffect(() => {
    autoListenRef.current = autoListen;
  }, [autoListen]);

  const stopSpeaking = () => {
    cancelledRef.current = true;
    if (activeSourceRef.current) {
      try { activeSourceRef.current.stop(); } catch {}
      activeSourceRef.current = null;
    }
    setIsSpeaking(false);
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  const speakText = async (text: string) => {
    const cleanText = text.replace(/[*#_`]/g, '').trim();
    if (!cleanText) return;

    cancelledRef.current = false;

    // Stop current playback
    if (activeSourceRef.current) {
      try { activeSourceRef.current.stop(); } catch {}
      activeSourceRef.current = null;
    }
    setIsSpeaking(false);

    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioCtx();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // Split text into readable chunks
    const chunks: string[] = [];
    let remaining = cleanText;
    while (remaining.length > 0) {
      const slice = remaining.slice(0, 200);
      const breakAt = Math.max(
        slice.lastIndexOf('.'), slice.lastIndexOf('!'),
        slice.lastIndexOf('?'), slice.lastIndexOf('\n'),
        slice.lastIndexOf(' ')
      );
      const cut = (breakAt > 80) ? breakAt + 1 : slice.length;
      chunks.push(remaining.slice(0, cut).trim());
      remaining = remaining.slice(cut).trim();
    }

    let idx = 0;
    const playNext = async () => {
      if (cancelledRef.current || idx >= chunks.length) {
        setIsSpeaking(false);
        // Auto-Listen: re-open mic after speech finishes
        if (!cancelledRef.current && idx >= chunks.length && autoListenRef.current) {
          setTimeout(() => {
            toggleListening();
          }, 400);
        }
        return;
      }

      try {
        const url = `/api/tts?q=${encodeURIComponent(chunks[idx])}`;
        const res = await fetch(url);
        if (!res.ok || cancelledRef.current) { setIsSpeaking(false); return; }

        const arrayBuf = await res.arrayBuffer();
        if (cancelledRef.current) { setIsSpeaking(false); return; }
        
        const audioBuf = await ctx.decodeAudioData(arrayBuf);
        if (cancelledRef.current) { setIsSpeaking(false); return; }

        const source = ctx.createBufferSource();
        source.buffer = audioBuf;
        
        // Strong Pitch shift down to deep male voice (-600 cents = 6 semitones lower)
        source.detune.value = -600;
        source.playbackRate.value = speechSpeed;

        source.connect(ctx.destination);
        activeSourceRef.current = source;

        source.onended = () => {
          idx++;
          if (!cancelledRef.current) {
            playNext();
          } else {
            setIsSpeaking(false);
          }
        };

        setIsSpeaking(true);
        source.start();
      } catch (e) {
        console.error('Audio playback error:', e);
        setIsSpeaking(false);
      }
    };

    playNext();
  };



  const showSystemMsg = (text: string) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'model',
      content: text,
    }]);
  };

  const toggleListening = async () => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    // Check browser support
    if (typeof window === 'undefined') return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      showSystemMsg('⚠️ เบราว์เซอร์ไม่รองรับ Voice Input — กรุณาใช้ Chrome หรือ Edge');
      return;
    }

    // Re-init recognition fresh every time (avoids "already started" error)
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'th-TH';

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      pendingVoiceRef.current = transcript;
      setIsListening(false);
    };
    recognition.onerror = (e: any) => {
      console.error('Speech error:', e.error);
      if (e.error === 'not-allowed') {
        showSystemMsg('⚠️ ไม่ได้รับอนุญาตใช้ Microphone — กรุณาคลิก Allow ที่ Address Bar แล้วลองใหม่');
      } else if (e.error === 'no-speech') {
        showSystemMsg('⚠️ ไม่ได้ยินเสียง — ลองพูดให้ชัดขึ้นแล้วลองใหม่');
      }
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;

    // Request mic permission explicitly first
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicStream(mediaStream);
    } catch {
      showSystemMsg('⚠️ ไม่สามารถเข้าถึง Microphone ได้ — กรุณาอนุญาตการเข้าถึงไมโครโฟนก่อน');
      return;
    }

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }

    try {
      recognition.start();
    } catch (e) {
      console.error('Recognition start failed:', e);
      setIsListening(false);
    }
  };

  const handleSend = async (customMessage?: string) => {
    const textToSend = customMessage || input;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customMessage) setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend, sessionId }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.success === false) {
        const errorDetail = data.error || data.message || `เซิร์ฟเวอร์ตอบกลับรหัส ${response.status}`;
        throw new Error(errorDetail);
      }

      if (data.spotifyAppUrl && typeof window !== 'undefined') {
        try {
          window.location.href = data.spotifyAppUrl;
        } catch {
          window.open(data.spotifyUrl, '_blank');
        }
      } else if (data.spotifyUrl && typeof window !== 'undefined') {
        window.open(data.spotifyUrl, '_blank');
      }

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: data.reply,
        spotifyUrl: data.spotifyUrl || undefined,
        spotifyAppUrl: data.spotifyAppUrl || undefined,
        spotifyEmbedUrl: data.spotifyEmbedUrl || undefined,
      };

      setMessages((prev) => [...prev, botMsg]);

      if (autoVoice) {
        speakText(data.reply);
      }
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'model',
          content: `⚠️ เกิดข้อผิดพลาด: ${error.message}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col font-sans relative selection:bg-cyan-500 selection:text-white overflow-hidden">
      {/* Subtle ambient background for black theme */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] bg-white/[0.02] rounded-full blur-[160px]"></div>
        <div className="absolute top-[40%] right-[-10%] w-[400px] h-[400px] bg-white/[0.015] rounded-full blur-[180px]"></div>
        <div className="absolute bottom-[-10%] left-[20%] w-[500px] h-[500px] bg-white/[0.02] rounded-full blur-[200px]"></div>
      </div>

      {/* Frameless Minimal Header */}
      <header className="sticky top-0 z-20 px-6 py-5">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          {/* Clickable Logo → goes back to home */}
          <button
            onClick={() => {
              stopSpeaking();
              setMessages([]);
              setInput('');
            }}
            className="flex items-center space-x-3 group transition-opacity hover:opacity-75 active:opacity-50 cursor-pointer"
            title="ตัดเสียงและกลับหน้าแรก"
          >
            <div className={`logo-sparkle-wrap rounded-2xl transition-all ${isSpeaking || isListening ? 'voice-active-glow' : ''}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/v1ctor_logo.png"
                alt="V1CTOR"
                className="relative z-10 h-14 w-auto object-contain"
              />
            </div>
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleSend('ขอ Daily Briefing สรุปภาพรวมวันนี้')}
              className="text-xs font-medium text-emerald-300 hover:text-white transition-all px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 active:scale-95 flex items-center space-x-1"
              title="สรุปภาพรวมประจำวัน"
            >
              <span>⚡ Briefing</span>
            </button>

            <button
              onClick={() => {
                setShowScheduleModal(true);
                handleSend('แสดงตารางเรียนทั้งหมด');
              }}
              className="text-xs font-medium text-slate-300 hover:text-white transition-all px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/10 hover:bg-white/[0.1] active:scale-95 flex items-center space-x-1"
              title="ดูตารางเรียนทั้งหมด"
            >
              <span>📅 ตารางเรียน</span>
            </button>

            {/* Settings Gear Button */}
            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                  showSettings
                    ? 'bg-white/15 text-white border border-white/30'
                    : 'bg-white/[0.05] text-slate-400 border border-white/10 hover:text-white hover:bg-white/10'
                }`}
                title="ตั้งค่า"
              >
                ⚙️
              </button>

              {/* Settings Dropdown */}
              {showSettings && (
                <div className="absolute right-0 top-12 w-56 liquid-glass-card rounded-2xl border border-white/20 shadow-2xl py-2 z-50 animate-fadeIn">
                  <div className="px-4 py-2 border-b border-white/10">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Settings</span>
                  </div>

                  {/* Voice Speed */}
                  <button
                    onClick={() => {
                      const nextSpeed = speechSpeed === 1.0 ? 1.25 : speechSpeed === 1.25 ? 0.85 : 1.0;
                      setSpeechSpeed(nextSpeed);
                    }}
                    className="w-full px-4 py-3 flex items-center justify-between text-xs text-slate-200 hover:bg-white/[0.07] transition-colors"
                  >
                    <span>⚡ ความเร็วเสียง</span>
                    <span className="text-emerald-400 font-semibold">{speechSpeed}x</span>
                  </button>

                  {/* Auto-Listen */}
                  <button
                    onClick={() => {
                      const next = !autoListen;
                      setAutoListen(next);
                      if (!next && isListening) {
                        recognitionRef.current?.stop();
                      }
                    }}
                    className="w-full px-4 py-3 flex items-center justify-between text-xs text-slate-200 hover:bg-white/[0.07] transition-colors"
                  >
                    <span>🎤 Hands-Free Mode</span>
                    <span className={`font-semibold ${autoListen ? 'text-emerald-400' : 'text-slate-500'}`}>{autoListen ? 'ON' : 'OFF'}</span>
                  </button>

                  {/* Auto Voice */}
                  <button
                    onClick={() => setAutoVoice(!autoVoice)}
                    className="w-full px-4 py-3 flex items-center justify-between text-xs text-slate-200 hover:bg-white/[0.07] transition-colors"
                  >
                    <span>🔊 เสียงตอบอัตโนมัติ</span>
                    <span className={`font-semibold ${autoVoice ? 'text-emerald-400' : 'text-slate-500'}`}>{autoVoice ? 'ON' : 'OFF'}</span>
                  </button>

                  {/* Memory Core */}
                  <button
                    onClick={() => {
                      setShowMemoryModal(true);
                      setShowSettings(false);
                    }}
                    className="w-full px-4 py-3 flex items-center justify-between text-xs text-slate-200 hover:bg-white/[0.07] transition-colors border-t border-white/10"
                  >
                    <span>🧠 Memory Core</span>
                    <span className="text-cyan-400 font-semibold">Inspect</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-4 pb-8 flex flex-col justify-between z-10 overflow-hidden">
        {messages.length === 0 ? (
          <div className="my-auto flex flex-col items-center text-center space-y-6">
            <div className={`logo-sparkle-wrap transition-all ${isLoading || isSpeaking || isListening ? 'cyberpunk-aura-ring voice-active-glow' : ''}`}>
              <img
                src="/v1ctor_logo.png"
                alt="V1CTOR"
                className="relative z-10 h-36 w-auto object-contain"
              />
            </div>

            <div className="space-y-2">
              <h2 className="text-3xl font-light tracking-tight text-white">
                V1CTOR Personal Assistant
              </h2>
              <p className="text-sm text-slate-500 max-w-md leading-relaxed">
                What can I help you with today?
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5 justify-center max-w-lg pt-2">
              <button
                onClick={() => handleSend('ขอ Daily Briefing สรุปภาพรวมวันนี้')}
                className="liquid-glass-btn px-4 py-2 rounded-full text-xs text-emerald-300 border border-emerald-500/30 transition-all hover:scale-105"
              >
                ⚡ Daily Briefing สรุปวันนี้
              </button>
              <button
                onClick={() => handleSend('วันนี้มีเรียนอะไรบ้าง?')}
                className="liquid-glass-btn px-4 py-2 rounded-full text-xs text-slate-200 transition-all hover:scale-105"
              >
                📅 เช็คตารางเรียนวันนี้
              </button>
              <button
                onClick={() => handleSend('บันทึกกำหนดส่งรายงานวันศุกร์นี้')}
                className="liquid-glass-btn px-4 py-2 rounded-full text-xs text-amber-300 border border-amber-500/30 transition-all hover:scale-105"
              >
                ⏳ บันทึกกำหนดส่งงาน/สอบ
              </button>
              <button
                onClick={() => handleSend('เปิดเพลง Lo-Fi บน Spotify')}
                className="liquid-glass-btn px-4 py-2 rounded-full text-xs text-emerald-300 border border-emerald-500/30 transition-all hover:scale-105"
              >
                🎵 เปิดเพลง Lo-Fi บน Spotify
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4 custom-scrollbar">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-3xl px-5 py-3.5 text-xs md:text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'liquid-glass-bubble-user text-white rounded-br-none'
                      : 'liquid-glass-bubble-model text-slate-100 rounded-bl-none'
                  }`}
                >
                  {msg.role === 'model' && (
                    <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-white/10 text-[10px] font-semibold text-slate-300">
                      <span>🤖 V1CTOR</span>
                      <button
                        onClick={() => speakText(msg.content)}
                        className="hover:text-white transition-colors text-slate-400"
                        title="ฟังเสียง"
                      >
                        🔊 ฟังเสียง
                      </button>
                    </div>
                  )}
                  <div className="whitespace-pre-wrap">{msg.content}</div>

                  {msg.spotifyUrl && (
                    <div className="mt-3 pt-2.5 border-t border-white/10 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center space-x-2 text-xs text-emerald-400 font-semibold">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                          <span>Spotify Executive Player</span>
                        </div>
                        <span className="text-[10px] text-slate-400">ฟังเพลงเต็ม 100%</span>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-0.5">
                        <a
                          href={msg.spotifyAppUrl || msg.spotifyUrl}
                          className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full bg-emerald-500 text-black text-xs font-bold hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer"
                        >
                          <span>🟢 เปิดในแอป Spotify (เพลงเต็ม 100%)</span>
                          <span>↗</span>
                        </a>

                        <a
                          href={msg.spotifyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-full bg-white/10 text-slate-200 border border-white/15 text-xs font-medium hover:bg-white/20 transition-all"
                        >
                          <span>🌐 Spotify Web Player</span>
                        </a>
                      </div>

                      {msg.spotifyEmbedUrl && (
                        <iframe
                          src={msg.spotifyEmbedUrl}
                          width="100%"
                          height="152"
                          frameBorder="0"
                          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                          loading="lazy"
                          className="rounded-2xl shadow-2xl border border-emerald-500/30"
                        ></iframe>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="liquid-glass-bubble-model px-5 py-3 rounded-3xl text-xs text-slate-300 flex items-center space-x-3">
                  <div className="flex space-x-1.5">
                    <div className="w-2 h-2 rounded-full bg-white/70 animate-ping"></div>
                    <div className="w-2 h-2 rounded-full bg-white/50 animate-ping delay-150"></div>
                  </div>
                  <span>V1CTOR กำลังประมวลผล...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Audio Visualizer */}
        <div className="w-full max-w-3xl mx-auto mb-2">
          <AudioVisualizer
            isListening={isListening}
            isSpeaking={isSpeaking}
            stream={micStream}
          />
        </div>

        <div className="h-5 flex items-center justify-center mb-1">
          {isListening && (
            <span className="text-[11px] text-slate-500 tracking-wide animate-pulse">🎙️ Listening...</span>
          )}
          {isSpeaking && (
            <span className="text-[11px] text-slate-500 tracking-wide">🔊 Speaking...</span>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className={`liquid-glass-input rounded-full px-2 py-2 flex items-center space-x-2 transition-all ${
            isSpeaking || isListening ? 'voice-active-glow border-white/40' : ''
          }`}
        >
          {/* Mic Button */}
          <button
            type="button"
            onClick={toggleListening}
            className={`p-3 rounded-full transition-all flex-shrink-0 ${
              isListening
                ? 'bg-rose-500/80 text-white shadow-lg shadow-rose-500/40 animate-pulse'
                : 'liquid-glass-btn text-slate-300 hover:text-white'
            }`}
            title="กดเพื่อพูดสั่งงาน"
          >
            🎙️
          </button>

          {/* Input Field */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isListening ? 'กำลังฟังเสียงภาษาไทย...' : 'ถาม V1CTOR หรือพิมพ์คำสั่ง...'}
            className="flex-1 bg-transparent px-2 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="liquid-glass-btn px-5 py-2.5 rounded-full text-xs font-semibold text-white hover:text-cyan-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex-shrink-0"
          >
            ส่ง
          </button>
        </form>
      </main>

      {/* Schedule Drawer Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="liquid-glass-card max-w-lg w-full rounded-3xl p-6 relative border border-white/20 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center space-x-2">
                <span className="text-xl">📅</span>
                <h3 className="text-base font-semibold text-white">ตารางเรียน Executive Dashboard</h3>
              </div>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-3">
              <p className="text-xs text-slate-300">
                สั่งงาน V1CTOR ให้สรุปตารางเรียน หรือค้นหาเวลาว่างได้โดยตรง:
              </p>
              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={() => {
                    setShowScheduleModal(false);
                    handleSend('แสดงตารางเรียนทั้งหมด');
                  }}
                  className="w-full text-left px-4 py-3 rounded-2xl liquid-glass-btn text-xs text-slate-200 hover:text-white flex items-center justify-between"
                >
                  <span>📋 สรุปตารางเรียนทั้งหมด</span>
                  <span>→</span>
                </button>
                <button
                  onClick={() => {
                    setShowScheduleModal(false);
                    handleSend('วันนี้มีเรียนอะไรบ้าง?');
                  }}
                  className="w-full text-left px-4 py-3 rounded-2xl liquid-glass-btn text-xs text-slate-200 hover:text-white flex items-center justify-between"
                >
                  <span>📌 คาบเรียนวันนี้</span>
                  <span>→</span>
                </button>
                <button
                  onClick={() => {
                    setShowScheduleModal(false);
                    handleSend('เช็คเวลาว่างสัปดาห์นี้');
                  }}
                  className="w-full text-left px-4 py-3 rounded-2xl liquid-glass-btn text-xs text-slate-200 hover:text-white flex items-center justify-between"
                >
                  <span>⏳ เช็คเวลาว่างสัปดาห์นี้</span>
                  <span>→</span>
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-white/10 text-center text-[11px] text-slate-500">
              V1CTOR Schedule Management • Powered by Supabase
            </div>
          </div>
        </div>
      )}

      {/* Command Palette (Ctrl+K) */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onSend={(msg) => handleSend(msg)}
        onToggleAutoListen={() => {
          const next = !autoListen;
          setAutoListen(next);
          if (!next && isListening) recognitionRef.current?.stop();
        }}
        onOpenSchedule={() => {
          setShowScheduleModal(true);
          handleSend('แสดงตารางเรียนทั้งหมด');
        }}
      />

      {/* Memory Core Modal */}
      <AIMemoryModal
        isOpen={showMemoryModal}
        onClose={() => setShowMemoryModal(false)}
        sessionId={sessionId}
        messageCount={messages.length}
        speechSpeed={speechSpeed}
        autoListen={autoListen}
        autoVoice={autoVoice}
        onClearCache={() => {
          setMessages([]);
          setInput('');
          try {
            localStorage.clear();
          } catch {}
        }}
      />
    </div>
  );
}
