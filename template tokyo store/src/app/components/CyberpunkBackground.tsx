import { useMemo } from 'react';

interface Particle {
  id: number;
  x: number;
  size: number;
  duration: number;
  delay: number;
  color: string;
}

export default function CyberpunkBackground() {
  const particles = useMemo<Particle[]>(() =>
    Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      size: Math.random() > 0.75 ? 2 : 1,
      duration: 12 + Math.random() * 18,
      delay: Math.random() * 15,
      color: (['#00ffff', '#c084fc', '#f472b6', '#00ffff', '#00ffff'] as const)[
        Math.floor(Math.random() * 5)
      ],
    })), []
  );

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      {/* Base black */}
      <div className="absolute inset-0 bg-black" />

      {/* Radial color atmosphere */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            'radial-gradient(ellipse 80% 60% at 20% 50%, rgba(88,28,135,0.22) 0%, transparent 70%)',
            'radial-gradient(ellipse 60% 50% at 80% 20%, rgba(6,182,212,0.12) 0%, transparent 60%)',
            'radial-gradient(ellipse 50% 40% at 50% 90%, rgba(236,72,153,0.08) 0%, transparent 60%)',
          ].join(', '),
        }}
      />

      {/* Floating orb 1 — cyan */}
      <div
        className="absolute animate-orb-1"
        style={{
          top: '15%',
          left: '10%',
          width: '700px',
          height: '700px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(6,182,212,0.18) 0%, rgba(88,28,135,0.08) 50%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      {/* Floating orb 2 — purple */}
      <div
        className="absolute animate-orb-2"
        style={{
          top: '40%',
          right: '10%',
          width: '550px',
          height: '550px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(168,85,247,0.2) 0%, rgba(236,72,153,0.08) 50%, transparent 70%)',
          filter: 'blur(50px)',
        }}
      />

      {/* Floating orb 3 — pink */}
      <div
        className="absolute animate-orb-3"
        style={{
          bottom: '10%',
          left: '35%',
          width: '450px',
          height: '450px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(236,72,153,0.15) 0%, rgba(6,182,212,0.06) 50%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      {/* Cyan grid — fine */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: [
            'linear-gradient(rgba(0,255,255,0.06) 1px, transparent 1px)',
            'linear-gradient(90deg, rgba(0,255,255,0.06) 1px, transparent 1px)',
          ].join(', '),
          backgroundSize: '60px 60px',
        }}
      />

      {/* Purple grid — coarse */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: [
            'linear-gradient(rgba(168,85,247,0.04) 1px, transparent 1px)',
            'linear-gradient(90deg, rgba(168,85,247,0.04) 1px, transparent 1px)',
          ].join(', '),
          backgroundSize: '240px 240px',
        }}
      />

      {/* Rising particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute bottom-0 rounded-full"
          style={{
            left: `${p.x}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            boxShadow: `0 0 ${p.size * 4}px ${p.color}`,
            animationName: 'particle-rise',
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            animationTimingFunction: 'linear',
            animationIterationCount: 'infinite',
            animationFillMode: 'backwards',
          }}
        />
      ))}

      {/* Horizontal scan line */}
      <div
        className="absolute left-0 w-full animate-scan"
        style={{
          height: '2px',
          background: 'linear-gradient(90deg, transparent 0%, rgba(0,255,255,0.35) 30%, rgba(0,255,255,0.6) 50%, rgba(0,255,255,0.35) 70%, transparent 100%)',
          boxShadow: '0 0 12px rgba(0,255,255,0.5)',
        }}
      />

      {/* Vignette overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.65) 100%)',
        }}
      />

      {/* Scanlines CRT texture */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 3px, rgba(0,0,0,1) 3px, rgba(0,0,0,1) 4px)',
        }}
      />
    </div>
  );
}
