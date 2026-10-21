import type { createAdminClient } from "@repo/database/admin";
import { HudLabel } from "@repo/design-system/components/hud/hud-label";
import { cn } from "@repo/design-system/lib/utils";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { GalleryStateChip } from "@/components/gallery-state-chip";
import {
  EDIT_LEVEL_LABELS,
  EDIT_MODE_LABELS,
  EDIT_MODEL_LABELS,
  formatCost,
  monthStart,
  toChoice,
} from "@/lib/editor";
import { formatMoney, galleryState } from "@/lib/gallery";
import { ALL_PERMISSIONS, ROLES, toModules } from "@/lib/permissions";
import { requirePlatformAdmin } from "@/lib/platform";
import {
  type AccessSnapshot,
  countOf,
  describeAccessChange,
  describeActivity,
  formatBytes,
  formatDay,
  formatMonth,
  monthsAgo,
  timeAgo,
} from "@/lib/platform-format";
import { formatWhatsapp } from "@/lib/whatsapp";
import { Header } from "../../../(authenticated)/components/header";
import { AccessForm } from "./components/access-form";

export const metadata: Metadata = {
  title: "Estudio · Superadmin · Uphotox",
  description: "Lo que hay y lo que pasa dentro de un estudio.",
};

const USAGE_MONTHS = 6;
const ACTIVITY_LIMIT = 40;
const AUDIT_LIMIT = 20;

const meta =
  "font-mono text-[10px] text-muted-foreground uppercase tracking-[0.16em]";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Everything the page shows about one studio. Service role: every query
 * must stay scoped to this studio's id.
 */
const loadStudio = async (admin: AdminClient, studioId: number) => {
  const [
    { data: studio },
    { data: allStats },
    { data: members },
    { data: boards },
    { data: stageCounts },
    { data: events },
    { data: galleries },
    { data: usage },
    { data: integrations },
    { data: audit },
  ] = await Promise.all([
    admin
      .from("studios")
      .select("*, owner:profiles!studios_owner_id_fkey(full_name, email)")
      .eq("id", studioId)
      .maybeSingle(),
    admin.rpc("platform_studio_stats", { since: monthStart() }),
    admin
      .from("studio_members")
      .select(
        "user_id, role, permissions, only_assigned, created_at, profiles(full_name, email)"
      )
      .eq("studio_id", studioId)
      .order("created_at"),
    admin
      .from("boards")
      .select("id, name, board_stages(id, name, position)")
      .eq("studio_id", studioId)
      .order("created_at"),
    admin.rpc("platform_stage_counts", { target_studio: studioId }),
    admin
      .from("card_events")
      .select(
        "id, kind, detail, created_at, actor:profiles!card_events_actor_id_fkey(full_name, email), card:cards!card_events_card_id_studio_id_fkey(title), from:board_stages!card_events_from_stage_id_fkey(name), to:board_stages!card_events_to_stage_id_fkey(name)"
      )
      .eq("studio_id", studioId)
      .order("id", { ascending: false })
      .limit(ACTIVITY_LIMIT),
    admin
      .from("galleries")
      .select(
        "id, status, expires_at, sent_at, submitted_at, purged_at, created_at, card:cards!galleries_card_id_studio_id_fkey(title)"
      )
      .eq("studio_id", studioId)
      .order("created_at", { ascending: false })
      .limit(20),
    admin.rpc("platform_studio_usage", {
      target_studio: studioId,
      since: monthsAgo(USAGE_MONTHS - 1),
    }),
    admin
      .from("studio_integrations")
      .select("provider, enabled, last_received_at, last_error")
      .eq("studio_id", studioId),
    admin
      .from("platform_audit")
      .select(
        "id, detail, created_at, actor:profiles!platform_audit_actor_id_fkey(full_name, email)"
      )
      .eq("studio_id", studioId)
      .order("id", { ascending: false })
      .limit(AUDIT_LIMIT),
  ]);

  if (!studio) {
    return null;
  }

  // Last sign-in lives in Supabase Auth, not in the public schema.
  const lastSignIns = new Map(
    await Promise.all(
      (members ?? []).map(async (member) => {
        const { data } = await admin.auth.admin.getUserById(member.user_id);
        return [member.user_id, data.user?.last_sign_in_at ?? null] as const;
      })
    )
  );
  const counts = new Map(
    (stageCounts ?? []).map((row) => [row.stage_id, Number(row.cards)])
  );

  return {
    studio,
    stats: allStats?.find((row) => row.studio_id === studioId),
    members: (members ?? []).map((member) => ({
      ...member,
      lastSignIn: lastSignIns.get(member.user_id) ?? null,
    })),
    boards: (boards ?? []).map((board) => {
      const stages = [...board.board_stages]
        .sort((a, b) => a.position - b.position)
        .map((stage) => ({ ...stage, count: counts.get(stage.id) ?? 0 }));

      return {
        id: board.id,
        name: board.name,
        stages,
        total: stages.reduce((sum, stage) => sum + stage.count, 0),
      };
    }),
    events: (events ?? []).map((event) => ({
      id: event.id,
      at: event.created_at,
      failed: event.kind === "email_failed",
      text: describeActivity({
        kind: event.kind,
        detail: event.detail,
        actor: event.actor?.full_name ?? event.actor?.email ?? null,
        card: event.card?.title ?? null,
        from: event.from?.name ?? null,
        to: event.to?.name ?? null,
      }),
    })),
    galleries: galleries ?? [],
    usage: usage ?? [],
    integrations: integrations ?? [],
    audit: (audit ?? []).map((entry) => {
      const detail = (entry.detail ?? {}) as {
        readonly after?: AccessSnapshot;
        readonly before?: AccessSnapshot;
      };

      return {
        id: entry.id,
        at: entry.created_at,
        actor: entry.actor?.full_name ?? entry.actor?.email ?? "Uphotox",
        lines: describeAccessChange(detail.before ?? {}, detail.after ?? {}),
      };
    }),
  };
};

