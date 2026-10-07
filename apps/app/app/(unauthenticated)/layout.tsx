import { StudioBackdrop } from "@repo/design-system/components/hud/backdrop";
import { CropMarks } from "@repo/design-system/components/hud/crop-marks";
import { HudLabel } from "@repo/design-system/components/hud/hud-label";
import { Panel } from "@repo/design-system/components/hud/panel";
import { Wordmark } from "@repo/design-system/components/hud/wordmark";
import { ModeToggle } from "@repo/design-system/components/mode-toggle";
import type { ReactNode } from "react";

interface AuthLayoutProps {
  readonly children: ReactNode;
}

const modules = [
  { index: "01", label: "Tablero" },
  { index: "02", label: "Editor" },
  { index: "03", label: "Equipo" },
];

const AuthLayout = ({ children }: AuthLayoutProps) => (
  <div className="grid min-h-dvh lg:grid-cols-[1.15fr_1fr]">
    <aside className="relative isolate hidden flex-col justify-between overflow-hidden border-r p-10 lg:flex">
      <StudioBackdrop />
      <CropMarks className="inset-6" markClassName="size-8" />

      <Wordmark className="relative" kanji />

      <div className="relative flex flex-col items-center text-center">
        <HudLabel className="mb-6">写真 · Estudio fotográfico · 写真</HudLabel>
        <div className="relative">
          <Wordmark glitch size="xl" />
          <div className="absolute inset-x-[12%] -bottom-2 h-px bg-linear-to-r from-transparent via-signal-ink/60 to-transparent" />
        </div>
        <HudLabel className="my-8">◆ Studio OS ◆</HudLabel>
        <p className="max-w-md text-balance font-mono text-muted-foreground text-sm leading-relaxed">
          <span className="text-flare">Proyectos</span>, edición y entregas de
          tu estudio en un solo lugar.{" "}
          <span className="text-signal-ink">Encuadra. Edita. Entrega.</span>
        </p>
      </div>

      <dl className="relative flex justify-center gap-12">
        {modules.map((module) => (
          <div className="text-center" key={module.index}>
            <dt className="tabular font-black font-mono text-2xl text-glow text-signal-ink">
              {module.index}
            </dt>
            <dd className="mt-1 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">
              {module.label}
            </dd>
          </div>
        ))}
      </dl>
    </aside>

    <main className="relative isolate flex flex-col items-center justify-center gap-8 overflow-hidden p-6">
      <StudioBackdrop className="lg:hidden" />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 hidden bg-hud-grid [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_80%)] lg:block"
      />
      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>
      <Wordmark className="lg:hidden" kanji size="md" />
      <Panel className="w-full max-w-[400px] animate-fade-in-up" stream>
        <div className="flex flex-col gap-6 p-8">{children}</div>
      </Panel>
    </main>
  </div>
);

export default AuthLayout;
