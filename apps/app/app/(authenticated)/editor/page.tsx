import { createClient } from "@repo/database/server";
import { HudLabel } from "@repo/design-system/components/hud/hud-label";
import type { Metadata } from "next";
import Link from "next/link";
import {
  type EditStatus,
  editState,
  formatCost,
  isInProgress,
  monthStart,
} from "@/lib/editor";
import { isEditorConfigured } from "@/lib/editor-service";
import { requirePermission } from "@/lib/studio";
import { Header } from "../components/header";

export const metadata: Metadata = {
  title: "Editor · Uphotox",
  description: "Limpieza de fondos con IA y consumo del estudio.",
};

const sectionLabel =
  "font-bold font-mono text-sm uppercase tracking-[0.12em] flex items-baseline gap-2";

const Stat = ({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) => (
  <div className="flex flex-col gap-1 bg-card px-4 py-3">
    <dt className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
      {label}
    </dt>
    <dd className="font-black font-mono text-xl tabular-nums">{value}</dd>
  </div>
);

const previousMonthStart = () => {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)
  ).toISOString();
};

interface GalleryRow {
  readonly done: number;
  readonly failed: number;
  readonly id: number;
  readonly inProgress: number;
  readonly review: number;
  readonly title: string;
}

/** Successful photos and cost of this month and the previous one. */
const usageByMonth = (
  runs: readonly {
    readonly cost: number;
    readonly created_at: string;
    readonly succeeded: boolean;
  }[],
  thisMonth: string
) => {
  const months = {
    current: { photos: 0, cost: 0 },
    previous: { photos: 0, cost: 0 },
  };

  for (const run of runs) {
    const month =
      run.created_at >= thisMonth ? months.current : months.previous;
    month.cost += Number(run.cost);
    month.photos += run.succeeded ? 1 : 0;
  }

  return months;
};

/** Edit photos counted per gallery and state. */
const groupByGallery = (
  photos: readonly {
    readonly gallery: {
      readonly card: { readonly title: string } | null;
      readonly id: number;
    } | null;
    readonly needs_review: boolean;
    readonly status: string;
  }[]
) => {
  const galleries = new Map<number, GalleryRow>();

  for (const photo of photos) {
    if (!photo.gallery?.card) {
      continue;
    }

    const row = galleries.get(photo.gallery.id) ?? {
      id: photo.gallery.id,
      title: photo.gallery.card.title,
      done: 0,
      review: 0,
      inProgress: 0,
      failed: 0,
    };
    const status = photo.status as EditStatus;
    const state = editState({ status, needsReview: photo.needs_review });
    galleries.set(row.id, {
      ...row,
      done: row.done + (state === "done" ? 1 : 0),
      review: row.review + (state === "review" ? 1 : 0),
      failed: row.failed + (state === "failed" ? 1 : 0),
      inProgress: row.inProgress + (isInProgress(status) ? 1 : 0),
    });
  }

  return galleries;
};

const EditorPage = async () => {
  await requirePermission("editor.access");
  const supabase = await createClient();
  const thisMonth = monthStart();
  const [{ data: usage }, { data: photos }, { data: submitted }] =
    await Promise.all([
      supabase
        .from("edit_usage")
        .select("cost, succeeded, created_at")
        .gte("created_at", previousMonthStart()),
      supabase
        .from("edit_photos")
        .select(
          "status, needs_review, gallery:galleries!edit_photos_gallery_id_studio_id_fkey(id, card:cards!galleries_card_id_studio_id_fkey(title))"
        ),
      supabase
        .from("galleries")
        .select("id, card:cards!galleries_card_id_studio_id_fkey(title)")
        .eq("status", "submitted")
        .is("purged_at", null)
        .order("submitted_at", { ascending: false })
        .limit(50),
    ]);

  const months = usageByMonth(usage ?? [], thisMonth);
  const galleries = groupByGallery(photos ?? []);

  const waiting = (submitted ?? []).filter(
    (gallery) => gallery.card && !galleries.has(gallery.id)
  );

  return (
    <>
      <Header page="Editor" trail={[{ label: "Panel", href: "/" }]} />
      <div className="flex flex-1 flex-col gap-10 px-4 pt-4 pb-12 md:px-10">
        <section className="flex flex-col gap-4">
          <HudLabel align="start">Editor</HudLabel>
          <div className="grid gap-1">
            <h1 className="font-black font-mono text-3xl uppercase tracking-[-0.02em] md:text-4xl">
              Limpieza de fondos
            </h1>
            <p className="max-w-prose text-muted-foreground text-sm">
              Limpia con IA el fondo y el suelo de las fotos que eligió cada
              cliente, sin tocar a las personas. Se lanza desde cada galería con
              la selección recibida.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-px border bg-border sm:grid-cols-4">
            <Stat
              label="Fotos este mes"
              value={String(months.current.photos)}
            />
            <Stat
              label="Consumo este mes"
              value={formatCost(months.current.cost)}
            />
            <Stat
              label="Fotos mes pasado"
              value={String(months.previous.photos)}
            />
            <Stat
              label="Consumo mes pasado"
              value={formatCost(months.previous.cost)}
            />
          </dl>
          <p className="text-muted-foreground text-xs">
            El consumo es lo que cuestan los modelos de IA (análisis, limpieza y
            revisión), incluidos los intentos que fallan.
            {isEditorConfigured()
              ? ""
              : " El servicio de limpieza todavía no está conectado."}
          </p>
        </section>

        {waiting.length > 0 && (
          <section className="grid gap-3">
            <h2 className={sectionLabel}>
              <span className="text-signal-ink">01</span> Selecciones por
              limpiar
            </h2>
            <ul className="grid gap-px border bg-border">
              {waiting.map((gallery) => (
                <li className="bg-card" key={gallery.id}>
                  <Link
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-accent"
                    href={`/galerias/${gallery.id}/limpieza`}
                  >
                    <span className="truncate font-medium">
                      {gallery.card?.title}
                    </span>
                    <span className="font-mono text-[10px] text-signal-ink uppercase tracking-[0.16em]">
                      Limpiar fondos
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="grid gap-3">
          <h2 className={sectionLabel}>
            <span className="text-signal-ink">
              {waiting.length > 0 ? "02" : "01"}
            </span>{" "}
            Galerías en el editor
          </h2>
          {galleries.size === 0 ? (
            <p className="border border-dashed px-4 py-10 text-center text-muted-foreground text-sm">
              Todavía no has limpiado ninguna galería.
            </p>
          ) : (
            <ul className="grid gap-px border bg-border">
              {[...galleries.values()].map((gallery) => (
                <li className="bg-card" key={gallery.id}>
                  <Link
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-accent"
                    href={`/galerias/${gallery.id}/limpieza`}
                  >
                    <span className="truncate font-medium">
                      {gallery.title}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.16em]">
                      {[
                        `${gallery.done} listas`,
                        gallery.review > 0 && `${gallery.review} por revisar`,
                        gallery.inProgress > 0 &&
                          `${gallery.inProgress} en proceso`,
                        gallery.failed > 0 && `${gallery.failed} fallidas`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
};

export default EditorPage;
