import { isDayOnly } from "@/lib/session-date";

const dateTime = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const dateOnly = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
});

const DAY = 86_400_000;
const NAME_SEPARATORS = /[\s@._-]+/;

/**
 * Local time; render inside suppressHydrationWarning (server is UTC).
 * Midnight shows only the day (imported sessions without a time).
 */
export const formatDateTime = (iso: string) => {
  const date = new Date(iso);
  return (isDayOnly(date) ? dateOnly : dateTime).format(date);
};

export const timeInStage = (iso: string) => {
  const days = Math.floor((Date.now() - Date.parse(iso)) / DAY);
  return days <= 0 ? "hoy" : `${days} d`;
};

export const initials = (name: string) =>
  name
    .split(NAME_SEPARATORS)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

/** ISO timestamp → value for <input type="datetime-local"> in local time. */
export const toLocalInput = (iso: string | null) => {
  if (!iso) {
    return "";
  }

  const date = new Date(iso);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

/** datetime-local value → ISO timestamp (the browser knows the timezone). */
export const fromLocalInput = (value: string) =>
  value ? new Date(value).toISOString() : null;

/** Halfway between the neighbours a card is dropped between. */
export const positionBetween = (
  before: number | undefined,
  after: number | undefined
) => {
  if (before === undefined && after === undefined) {
    return 1024;
  }

  if (before === undefined) {
    return (after as number) / 2;
  }

  if (after === undefined) {
    return before + 1024;
  }

  return (before + after) / 2;
};
