import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, ShieldX, ArrowLeft } from 'lucide-react';

interface AgeGateProps {
  onConfirm: () => void;
}

export default function AgeGate({ onConfirm }: AgeGateProps) {
  const [denied, setDenied] = useState(false);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden">

      {/* ── Backdrop ─────────────────────────────────────────── */}
      <div className="absolute inset-0 bg-black" />

      {/* Radial color atmosphere */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            'radial-gradient(ellipse 70% 60% at 20% 50%, rgba(88,28,135,0.28) 0%, transparent 70%)',
            'radial-gradient(ellipse 50% 50% at 80% 20%, rgba(6,182,212,0.14) 0%, transparent 60%)',
            'radial-gradient(ellipse 40% 40% at 50% 90%, rgba(236,72,153,0.1) 0%, transparent 60%)',
          ].join(', '),
        }}
      />

      {/* Cyan grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: [
            'linear-gradient(rgba(0,255,255,0.05) 1px, transparent 1px)',
            'linear-gradient(90deg, rgba(0,255,255,0.05) 1px, transparent 1px)',
          ].join(', '),
          backgroundSize: '60px 60px',
        }}
      />

      {/* Floating orb left */}
      <div
        className="absolute animate-orb-1"
        style={{
          top: '10%', left: '5%',
          width: '500px', height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(6,182,212,0.16) 0%, rgba(88,28,135,0.06) 50%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />
      {/* Floating orb right */}
      <div
        className="absolute animate-orb-2"
        style={{
          bottom: '10%', right: '5%',
          width: '400px', height: '400px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(168,85,247,0.18) 0%, rgba(236,72,153,0.06) 50%, transparent 70%)',
          filter: 'blur(50px)',
        }}
      />

      {/* Scan line */}
      <div
        className="absolute left-0 w-full animate-scan pointer-events-none"
        style={{
          height: '2px',
          background: 'linear-gradient(90deg, transparent 0%, rgba(0,255,255,0.35) 30%, rgba(0,255,255,0.6) 50%, rgba(0,255,255,0.35) 70%, transparent 100%)',
          boxShadow: '0 0 12px rgba(0,255,255,0.5)',
        }}
      />

      {/* ── Card ─────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {!denied ? (
          <motion.div
            key="verify"
            initial={{ opacity: 0, y: 32, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit   ={{ opacity: 0, y: -20, scale: 0.97 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="relative z-10 w-full max-w-sm"
            style={{
              background: 'rgba(3,3,14,0.92)',
              border: '1px solid rgba(0,255,255,0.18)',
              boxShadow: '0 0 40px rgba(0,255,255,0.08), 0 30px 80px rgba(0,0,0,0.7), inset 0 0 40px rgba(0,255,255,0.03)',
              clipPath: 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))',
              backdropFilter: 'blur(16px)',
            }}
          >
            {/* data-stream top banner */}
            <div className="relative h-1 overflow-hidden">
              <div className="absolute inset-0 data-stream" />
            </div>

            {/* Hex grid SVG overlay on card */}
            <svg className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="hex-ag" x="0" y="0" width="60" height="52" patternUnits="userSpaceOnUse">
                  <polygon points="30,1 59,16 59,36 30,51 1,36 1,16" fill="none" stroke="white" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#hex-ag)" />
            </svg>

            {/* Scan line inside card */}
            <div
              className="absolute left-0 w-full animate-scan pointer-events-none"
              style={{
                height: '1px',
                background: 'linear-gradient(90deg, transparent, rgba(0,255,255,0.25), transparent)',
              }}
            />

            {/* Corner cut accent */}
            <div
              className="absolute top-0 right-0 w-5 h-5 pointer-events-none"
              style={{
                background: 'rgba(0,255,255,0.5)',
                clipPath: 'polygon(100% 0%, 0% 0%, 100% 100%)',
              }}
            />
            <div
              className="absolute bottom-0 left-0 w-5 h-5 pointer-events-none"
              style={{
                background: 'rgba(168,85,247,0.4)',
                clipPath: 'polygon(0% 0%, 0% 100%, 100% 100%)',
              }}
            />

            <div className="relative z-10 p-8 flex flex-col items-center text-center">

              {/* Logo */}
              <div className="mb-6 select-none">
                <span
                  className="block text-[9px] font-mono tracking-[0.5em] mb-1"
                  style={{ color: 'rgba(0,255,255,0.45)' }}
                >
                  東京
                </span>
                <span
                  className="text-2xl font-black font-mono tracking-widest animate-glitch-main"
                  style={{ color: '#fff', textShadow: '0 0 15px rgba(0,255,255,0.4)' }}
                >
                  TOKYO<span style={{ color: '#00ffff', textShadow: '0 0 20px #00ffff, 0 0 40px rgba(0,255,255,0.4)' }}>THC</span>
                </span>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 w-full mb-6">
                <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, transparent, rgba(0,255,255,0.3))' }} />
                <span className="text-[9px] font-mono tracking-widest whitespace-nowrap" style={{ color: 'rgba(0,255,255,0.5)' }}>
                  ◆ AGE VERIFICATION ◆
                </span>
                <div className="h-px flex-1" style={{ background: 'linear-gradient(to left, transparent, rgba(0,255,255,0.3))' }} />
              </div>

              {/* Heading */}
              <ShieldCheck size={36} className="mb-3" style={{ color: '#00ffff', filter: 'drop-shadow(0 0 8px rgba(0,255,255,0.6))' }} />
              <h2
                className="text-xl font-black font-mono tracking-wider mb-2"
                style={{ color: '#fff', textShadow: '0 0 10px rgba(255,255,255,0.2)' }}
              >
                ARE YOU 21+?
              </h2>
              <p className="text-xs font-mono leading-relaxed mb-6" style={{ color: '#6b7280' }}>
                You must be 21 years of age or older<br />
                to enter this website.
              </p>

              {/* Warning box with data-stream */}
              <div
                className="relative w-full overflow-hidden mb-7 p-3"
                style={{
                  background: 'rgba(245,158,11,0.05)',
                  border: '1px solid rgba(245,158,11,0.2)',
                  boxShadow: '0 0 5px currentColor, inset 0 0 5px rgba(245,158,11,0.05)',
                }}
              >
                {/* data-stream overlay — exact SEN-NIN effect */}
                <div className="absolute inset-0 data-stream pointer-events-none" style={{ opacity: 0.4 }} />
                <p className="relative z-10 text-[10px] font-mono leading-relaxed" style={{ color: '#d97706' }}>
                  ⚠ This site contains cannabis products intended for adults 21+.
                  Check your local laws before purchasing.
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col gap-3 w-full">
                {/* Confirm */}
                <button
                  onClick={onConfirm}
                  className="relative w-full flex items-center justify-center gap-2 py-4 font-mono font-black text-sm tracking-widest uppercase transition-all duration-300 overflow-hidden"
                  style={{
                    background: '#00ffff',
                    color: '#000',
                    clipPath: 'polygon(10px 0%, 100% 0%, calc(100% - 10px) 100%, 0% 100%)',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 0 30px rgba(0,255,255,0.7), 0 0 60px rgba(0,255,255,0.3)';
                    (e.currentTarget as HTMLElement).style.background = '#33ffff';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                    (e.currentTarget as HTMLElement).style.background = '#00ffff';
                  }}
                >
                  <ShieldCheck size={15} />
                  I AM 21 OR OLDER — ENTER
                </button>

                {/* Deny */}
                <button
                  onClick={() => setDenied(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 font-mono font-bold text-xs tracking-widest uppercase transition-all duration-200"
                  style={{
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#4b5563',
                    background: 'transparent',
                    clipPath: 'polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.color = '#6b7280';
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.color = '#4b5563';
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)';
                  }}
                >
                  <ShieldX size={13} />
                  I AM UNDER 21
                </button>
              </div>

              {/* Fine print */}
              <p className="mt-5 text-[9px] font-mono leading-relaxed" style={{ color: '#1f2937' }}>
                By entering you agree to our{' '}
                <a href="#" className="underline" style={{ color: '#374151' }}>Terms of Use</a>
                {' '}&amp;{' '}
                <a href="#" className="underline" style={{ color: '#374151' }}>Privacy Policy</a>
              </p>
            </div>
          </motion.div>

        ) : (
          /* ── Denied State ──────────────────────────────────── */
          <motion.div
            key="denied"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1   }}
            exit   ={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.35 }}
            className="relative z-10 w-full max-w-sm"
            style={{
              background: 'rgba(3,3,14,0.95)',
              border: '1px solid rgba(239,68,68,0.25)',
              boxShadow: '0 0 30px rgba(239,68,68,0.08), 0 30px 80px rgba(0,0,0,0.7)',
              clipPath: 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))',
              backdropFilter: 'blur(16px)',
            }}
          >
            {/* Red data-stream */}
            <div className="relative h-1 overflow-hidden">
              <div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(90deg, #0000, #ef444480, #0000) 0 0 / 200% 100%',
                  animation: 'data-flow 2s linear infinite',
                }}
              />
            </div>

            {/* Corner cut — red */}
            <div
              className="absolute top-0 right-0 w-5 h-5 pointer-events-none"
              style={{ background: 'rgba(239,68,68,0.6)', clipPath: 'polygon(100% 0%, 0% 0%, 100% 100%)' }}
            />

            <div className="relative z-10 p-8 flex flex-col items-center text-center">
              <ShieldX
                size={48}
                className="mb-4"
                style={{ color: '#ef4444', filter: 'drop-shadow(0 0 10px rgba(239,68,68,0.6))' }}
              />

              <h2
                className="text-xl font-black font-mono tracking-wider mb-2"
                style={{ color: '#ef4444', textShadow: '0 0 12px rgba(239,68,68,0.5)' }}
              >
                ACCESS RESTRICTED
              </h2>

              <div className="flex items-center gap-3 w-full my-4">
                <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, transparent, rgba(239,68,68,0.3))' }} />
                <span className="text-[9px] font-mono tracking-widest" style={{ color: 'rgba(239,68,68,0.5)' }}>
                  ◆ 21+ ONLY ◆
                </span>
                <div className="h-px flex-1" style={{ background: 'linear-gradient(to left, transparent, rgba(239,68,68,0.3))' }} />
              </div>

              <p className="text-xs font-mono leading-relaxed mb-6" style={{ color: '#6b7280' }}>
                You must be 21 years or older<br />
                to access this website.<br />
                <span className="text-[10px]" style={{ color: '#374151' }}>
                  Please check your local laws and regulations.
                </span>
              </p>

              {/* Warning data-stream box */}
              <div
                className="relative w-full overflow-hidden mb-7 p-3"
                style={{
                  background: 'rgba(239,68,68,0.04)',
                  border: '1px solid rgba(239,68,68,0.15)',
                }}
              >
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: 'linear-gradient(90deg, #0000, #ef444440, #0000) 0 0 / 200% 100%',
                    animation: 'data-flow 2.5s linear infinite',
                    opacity: 0.5,
                  }}
                />
                <p className="relative z-10 text-[10px] font-mono" style={{ color: '#7f1d1d' }}>
                  ACCESS DENIED · SYSTEM LOG 403 · UNDERAGE USER
                </p>
              </div>

              <button
                onClick={() => setDenied(false)}
                className="w-full flex items-center justify-center gap-2 py-3 font-mono font-bold text-xs tracking-widest uppercase transition-all duration-200"
                style={{
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#6b7280',
                  clipPath: 'polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = '#9ca3af';
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = '#6b7280';
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)';
                }}
              >
                <ArrowLeft size={13} />
                GO BACK
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
