import type { Tables } from "@repo/database";
import { CropMarks } from "@repo/design-system/components/hud/crop-marks";
import { Panel } from "@repo/design-system/components/hud/panel";
import { cn } from "@repo/design-system/lib/utils";
import { ApertureIcon } from "lucide-react";

interface ProjectGridProperties {
  readonly projects: Pick<Tables<"projects">, "id" | "name" | "description">[];
}

// Each card gets one of the three inks so the grid reads like a contact sheet.
const TINTS = [
  "from-signal/25 via-signal/5",
  "from-flare/18 via-flare/4",
  "from-bloom/16 via-bloom/4",
];

export const ProjectGrid = ({ projects }: ProjectGridProperties) => {
  if (projects.length === 0) {
    return (
      <Panel className="flex flex-col items-center gap-3 border-dashed px-6 py-16 text-center">
        <ApertureIcon className="size-8 text-signal-ink/60" />
        <p className="font-bold font-mono text-xs uppercase tracking-[0.25em]">
          Mesa vacía
        </p>
        <p className="max-w-sm text-muted-foreground text-sm">
          Crea tu primer proyecto arriba. Aquí verás cada sesión del estudio.
        </p>
      </Panel>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((project, index) => (
        <div
          className="animate-fade-in-up"
          key={project.id}
          style={{ animationDelay: `${Math.min(index, 12) * 60}ms` }}
        >
          <Panel className="flex h-full flex-col" interactive>
            <div
              className={cn(
                "relative aspect-[16/7] overflow-hidden bg-linear-to-br to-transparent",
                TINTS[index % TINTS.length]
              )}
            >
              <div className="absolute inset-0 bg-hud-grid opacity-70" />
              <CropMarks
                className="inset-3"
                markClassName="size-3 transition-colors duration-300 group-hover/panel:border-signal-ink"
              />
              <span className="absolute bottom-3 left-8 font-mono text-[10px] text-signal-ink uppercase tracking-[0.25em]">
                P-{String(index + 1).padStart(2, "0")}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-1.5 border-t p-4">
              <p className="font-bold font-mono text-sm leading-tight transition-colors group-hover/panel:text-signal-ink">
                {project.name}
              </p>
              {project.description && (
                <p className="line-clamp-2 text-muted-foreground text-sm">
                  {project.description}
                </p>
              )}
            </div>
          </Panel>
        </div>
      ))}
    </div>
  );
};
