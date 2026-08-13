'use client';

import React, { useRef, useEffect, useCallback } from 'react';

interface AudioVisualizerProps {
  isListening: boolean;
  isSpeaking: boolean;
  stream?: MediaStream | null;
}

export default function AudioVisualizer({ isListening, isSpeaking, stream }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  // Idle ambient pulse state
  const idlePhaseRef = useRef(0);

  const isActive = isListening || isSpeaking;

  // Setup audio analyser when stream is available and listening
  useEffect(() => {
    if (!isListening || !stream) {
      // Cleanup previous source
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      return;
    }

    try {
      if (!audioCtxRef.current) {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AC();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.82;
      analyser.minDecibels = -85;
      analyser.maxDecibels = -10;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      analyserRef.current = analyser;
      sourceRef.current = source;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
    } catch (e) {
      console.error('[AudioVisualizer] Setup error:', e);
    }

    return () => {
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
    };
  }, [isListening, stream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (sourceRef.current) sourceRef.current.disconnect();
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;

    ctx.clearRect(0, 0, W, H);

    if (isActive && analyserRef.current && dataArrayRef.current) {
      // ── Real-time frequency bars ──
      const analyser = analyserRef.current;
      const dataArray = dataArrayRef.current;
      analyser.getByteFrequencyData(dataArray);

      const barCount = analyser.frequencyBinCount;
      const barGap = 2.5;
      const totalBarWidth = W - barGap * (barCount - 1);
      const barWidth = Math.max(totalBarWidth / barCount, 2);
      const maxBarH = H * 0.85;
      const centerY = H / 2;

      for (let i = 0; i < barCount; i++) {
        const value = dataArray[i] / 255;
        const barH = Math.max(value * maxBarH, 1.5);
        const x = i * (barWidth + barGap);

        // Ice-white / silver metallic gradient
        const alpha = 0.35 + value * 0.65;
        const glowAlpha = value * 0.4;

        // Glow layer
        ctx.shadowColor = `rgba(16, 185, 129, ${glowAlpha})`;
        ctx.shadowBlur = 6 + value * 10;

        // Bar gradient: ice-white → silver
        const grad = ctx.createLinearGradient(x, centerY - barH / 2, x, centerY + barH / 2);
        grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
        grad.addColorStop(0.5, `rgba(203, 213, 225, ${alpha})`);
        grad.addColorStop(1, `rgba(148, 163, 184, ${alpha * 0.6})`);
        ctx.fillStyle = grad;

        // Rounded rect bars mirrored from center
        const radius = Math.min(barWidth / 2, 3);
        drawRoundedRect(ctx, x, centerY - barH / 2, barWidth, barH, radius);
      }

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    } else {
      // ── Idle ambient pulse wave ──
      idlePhaseRef.current += 0.025;
      const phase = idlePhaseRef.current;
      const centerY = H / 2;
      const amplitude = H * 0.08;
      const points = 80;

      ctx.beginPath();
      ctx.moveTo(0, centerY);

      for (let i = 0; i <= points; i++) {
        const x = (i / points) * W;
        const wave1 = Math.sin((i / points) * Math.PI * 4 + phase) * amplitude;
        const wave2 = Math.sin((i / points) * Math.PI * 2.5 + phase * 0.7) * amplitude * 0.4;
        const y = centerY + wave1 + wave2;
        ctx.lineTo(x, y);
      }

      // Subtle glow
      ctx.shadowColor = 'rgba(255, 255, 255, 0.15)';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }

    animFrameRef.current = requestAnimationFrame(draw);
  }, [isActive]);

  // Start/stop animation loop
  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(draw);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full pointer-events-none"
      style={{
        height: isActive ? '36px' : '20px',
        transition: 'height 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    />
  );
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}
