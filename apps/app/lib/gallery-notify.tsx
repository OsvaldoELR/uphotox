import "server-only";

import { createAdminClient } from "@repo/database/admin";
import { GalleryReadyTemplate } from "@repo/email/templates/gallery-ready";
import { SelectionReceivedTemplate } from "@repo/email/templates/selection-received";
import { StageUpdateTemplate } from "@repo/email/templates/stage-update";
import { log } from "@repo/observability/log";
import { env } from "@/env";
import { defaultStageMessage } from "./board-templates";
import { isEmailEnabled, type SendEmailResult, sendEmail } from "./email";
import {
  baseName,
  formatMoney,
  galleryState,
  selectionTotals,
} from "./gallery";
import {
  type ChoicePhoto,
  choiceSummary,
  type ProductChoice,
  type ProductKind,
  productsIntro,
} from "./gallery-products";
import { moduleAvailable } from "./permissions";
import { whatsappUrl } from "./whatsapp";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Public link the client opens (no account needed). */
export const clientGalleryUrl = (token: string) =>
  `${env.NEXT_PUBLIC_APP_URL}/g/${token}`;

const longDate = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "long",
});

const NAME_SPLIT = /\s+/;

const firstName = (fullName: string) =>
  fullName.trim().split(NAME_SPLIT)[0] ?? "";

const studioWhatsapp = (
  digits: string | null,
  studioName: string,
  clientName: string,
  cardTitle: string
) =>
  digits
    ? whatsappUrl(
        digits,
        `Hola ${studioName}, soy ${clientName}. Te escribo por mi galería de «${cardTitle}».`
      )
    : null;

const logEmail = async (
  admin: AdminClient,
  event: { cardId: number; studioId: number; toStageId?: number | null },
  recipient: string,
  result: SendEmailResult
) => {
  if (result.status === "disabled") {
    return;
  }

  await admin.from("card_events").insert({
    studio_id: event.studioId,
    card_id: event.cardId,
    to_stage_id: event.toStageId ?? null,
    kind: result.status === "sent" ? "email_sent" : "email_failed",
    detail:
      result.status === "sent"
        ? recipient
        : `${recipient}: ${result.message}`.slice(0, 500),
  });
};

/**
 * Client link of the card's gallery while the client can still pick, so the
 * stage email can carry «Elegir mis fotos». Read with the service role: the
 * member moving the card may not have the galleries permission.
 */
export const openGalleryUrlForCard = async (cardId: number) => {
  const { data } = await createAdminClient()
    .from("galleries")
    .select("token, status, expires_at, studio:studios(modules, suspended_at)")
    .eq("card_id", cardId)
    .maybeSingle();

  // No «Elegir mis fotos» when the studio has no Galleries right now.
  return data &&
    moduleAvailable(data.studio, "galleries") &&
    galleryState({ status: data.status, expiresAt: data.expires_at }) === "open"
    ? clientGalleryUrl(data.token)
    : null;
};

/** Book and canvas of a gallery, with the client's choices. */
const loadProducts = async (
  admin: AdminClient,
  galleryId: number
): Promise<ProductChoice[]> => {
  const { data } = await admin
    .from("gallery_products")
    .select("id, kind, size_short, size_long, photo_id, back_photo_id")
    .eq("gallery_id", galleryId)
    .order("id");

  return (data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind as ProductKind,
    short: row.size_short,
    long: row.size_long,
    photoId: row.photo_id,
    backPhotoId: row.back_photo_id,
  }));
};

/** «Libro 11×8 horizontal · portada IMG_1234 · …», one line per product. */
const productLines = async (admin: AdminClient, galleryId: number) => {
  const products = await loadProducts(admin, galleryId);
  const ids = products.flatMap((product) =>
    [product.photoId, product.backPhotoId].filter(
      (value): value is number => value !== null
    )
  );

  if (products.length === 0) {
    return [];
  }

  const { data } = ids.length
    ? await admin
        .from("gallery_photos")
        .select("id, file_name, width, height, picked_at")
        .eq("gallery_id", galleryId)
        .in("id", ids)
    : { data: [] };
  const photos = new Map<number, ChoicePhoto>(
    (data ?? []).map((photo) => [
      photo.id,
      {
        name: baseName(photo.file_name),
        width: photo.width ?? 3,
        height: photo.height ?? 2,
        picked: Boolean(photo.picked_at),
      },
    ])
  );

  return products.map((product) => choiceSummary(product, photos));
};

/** «Tus fotos están listas»: sent when the studio sends the gallery. */
export const emailGalleryReady = async (galleryId: number, sendId: string) => {
  if (!isEmailEnabled()) {
    return;
  }

  try {
    await sendGalleryReady(galleryId, sendId);
  } catch (error) {
    log.error("Gallery ready email failed", {
      galleryId,
      error: String(error),
    });
  }
};

