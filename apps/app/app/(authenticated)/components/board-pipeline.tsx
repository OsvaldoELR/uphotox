import { Panel } from "@repo/design-system/components/hud/panel";
import { cn } from "@repo/design-system/lib/utils";
import Link from "next/link";
import type { BoardSummary } from "@/lib/board-summary";

interface BoardPipelineProperties {
  readonly board: BoardSummary;
  readonly index: number;
}

/** A board read as a funnel: one cell per stage with its card count. */
export const BoardPipeline = ({ board, index }: BoardPipelineProperties) => (
  <Link
    className="block animate-fade-in-up rounded-none outline-none focus-visible:ring-2 focus-visible:ring-ring"
    href={`/tableros/${board.id}`}
    style={{ animationDelay: `${Math.min(index, 12) * 60}ms` }}
  >
    <Panel className="flex flex-col gap-4 p-5" interactive>
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="truncate font-bold font-mono text-sm uppercase tracking-[0.12em] transition-colors group-hover/panel:text-signal-ink">
          {board.name}
        </h3>
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground uppercase tracking-[0.2em]">
          <span className="tabular font-bold text-foreground">
            {String(board.total).padStart(2, "0")}
          </span>{" "}
          {board.total === 1 ? "tarjeta" : "tarjetas"}
        </span>
      </div>
      {board.stages.length > 0 ? (
        <ol className="grid auto-cols-[minmax(6.5rem,1fr)] grid-flow-col gap-px overflow-x-auto border bg-border">
          {board.stages.map((stage) => (
            <li
              className="flex flex-col gap-1 bg-popover px-3 py-2.5"
              key={stage.id}
            >
              <span
                className={cn(
                  "tabular font-black font-mono text-xl leading-none",
                  stage.count > 0
                    ? "text-signal-ink"
                    : "text-muted-foreground/50"
                )}
              >
                {stage.count}
              </span>
              <span className="line-clamp-2 font-mono text-[10px] text-muted-foreground uppercase leading-snug tracking-[0.12em]">
                {stage.name}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-muted-foreground text-sm">Sin etapas todavía.</p>
      )}
    </Panel>
  </Link>
);
