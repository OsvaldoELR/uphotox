const withTime = new Intl.DateTimeFormat("es", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const dayOnly = new Intl.DateTimeFormat("es", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const short = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" });

const shortWithYear = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "15 nov" this year, "15 nov 2027" otherwise. */
export const formatShortDate = (iso: string) => {
  const date = new Date(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return (sameYear ? short : shortWithYear).format(date);
};

/**
 * Midnight local time means "only the day is known" (imports from a sheet
 * with just a date): no photo session starts at 00:00.
 */
export const isDayOnly = (date: Date) =>
  date.getHours() === 0 && date.getMinutes() === 0;

/** "sáb, 15 nov 2026, 10:30" — local time; render with suppressHydrationWarning. */
export const formatSessionDate = (iso: string) => {
  const date = new Date(iso);
  return (isDayOnly(date) ? dayOnly : withTime).format(date);
};