const sendGalleryReady = async (galleryId: number, sendId: string) => {
  const admin = createAdminClient();
  const { data: gallery } = await admin
    .from("galleries")
    .select(
      "id, studio_id, card_id, token, status, expires_at, included_count, extra_price, studio:studios(name, whatsapp, owner:profiles!studios_owner_id_fkey(email)), card:cards!galleries_card_id_studio_id_fkey(title, client:clients(full_name, email))"
    )
    .eq("id", galleryId)
    .single();

  const client = gallery?.card?.client;

  if (!(gallery?.studio && gallery.card && client?.email)) {
    return;
  }

  const studioName = gallery.studio.name;
  const products = productsIntro(await loadProducts(admin, gallery.id));
  const result = await sendEmail({
    fromName: studioName,
    to: client.email,
    replyTo: gallery.studio.owner?.email,
    subject: `Tus fotos están listas para elegir · ${studioName}`,
    idempotencyKey: `gallery-ready/${gallery.id}/${sendId}`,
    react: (
      <GalleryReadyTemplate
        clientName={firstName(client.full_name)}
        deadline={
          gallery.expires_at
            ? longDate.format(new Date(gallery.expires_at))
            : "—"
        }
        extraPrice={formatMoney(gallery.extra_price)}
        includedCount={gallery.included_count}
        products={products}
        selectionUrl={clientGalleryUrl(gallery.token)}
        sessionTitle={gallery.card.title}
        studioName={studioName}
        whatsappUrl={studioWhatsapp(
          gallery.studio.whatsapp,
          studioName,
          client.full_name,
          gallery.card.title
        )}
      />
    ),
  });

  await logEmail(
    admin,
    { cardId: gallery.card_id, studioId: gallery.studio_id },
    `Cliente ${client.email}`,
    result
  );
};

interface SubmittedInput {
  readonly fromStageId: number | null;
  readonly galleryId: number;
  readonly toStageId: number | null;
}

/** Everything the «submitted» emails need, read with the service role. */
const loadSubmitted = async (
  admin: AdminClient,
  { galleryId, toStageId }: SubmittedInput
) => {
  const { data: gallery } = await admin
    .from("galleries")
    .select(
      "id, studio_id, card_id, submitted_at, client_note, included_count, extra_price, studio:studios(name, whatsapp, owner:profiles!studios_owner_id_fkey(id, email)), card:cards!galleries_card_id_studio_id_fkey(title, assigned_to, client:clients(full_name, email))"
    )
    .eq("id", galleryId)
    .single();

  if (!(gallery?.studio && gallery.card)) {
    return null;
  }

  const [{ count: picked }, stage, assignee, products] = await Promise.all([
    admin
      .from("gallery_photos")
      .select("id", { count: "exact", head: true })
      .eq("gallery_id", galleryId)
      .not("picked_at", "is", null),
    toStageId
      ? admin
          .from("board_stages")
          .select("id, name, notify_client, client_message")
          .eq("id", toStageId)
          .single()
      : Promise.resolve({ data: null }),
    gallery.card.assigned_to
      ? admin
          .from("profiles")
          .select("id, email")
          .eq("id", gallery.card.assigned_to)
          .single()
      : Promise.resolve({ data: null }),
    productLines(admin, galleryId),
  ]);

  // Owner and assignee, once each.
  const team = new Map<string, string>();

  for (const person of [gallery.studio.owner, assignee.data]) {
    if (person?.email) {
      team.set(person.id, person.email);
    }
  }

  return {
    gallery: { ...gallery, studio: gallery.studio, card: gallery.card },
    picked: picked ?? 0,
    products,
    stage: stage.data,
    team,
  };
};

/**
 * After the client confirms: the stage email to the client (if the card
 * moved into a stage that notifies) and «Selección recibida» to the owner and
 * the card's assignee. Errors are logged, never shown to the client.
 */
export const notifyGallerySubmitted = async (input: SubmittedInput) => {
  if (!isEmailEnabled()) {
    return;
  }

  try {
    const admin = createAdminClient();
    const loaded = await loadSubmitted(admin, input);

    if (!loaded) {
      return;
    }

    const { gallery, picked, products, stage, team } = loaded;
    const studioName = gallery.studio.name;
    const client = gallery.card.client;
    const clientName = client?.full_name ?? "El cliente";
    const event = {
      cardId: gallery.card_id,
      studioId: gallery.studio_id,
      toStageId: input.toStageId,
    };
    const key = `gallery-submitted/${gallery.id}/${gallery.submitted_at}`;

    if (stage?.notify_client && client?.email) {
      const result = await sendEmail({
        fromName: studioName,
        to: client.email,
        replyTo: gallery.studio.owner?.email,
        subject: `${stage.name} · ${studioName}`,
        idempotencyKey: `${key}/client`,
        react: (
          <StageUpdateTemplate
            clientName={client.full_name}
            message={
              stage.client_message?.trim() ||
              defaultStageMessage(stage.name, studioName)
            }
            stageName={stage.name}
            studioName={studioName}
            whatsappUrl={studioWhatsapp(
              gallery.studio.whatsapp,
              studioName,
              client.full_name,
              gallery.card.title
            )}
          />
        ),
      });
      await logEmail(admin, event, `Cliente ${client.email}`, result);
    }

    const totals = selectionTotals({
      picked,
      includedCount: gallery.included_count,
      extraPrice: gallery.extra_price,
    });
    const extras =
      totals.extras > 0
        ? `${totals.extras} ${totals.extras === 1 ? "extra" : "extras"} · ${formatMoney(totals.extraTotal)}`
        : null;

    for (const [personId, email] of team) {
      const result = await sendEmail({
        fromName: "Uphotox",
        to: email,
        subject: `${clientName} eligió sus fotos · ${gallery.card.title}`,
        idempotencyKey: `${key}/team/${personId}`,
        react: (
          <SelectionReceivedTemplate
            cardTitle={gallery.card.title}
            clientName={clientName}
            clientNote={gallery.client_note}
            extras={extras}
            galleryUrl={`${env.NEXT_PUBLIC_APP_URL}/galerias/${gallery.id}`}
            includedCount={gallery.included_count}
            picked={totals.picked}
            products={products}
            stageName={stage?.name}
            studioName={studioName}
          />
        ),
      });
      await logEmail(admin, event, `Equipo ${email}`, result);
    }
  } catch (error) {
    log.error("Gallery submitted notification failed", {
      galleryId: input.galleryId,
      error: String(error),
    });
  }
};