type StudioData = NonNullable<Awaited<ReturnType<typeof loadStudio>>>;

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

const Section = ({
  children,
  index,
  title,
}: {
  readonly children: ReactNode;
  readonly index: number;
  readonly title: string;
}) => (
  <section className="grid gap-3">
    <h2 className="flex items-baseline gap-2 font-bold font-mono text-sm uppercase tracking-[0.12em]">
      <span className="text-signal-ink">{String(index).padStart(2, "0")}</span>{" "}
      {title}
    </h2>
    {children}
  </section>
);

const Empty = ({ children }: { readonly children: ReactNode }) => (
  <p className="border border-dashed px-4 py-8 text-center text-muted-foreground text-sm">
    {children}
  </p>
);

const Setting = ({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) => (
  <div className="grid gap-0.5 bg-card px-4 py-3 sm:grid-cols-[14rem_1fr] sm:gap-4">
    <dt className={meta}>{label}</dt>
    <dd className="text-sm">{children}</dd>
  </div>
);

const Summary = ({ studio, stats }: Pick<StudioData, "studio" | "stats">) => {
  const n = (value: number | undefined) => String(value ?? 0);

  return (
    <section className="flex flex-col gap-4">
      <HudLabel align="start">Estudio · {String(studio.id)}</HudLabel>
      <div className="grid gap-1">
        <h1 className="font-black font-mono text-3xl uppercase tracking-[-0.02em] md:text-4xl">
          {studio.name}
        </h1>
        <p className="text-muted-foreground text-sm">
          {studio.owner?.full_name ?? "Sin nombre"} ·{" "}
          {studio.owner?.email ?? "sin correo"} · desde{" "}
          {formatDay(studio.created_at)} · última actividad{" "}
          {timeAgo(stats?.last_activity ?? null)}
        </p>
      </div>
      {studio.suspended_at && (
        <p className="border border-flare/40 bg-flare/10 px-4 py-3 text-flare text-sm">
          Pausado {timeAgo(studio.suspended_at)}
          {studio.suspended_reason ? ` · «${studio.suspended_reason}»` : ""}.
          Nadie del equipo puede entrar.
        </p>
      )}
      <dl className="grid grid-cols-2 gap-px border bg-border sm:grid-cols-4">
        <Stat label="Usuarios" value={n(stats?.members)} />
        <Stat label="Tarjetas" value={n(stats?.cards)} />
        <Stat label="Clientes" value={n(stats?.clients)} />
        <Stat label="Galerías enviadas" value={n(stats?.galleries_sent)} />
        <Stat
          label="Selecciones recibidas"
          value={n(stats?.galleries_submitted)}
        />
        <Stat label="Fotos subidas" value={n(stats?.photos)} />
        <Stat
          label="Almacenamiento"
          value={formatBytes(Number(stats?.storage_bytes ?? 0))}
        />
        <Stat
          label="IA este mes"
          value={formatCost(Number(stats?.ai_cost_since ?? 0))}
        />
      </dl>
    </section>
  );
};

const Members = ({ members }: Pick<StudioData, "members">) => (
  <ul className="divide-y border bg-card">
    {members.map((member) => (
      <li
        className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-3"
        key={member.user_id}
      >
        <div className="min-w-0">
          <p className="truncate font-medium">
            {member.profiles?.full_name ??
              member.profiles?.email ??
              "Sin nombre"}
          </p>
          <p className="truncate text-muted-foreground text-xs">
            {member.profiles?.email}
          </p>
        </div>
        <p className={cn(meta, "flex flex-wrap gap-x-3")}>
          <span className="text-signal-ink">{ROLES[member.role].label}</span>
          <span>
            {member.role === "owner"
              ? ALL_PERMISSIONS.length
              : member.permissions.length}
            /{ALL_PERMISSIONS.length} permisos
          </span>
          {member.role !== "owner" && member.only_assigned && (
            <span className="text-flare">Solo asignadas</span>
          )}
          <span>
            {member.lastSignIn
              ? `Entró ${timeAgo(member.lastSignIn)}`
              : "Nunca ha entrado"}
          </span>
        </p>
      </li>
    ))}
  </ul>
);

// Like the dashboard's BoardPipeline, without the link to the board.
const Boards = ({ boards }: Pick<StudioData, "boards">) => {
  if (boards.length === 0) {
    return <Empty>No ha creado ningún tablero.</Empty>;
  }

  return boards.map((board) => (
    <div className="grid gap-3 border bg-card p-4" key={board.id}>
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="truncate font-bold font-mono text-sm uppercase tracking-[0.12em]">
          {board.name}
        </h3>
        <span className={meta}>{countOf(board.total, "tarjeta")}</span>
      </div>
      <ol className="grid auto-cols-[minmax(6.5rem,1fr)] grid-flow-col gap-px overflow-x-auto border bg-border">
        {board.stages.map((stage) => (
          <li
            className="flex flex-col gap-1 bg-popover px-3 py-2.5"
            key={stage.id}
          >
            <span
              className={cn(
                "font-black font-mono text-xl tabular-nums leading-none",
                stage.count > 0 ? "text-signal-ink" : "text-muted-foreground/50"
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
    </div>
  ));
};

const Activity = ({ events }: Pick<StudioData, "events">) => (
  <>
    {events.length === 0 ? (
      <Empty>Sin actividad todavía.</Empty>
    ) : (
      <ol className="divide-y border bg-card">
        {events.map((event) => (
          <li
            className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5 px-4 py-2.5"
            key={event.id}
          >
            <span className={cn("text-sm", event.failed && "text-destructive")}>
              {event.text}
            </span>
            <span className={cn(meta, "shrink-0")}>{timeAgo(event.at)}</span>
          </li>
        ))}
      </ol>
    )}
    <p className="text-muted-foreground text-xs">
      Los últimos {ACTIVITY_LIMIT} movimientos de tarjetas, correos y galerías.
    </p>
  </>
);

const galleryDates = (gallery: StudioData["galleries"][number]) =>
  [
    gallery.sent_at && `Enviada ${timeAgo(gallery.sent_at)}`,
    gallery.submitted_at && `Elegida ${timeAgo(gallery.submitted_at)}`,
    gallery.purged_at && "Fotos borradas",
  ]
    .filter(Boolean)
    .join(" · ") || `Creada ${timeAgo(gallery.created_at)}`;

const Galleries = ({ galleries }: Pick<StudioData, "galleries">) => {
  if (galleries.length === 0) {
    return <Empty>No ha creado ninguna galería.</Empty>;
  }

  return (
    <ul className="divide-y border bg-card">
      {galleries.map((gallery) => (
        <li
          className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-3"
          key={gallery.id}
        >
          <span className="truncate font-medium">
            {gallery.card?.title ?? "Tarjeta borrada"}
          </span>
          <span className="flex flex-wrap items-center gap-3">
            <span className={meta}>{galleryDates(gallery)}</span>
            <GalleryStateChip
              state={galleryState({
                status: gallery.status,
                expiresAt: gallery.expires_at,
              })}
            />
          </span>
        </li>
      ))}
    </ul>
  );
};

const EditorUsage = ({
  studio,
  stats,
  usage,
}: Pick<StudioData, "studio" | "stats" | "usage">) => {
  const choice = toChoice({
    mode: studio.editor_mode,
    level: studio.editor_level,
    model: studio.editor_model,
  });

  return (
    <>
      <dl className="grid gap-px border bg-border">
        <Setting label="Por defecto">
          {EDIT_MODE_LABELS[choice.mode]} · {EDIT_LEVEL_LABELS[choice.level]}
          {choice.level === 1 && ` · ${EDIT_MODEL_LABELS[choice.model]}`}
        </Setting>
        <Setting label="Límite mensual del estudio">
          {studio.editor_monthly_limit === null
            ? "Sin límite"
            : formatCost(Number(studio.editor_monthly_limit))}
        </Setting>
        <Setting label="Tope de la plataforma">
          {studio.editor_platform_limit === null
            ? "Sin tope"
            : formatCost(Number(studio.editor_platform_limit))}
        </Setting>
        <Setting label="Consumo total">
          {formatCost(Number(stats?.ai_cost_total ?? 0))}
        </Setting>
      </dl>
      {usage.length === 0 ? (
        <Empty>
          No ha usado el Editor en los últimos {USAGE_MONTHS} meses.
        </Empty>
      ) : (
        <div className="overflow-x-auto border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr className={meta}>
                <th className="px-4 py-2.5 text-left font-normal">Mes</th>
                <th className="px-4 py-2.5 text-right font-normal">Fotos</th>
                <th className="px-4 py-2.5 text-right font-normal">Intentos</th>
                <th className="px-4 py-2.5 text-right font-normal">Coste</th>
              </tr>
            </thead>
            <tbody className="divide-y font-mono text-xs tabular-nums">
              {usage.map((month) => (
                <tr key={month.month}>
                  <td className="px-4 py-2.5 font-sans text-sm first-letter:uppercase">
                    {formatMonth(month.month)}
                  </td>
                  <td className="px-4 py-2.5 text-right">{month.photos}</td>
                  <td className="px-4 py-2.5 text-right">{month.runs}</td>
                  <td className="px-4 py-2.5 text-right">
                    {formatCost(Number(month.cost))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

const Access = ({
  audit,
  stats,
  studio,
}: Pick<StudioData, "audit" | "stats" | "studio">) => (
  <>
    <AccessForm
      access={{
        modules: toModules(studio.modules),
        aiLimit:
          studio.editor_platform_limit === null
            ? null
            : Number(studio.editor_platform_limit),
        paused: Boolean(studio.suspended_at),
        reason: studio.suspended_reason ?? "",
      }}
      monthUsed={Number(stats?.ai_cost_since ?? 0)}
      studioId={studio.id}
    />
    {audit.length > 0 && (
      <ol className="divide-y border bg-card">
        {audit.map((entry) => (
          <li
            className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5 px-4 py-2.5"
            key={entry.id}
          >
            <span className="text-sm">
              {entry.lines.join(" · ") || "Sin cambios visibles"}
            </span>
            <span className={cn(meta, "shrink-0")}>
              {entry.actor} · {timeAgo(entry.at)}
            </span>
          </li>
        ))}
      </ol>
    )}
  </>
);

const Settings = ({
  studio,
  integrations,
}: Pick<StudioData, "studio" | "integrations">) => (
  <dl className="grid gap-px border bg-border">
    <Setting label="WhatsApp">
      {studio.whatsapp ? formatWhatsapp(studio.whatsapp) : "Sin poner"}
    </Setting>
    <Setting label="Precio de foto extra">
      {formatMoney(Number(studio.extra_photo_price))}
    </Setting>
    <Setting label="Entrada de clientes">
      {integrations.length === 0
        ? "Sin configurar"
        : integrations.map((integration) => (
            <span className="block" key={integration.provider}>
              {integration.enabled ? "Activa" : "Pausada"} ·{" "}
              {integration.last_received_at
                ? `último cliente recibido ${timeAgo(integration.last_received_at)}`
                : "todavía no ha recibido nada"}
              {integration.last_error && (
                <span className="block text-destructive text-xs">
                  {integration.last_error}
                </span>
              )}
            </span>
          ))}
    </Setting>
  </dl>
);

interface StudioPageProperties {
  readonly params: Promise<{ studioId: string }>;
}

const StudioPage = async ({ params }: StudioPageProperties) => {
  const { admin } = await requirePlatformAdmin();
  const { studioId: raw } = await params;
  const studioId = Number(raw);

  if (!Number.isSafeInteger(studioId) || studioId <= 0) {
    notFound();
  }

  const data = await loadStudio(admin, studioId);

  if (!data) {
    notFound();
  }

  return (
    <>
      <Header
        page={data.studio.name}
        trail={[{ label: "Estudios", href: "/admin" }]}
      />
      <div className="flex flex-1 flex-col gap-10 px-4 pt-4 pb-12 md:px-10">
        <Summary stats={data.stats} studio={data.studio} />
        <Section index={1} title="Acceso">
          <Access audit={data.audit} stats={data.stats} studio={data.studio} />
        </Section>
        <Section index={2} title="Equipo">
          <Members members={data.members} />
        </Section>
        <Section index={3} title="Tableros">
          <Boards boards={data.boards} />
        </Section>
        <Section index={4} title="Actividad reciente">
          <Activity events={data.events} />
        </Section>
        <Section index={5} title="Galerías">
          <Galleries galleries={data.galleries} />
        </Section>
        <Section index={6} title="Editor">
          <EditorUsage
            stats={data.stats}
            studio={data.studio}
            usage={data.usage}
          />
        </Section>
        <Section index={7} title="Ajustes">
          <Settings integrations={data.integrations} studio={data.studio} />
        </Section>
      </div>
    </>
  );
};

export default StudioPage;
