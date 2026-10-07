import { cn } from "@repo/design-system/lib/utils";
import type { CSSProperties } from "react";
import { ScanLine } from "./scan-line";

interface Particle {
  readonly color: string;
  readonly delay: number;
  readonly duration: number;
  readonly id: number;
  readonly left: number;
  readonly size: number;
}

// Deterministic PRNG (Park–Miller): server and client must render the same
// particles, so Math.random() is not an option here.
const MODULUS = 2_147_483_647;

const createRandom = (seed: number) => {
  let state = seed % MODULUS;
  return () => {
    state = (state * 16_807) % MODULUS;
    return (state - 1) / (MODULUS - 1);
  };
};

const PARTICLE_COLORS = [
  "var(--signal-ink)",
  "var(--signal)",
  "var(--flare)",
  "var(--signal-ink)",
  "var(--bloom)",
];

const round = (value: number) => Math.round(value * 100) / 100;

const createParticles = (count: number, seed: number): Particle[] => {
  const random = createRandom(seed);
  return Array.from({ length: count }, (_, id) => {
    const duration = 12 + random() * 18;
    return {
      id,
      left: round(random() * 100),
      size: random() > 0.7 ? 3 : 2,
      duration: round(duration),
      // Negative delay: particles are already mid-flight on first paint.
      delay: round(-random() * duration),
      color:
        PARTICLE_COLORS[Math.floor(random() * PARTICLE_COLORS.length)] ??
        "var(--signal)",
    };
  });
};

const PARTICLES = {
  full: createParticles(50, 7),
  calm: createParticles(18, 11),
};

const ATMOSPHERE: CSSProperties = {
  background: [
    "radial-gradient(ellipse 80% 60% at 20% 50%, color-mix(in oklab, var(--flare) 9%, transparent) 0%, transparent 70%)",
    "radial-gradient(ellipse 60% 50% at 80% 20%, color-mix(in oklab, var(--signal) 16%, transparent) 0%, transparent 60%)",
    "radial-gradient(ellipse 50% 40% at 50% 90%, color-mix(in oklab, var(--bloom) 7%, transparent) 0%, transparent 60%)",
  ].join(", "),
};

const ORBS = [
  {
    className: "animate-orb-1 top-[12%] left-[6%] size-[640px] blur-[44px]",
    background:
      "radial-gradient(circle, color-mix(in oklab, var(--signal) 26%, transparent) 0%, color-mix(in oklab, var(--flare) 6%, transparent) 50%, transparent 70%)",
  },
  {
    className: "animate-orb-2 top-[40%] right-[6%] size-[520px] blur-[52px]",
    background:
      "radial-gradient(circle, color-mix(in oklab, var(--flare) 16%, transparent) 0%, color-mix(in oklab, var(--bloom) 6%, transparent) 50%, transparent 70%)",
  },
  {
    className: "animate-orb-3 bottom-[6%] left-[35%] size-[440px] blur-[44px]",
    background:
      "radial-gradient(circle, color-mix(in oklab, var(--bloom) 12%, transparent) 0%, color-mix(in oklab, var(--signal) 6%, transparent) 50%, transparent 70%)",
  },
];

const VIGNETTE: CSSProperties = {
  background:
    "radial-gradient(ellipse at center, transparent 45%, color-mix(in oklab, var(--lightbox) 75%, transparent) 100%)",
};

const CRT_TEXTURE: CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(to bottom, transparent, transparent 3px, var(--ink) 3px, var(--ink) 4px)",
};

interface StudioBackdropProperties {
  readonly className?: string;
  /** full: auth and first-run screens. calm: behind everyday work. */
  readonly variant?: "full" | "calm";
}

/**
 * Fondo del template Tokyo en clave "mesa de luz": atmósfera de color,
 * orbes flotantes, retícula, partículas que suben, línea de escaneo y viñeta.
 * Se coloca dentro de un contenedor `relative isolate`.
 */
export const StudioBackdrop = ({
  className,
  variant = "full",
}: StudioBackdropProperties) => {
  const full = variant === "full";

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 overflow-hidden",
        className
      )}
    >
      <div className="absolute inset-0" style={ATMOSPHERE} />

      {ORBS.map((orb) => (
        <div
          className={cn(
            "absolute rounded-full",
            orb.className,
            !full && "opacity-60"
          )}
          key={orb.className}
          style={{ background: orb.background }}
        />
      ))}

      <div className="absolute inset-0 bg-hud-grid" />

      <div className="absolute inset-0 motion-reduce:hidden">
        {PARTICLES[variant].map((particle) => (
          <span
            className="absolute bottom-0 rounded-full"
            key={particle.id}
            style={{
              left: `${particle.left}%`,
              width: particle.size,
              height: particle.size,
              backgroundColor: particle.color,
              boxShadow: `0 0 ${particle.size * 4}px ${particle.color}`,
              opacity: 0,
              animation: `particle-rise ${particle.duration}s linear ${particle.delay}s infinite`,
            }}
          />
        ))}
      </div>

      <ScanLine
        className={full ? undefined : "opacity-50"}
        duration={full ? undefined : 9}
      />

      <div className="absolute inset-0" style={VIGNETTE} />

      {full && (
        <div className="absolute inset-0 opacity-[0.02]" style={CRT_TEXTURE} />
      )}
    </div>
  );
};
