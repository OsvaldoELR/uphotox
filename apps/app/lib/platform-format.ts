// Pure text helpers for the platform panel (/admin), kept apart from the
// server-only gate in platform.ts so they can be tested.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

const shortDate = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * "hace 5 min", "hace 3 h", "hace 2 d", then the date. Relative on purpose:
 * the server renders in UTC and does not know the viewer's time zone.
 */
export const timeAgo = (iso: string | null, now: Date = new Date()) => {
  if (!iso) {
    return "—";
  }

  const elapsed = now.getTime() - Date.parse(iso);

  if (elapsed < MINUTE) {
    return "ahora";
  }

  if (elapsed < HOUR) {
    return `hace ${Math.floor(elapsed / MINUTE)} min`;
  }

  if (elapsed < DAY) {
    return `hace ${Math.floor(elapsed / HOUR)} h`;
  }

  if (elapsed < 30 * DAY) {
    return `hace ${Math.floor(elapsed / DAY)} d`;
  }

  return shortDate.format(new Date(iso));
};

/** Day of a timestamp, e.g. "18 oct 2026" (UTC). */
export const formatDay = (iso: string) => shortDate.format(new Date(iso));

/** "780 KB", "92,8 MB": one decimal below 100, none above. */
export const formatBytes = (bytes: number) => {
  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }

  const digits = unit === 0 || value >= 100 ? 0 : 1;
  return `${value.toFixed(digits).replace(".", ",")} ${BYTE_UNITS[unit]}`;
};

const monthName = new Intl.DateTimeFormat("es", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** "1 enviada", "6 enviadas": the word given is the singular. */
export const countOf = (count: number, singular: string, plural?: string) =>
  `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;

/** "octubre de 2026" for the first instant of a UTC month. */
export const formatMonth = (iso: string) => monthName.format(new Date(iso));

/** First instant of the UTC month `back` months before `now`'s. */
export const monthsAgo = (back: number, now: Date = new Date()) =>
  new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1)
  ).toISOString();

export interface ActivityEvent {
  readonly actor: string | null;
  readonly card: string | null;
  readonly detail: string | null;
  readonly from: string | null;
  readonly kind: string;
  readonly to: string | null;
}

/** One line of a studio's activity feed (card_events with the card title). */
export const describeActivity = (event: ActivityEvent) => {
  const who = event.actor ?? "Alguien";
  const card = `«${event.card ?? "tarjeta borrada"}»`;
  const from = event.from ?? "—";
  const to = event.to ?? "—";
  const detail = event.detail ? ` · ${event.detail}` : "";

  switch (event.kind) {
    case "created":
      // No actor: the inbound webhook (service role) created it.
      return event.actor
        ? `${who} creó ${card} en ${to}`
        : `${card} llegó por la entrada de clientes a ${to}`;
    case "moved":
      // No actor: moved by the system (e.g. the client confirming photos).
      return event.actor
        ? `${who} movió ${card} de ${from} a ${to}`
        : `${card} pasó de ${from} a ${to}`;
    case "email_sent":
      return `Correo enviado al cliente de ${card}${detail}`;
    case "email_failed":
      return `Correo fallido al cliente de ${card}${detail}`;
    case "gallery_sent":
      return `${who} envió la galería de ${card}`;
    case "gallery_submitted":
      return `El cliente de ${card} confirmó su selección${detail}`;
    case "gallery_reopened":
      return `${who} reabrió la selección de ${card}`;
    default:
      return `${who} · ${event.kind} en ${card}`;
  }
};
