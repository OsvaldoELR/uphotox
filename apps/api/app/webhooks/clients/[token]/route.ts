import { createAdminClient } from "@repo/database/admin";
import {
  composeNotes,
  type InboundClient,
  inboundClientSchema,
  isWellFormedToken,
} from "@/lib/inbound-client";

const POSITION_STEP = 1024;

type AdminClient = ReturnType<typeof createAdminClient>;

interface Destination {
  readonly boardId: number;
  readonly stageId: number | null;
  readonly studioId: number;
}

const json = (body: Record<string, unknown>, status: number) =>
  Response.json(body, { status });

const findDuplicate = async (
  supabase: AdminClient,
  studioId: number,
  externalId: string | undefined
) => {
  if (!externalId) {
    return null;
  }

  const { data } = await supabase
    .from("cards")
    .select("id")
    .eq("studio_id", studioId)
    .eq("external_id", externalId)
    .maybeSingle();

  return data;
};

/** The configured stage, or the board's first stage when none is set. */
const resolveStageId = async (
  supabase: AdminClient,
  destination: Destination
) => {
  const query = supabase.from("board_stages").select("id");
  const { data } = destination.stageId
    ? await query.eq("id", destination.stageId).maybeSingle()
    : await query
        .eq("board_id", destination.boardId)
        .order("position")
        .limit(1)
        .maybeSingle();

  return data?.id ?? null;
};

type CreateResult =
  | { status: "created"; cardId: number }
  | { status: "duplicate" }
  | { status: "failed"; message: string };

const createClientCard = async (
  supabase: AdminClient,
  destination: Destination,
  stageId: number,
  payload: InboundClient
): Promise<CreateResult> => {
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert({
      studio_id: destination.studioId,
      full_name: payload.name,
      email: payload.email ?? null,
      phone: payload.phone ?? null,
    })
    .select("id")
    .single();

  if (clientError) {
    return { status: "failed", message: "No se pudo guardar el cliente." };
  }

  const { data: last } = await supabase
    .from("cards")
    .select("position")
    .eq("stage_id", stageId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: card, error } = await supabase
    .from("cards")
    .insert({
      studio_id: destination.studioId,
      board_id: destination.boardId,
      stage_id: stageId,
      client_id: client.id,
      title: payload.title ?? payload.name,
      session_at: payload.session_at ?? null,
      notes: composeNotes(payload, new Date()),
      position: (last?.position ?? 0) + POSITION_STEP,
      source: "webhook",
      external_id: payload.external_id ?? null,
    })
    .select("id")
    .single();

  if (error) {
    await supabase.from("clients").delete().eq("id", client.id);

    // Two deliveries of the same response raced each other.
    return error.code === "23505"
      ? { status: "duplicate" }
      : { status: "failed", message: "No se pudo crear la tarjeta." };
  }

  return { status: "created", cardId: card.id };
};

interface RouteContext {
  readonly params: Promise<{ token: string }>;
}

/**
 * Inbound webhook: a form tool (Typeform through Make, Google Forms, Zapier,
 * n8n…) creates a client and a card in the studio's chosen board/stage.
 *
 * The secret token in the URL identifies the studio. There is no user
 * session, so the service-role client is used and every write is scoped to
 * the integration's studio explicitly.
 */
export const POST = async (request: Request, { params }: RouteContext) => {
  const { token } = await params;

  if (!isWellFormedToken(token)) {
    return json({ error: "Webhook no encontrado." }, 404);
  }

  const supabase = createAdminClient();
  const { data: integration } = await supabase
    .from("studio_integrations")
    .select("id, studio_id, enabled, board_id, stage_id")
    .eq("provider", "webhook")
    .eq("token", token)
    .maybeSingle();

  if (!integration) {
    return json({ error: "Webhook no encontrado." }, 404);
  }

  if (!integration.enabled) {
    return json({ error: "Este webhook está desactivado." }, 403);
  }

  const fail = async (status: number, message: string) => {
    await supabase
      .from("studio_integrations")
      .update({ last_error: message.slice(0, 500) })
      .eq("id", integration.id);
    return json({ error: message }, status);
  };

  const body: unknown = await request.json().catch(() => undefined);
  const parsed = inboundClientSchema.safeParse(body);

  if (!parsed.success) {
    return fail(
      400,
      body === undefined
        ? "El cuerpo debe ser JSON."
        : (parsed.error.issues[0]?.message ?? "Datos no válidos.")
    );
  }

  if (!integration.board_id) {
    return fail(409, "Elige en Ajustes el tablero donde entran los clientes.");
  }

  const destination: Destination = {
    studioId: integration.studio_id,
    boardId: integration.board_id,
    stageId: integration.stage_id,
  };

  // Retries from the form tool must not duplicate the client.
  const existing = await findDuplicate(
    supabase,
    destination.studioId,
    parsed.data.external_id
  );

  if (existing) {
    return json({ ok: true, duplicate: true, card_id: existing.id }, 200);
  }

  const stageId = await resolveStageId(supabase, destination);

  if (!stageId) {
    return fail(409, "El tablero de destino no tiene etapas.");
  }

  const result = await createClientCard(
    supabase,
    destination,
    stageId,
    parsed.data
  );

  if (result.status === "failed") {
    return fail(500, result.message);
  }

  if (result.status === "duplicate") {
    return json({ ok: true, duplicate: true }, 200);
  }

  await supabase
    .from("studio_integrations")
    .update({ last_received_at: new Date().toISOString(), last_error: null })
    .eq("id", integration.id);

  return json({ ok: true, card_id: result.cardId }, 201);
};

export const GET = () =>
  json({ error: "Usa POST con un JSON para crear un cliente." }, 405);
