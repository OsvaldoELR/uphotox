import { createClient } from "@repo/database/server";
import { HudLabel } from "@repo/design-system/components/hud/hud-label";
import { Button } from "@repo/design-system/components/ui/button";
import { signedGetUrls } from "@repo/storage";
import { editPhotoKeys } from "@repo/storage/editor";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  type EditStatus,
  editState,
  formatCost,
  monthStart,
} from "@/lib/editor";
import { isEditorConfigured } from "@/lib/editor-service";
import { compareFileNames } from "@/lib/gallery";
import { requirePermission } from "@/lib/studio";
import { Header } from "../../../components/header";
import { EditPhotoList } from "./components/edit-photo-list";
import { OriginalUploader } from "./components/original-uploader";

export const metadata: Metadata = {
  title: "Limpieza de fondos · Uphotox",
  description: "Limpieza del fondo con IA de las fotos que eligió el cliente.",
};

interface CleanupPageProperties {
  readonly params: Promise<{ galleryId: string }>;
}

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

const sum = (rows: readonly { cost: number }[] | null) =>
  (rows ?? []).reduce((total, row) => total + Number(row.cost), 0);

const CleanupPage = async ({ params }: CleanupPageProperties) => {
  await requirePermission("editor.access");
  const galleryId = Number((await params).galleryId);

  if (!Number.isSafeInteger(galleryId) || galleryId <= 0) {
    notFound();
  }

  const supabase = await createClient();
  const [
    { data: gallery },
    { data: picks },
    { data: rows },
    galleryUsage,
    monthUsage,
  ] = await Promise.all([
    supabase
      .from("galleries")
      .select(
        "id, studio_id, purged_at, card:cards!galleries_card_id_studio_id_fkey(title, client:clients(full_name))"
      )
      .eq("id", galleryId)
      .maybeSingle(),
    supabase
      .from("gallery_photos")
      .select("id, file_name")
      .eq("gallery_id", galleryId)
      .not("picked_at", "is", null),
    supabase
      .from("edit_photos")
      .select(
        "id, gallery_photo_id, file_name, status, score, needs_review, review_comment, error"
      )
      .eq("gallery_id", galleryId),
    supabase
      .from("edit_usage")
      .select("edit_photo_id, cost")
      .eq("gallery_id", galleryId),
    supabase.from("edit_usage").select("cost").gte("created_at", monthStart()),
  ]);

  // RLS hides galleries of other studios and of cards the member can't see.
  if (!gallery?.card) {
    notFound();
  }

  const ready = isEditorConfigured();
  const editRows = rows ?? [];
  const done = editRows.filter((row) => row.status === "done");
  const previewUrls =
    ready && done.length
      ? await signedGetUrls(
          done.map(
            (row) =>
              editPhotoKeys({
                studioId: gallery.studio_id,
                galleryId,
                id: row.id,
              }).preview
          )
        )
      : [];
  const previews = new Map(
    done.map((row, index) => [row.id, previewUrls[index] ?? null])
  );
  const costs = new Map<number, number>();

  for (const usage of galleryUsage.data ?? []) {
    if (usage.edit_photo_id !== null) {
      costs.set(
        usage.edit_photo_id,
        (costs.get(usage.edit_photo_id) ?? 0) + Number(usage.cost)
      );
    }
  }

  const sentPhotoIds = new Set(
    editRows
      .filter((row) => row.status !== "uploading")
      .map((row) => row.gallery_photo_id)
  );
  const pickList = [...(picks ?? [])].sort((a, b) =>
    compareFileNames(a.file_name, b.file_name)
  );
  const photos = editRows
    .map((row) => ({
      id: row.id,
      fileName: row.file_name,
      state: editState({
        status: row.status as EditStatus,
        needsReview: row.needs_review,
      }),
      score: row.score,
      comment: row.review_comment,
      error: row.error,
      previewUrl: previews.get(row.id) ?? null,
      cost: costs.get(row.id) ?? 0,
    }))
    .sort((a, b) => compareFileNames(a.fileName, b.fileName));
  const finished = photos.filter(
    (photo) => photo.state === "done" || photo.state === "review"
  ).length;

  return (
    <>
      <Header
        page="Limpieza de fondos"
        trail={[
          { label: "Panel", href: "/" },
          { label: "Galerías", href: "/galerias" },
          { label: gallery.card.title, href: `/galerias/${galleryId}` },
        ]}
      />
      <div className="flex flex-1 flex-col gap-10 px-4 pt-4 pb-12 md:px-10">
        <section className="flex flex-col gap-4">
          <HudLabel align="start">Limpieza de fondos</HudLabel>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="grid gap-1">
              <h1 className="font-black font-mono text-3xl uppercase tracking-[-0.02em] md:text-4xl">
                {gallery.card.title}
              </h1>
              <p className="max-w-prose text-muted-foreground text-sm">
                La IA limpia el fondo y el suelo de las fotos que eligió el
                cliente. Las personas nunca vienen de la IA: siempre son tus
                píxeles originales.
              </p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href={`/galerias/${galleryId}`}>Volver a la galería</Link>
            </Button>
          </div>
          <dl className="grid grid-cols-2 gap-px border bg-border sm:grid-cols-4">
            <Stat label="Elegidas" value={String(pickList.length)} />
            <Stat label="Limpias" value={`${finished} / ${pickList.length}`} />
            <Stat
              label="Coste de esta galería"
              value={formatCost(sum(galleryUsage.data))}
            />
            <Stat
              label="Consumo del mes"
              value={formatCost(sum(monthUsage.data))}
            />
          </dl>
        </section>

        {pickList.length === 0 && (
          <p className="border px-4 py-3 text-muted-foreground text-sm">
            El cliente todavía no ha elegido fotos en esta galería.
          </p>
        )}

        {pickList.length > 0 && !ready && (
          <p className="border px-4 py-3 text-muted-foreground text-sm">
            El servicio de limpieza todavía no está conectado (Cloudflare).
          </p>
        )}

        {pickList.length > 0 && ready && !gallery.purged_at && (
          <section className="grid gap-3">
            <h2 className={sectionLabel}>
              <span className="text-signal-ink">01</span> Subir las elegidas
            </h2>
            <p className="max-w-prose text-muted-foreground text-sm">
              En Lightroom, filtra las elegidas y usa{" "}
              <em>Archivo → Exportar con ajuste preestablecido</em> → «Uphotox -
              Limpieza de fondos» (van a la carpeta «Uphotox para limpiar» del
              escritorio).{" "}
              <a
                className="text-signal-ink underline underline-offset-2"
                download="Uphotox - Limpieza de fondos.lrtemplate"
                href="/lightroom/uphotox-limpieza-fondos.lrtemplate"
              >
                Descargar el ajuste para Lightroom
              </a>{" "}
              (se importa una vez desde el panel de ajustes del diálogo
              Exportar).
            </p>
            <OriginalUploader
              galleryId={galleryId}
              picks={pickList.map((pick) => ({
                fileName: pick.file_name,
                sent: sentPhotoIds.has(pick.id),
              }))}
            />
          </section>
        )}

        <section className="grid gap-3">
          <h2 className={sectionLabel}>
            <span className="text-signal-ink">
              {pickList.length > 0 && ready ? "02" : "01"}
            </span>{" "}
            Fotos limpias
          </h2>
          <EditPhotoList galleryId={galleryId} photos={photos} />
        </section>
      </div>
    </>
  );
};

export default CleanupPage;
