import { z } from "zod";
import type { CsvTable } from "./csv";

/**
 * Client import from a CSV: guess what each column holds, read dates written
 * by people (15/10/2026, 10/15/26 4:30 PM, 15 de octubre…) and turn every row
 * into a card ready for the import_cards RPC. Pure, so it runs in the browser
 * for the live preview and in tests.
 */

export const IMPORT_FIELDS = {
  clientName: "Nombre del cliente",
  clientLastName: "Apellidos del cliente",
  phone: "Teléfono",
  email: "Correo",
  subject: "Niño/a o protagonista",
  sessionType: "Tipo de sesión",
  sessionDate: "Fecha de la sesión",
  sessionTime: "Hora de la sesión",
  title: "Título de la tarjeta",
  externalId: "ID (evita duplicados)",
  notes: "Añadir a las notas",
  ignore: "No importar",
} as const;

export type ImportField = keyof typeof IMPORT_FIELDS;

export const IMPORT_FIELD_KEYS = Object.keys(IMPORT_FIELDS) as ImportField[];

export const MAX_IMPORT_ROWS = 500;

const TITLE_MAX = 120;
const NAME_MAX = 120;
const PHONE_MAX = 40;
const NOTES_MAX = 5000;
const EXTERNAL_ID_MAX = 200;

// --- Text helpers ------------------------------------------------------------

const DIACRITICS = /\p{Diacritic}/gu;
const NON_ALPHANUMERIC = /[^a-z0-9]+/g;
const RECALL_PLACEHOLDER = /\{\{[^}]*\}\}/g;
const ASTERISKS = /\*/g;
const WHITESPACE = /\s+/g;
const NON_DIGITS = /\D/g;

/** "¿Cuál es el nombre del niño/a?" → "cual es el nombre del nino a". */
export const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(NON_ALPHANUMERIC, " ")
    .trim();

const singleLine = (value: string) => value.replace(WHITESPACE, " ").trim();

/** Header as shown in the UI and in notes (Typeform recall tags removed). */
export const cleanHeader = (header: string) => {
  const text = singleLine(
    header.replace(RECALL_PLACEHOLDER, "…").replace(ASTERISKS, "")
  );

  if (!text) {
    return "Sin título";
  }

  return text.length > 70 ? `${text.slice(0, 67).trimEnd()}…` : text;
};

// --- Guessing columns -------------------------------------------------------

const IGNORED = [
  "submitted at",
  "marca temporal",
  "timestamp",
  "end date",
  "end time",
  "fecha de fin",
  "fecha fin",
  "hora de fin",
  "hora fin",
  "all day event",
  "private",
];
const EXTERNAL_ID = [
  "token",
  "id",
  "uid",
  "response id",
  "id externo",
  "external id",
  "identificador",
  "event id",
];
// Checked before "child" and "date": "Edad del niño", "Fecha de nacimiento".
const PERSONAL_DATES = [
  "cumpleanos",
  "nacimiento",
  "birthday",
  "birth",
  "edad",
];
const LAST_NAME = ["apellido", "apellidos", "last name", "surname"];
const SUBJECT = [
  "nino",
  "nina",
  "ninos",
  "ninas",
  "bebe",
  "hijo",
  "hija",
  "hijos",
  "protagonista",
  "baby",
  "child",
  "kid",
];
const EMAIL = ["email", "correo", "mail", "e mail"];
const PHONE = ["telefono", "phone", "celular", "movil", "whatsapp", "tel"];
const TITLE = ["titulo", "title", "subject", "asunto", "evento", "summary"];
const SESSION_TYPE_ONLY = [
  "sesion",
  "servicio",
  "tipo",
  "categoria",
  "service",
];
const DATE = ["fecha", "date"];
const TIME = ["hora", "time"];
const LOOSE_DATE = ["dia", "start", "inicio", "cita"];
const NAME = [
  "nombre",
  "name",
  "cliente",
  "client",
  "mama",
  "madre",
  "papa",
  "padre",
];
const BOOLEAN_VALUE = /^(true|false|verdadero|falso)$/i;
// Long headers are questions or legal text, never a key field.
const KEY_HEADER_MAX = 80;

const mentions = (normalized: string, words: readonly string[]) => {
  const padded = ` ${normalized} `;
  return words.some((word) => padded.includes(` ${word} `));
};

const guessFromHeader = (header: string): ImportField => {
  const text = normalizeText(header);

  if (text.length > KEY_HEADER_MAX) {
    return "notes";
  }

  // First match wins, so the order matters ("Fecha del evento" is a date,
  // "Nombre del niño" is the child, not the client).
  const rules: [boolean, ImportField][] = [
    [IGNORED.includes(text), "ignore"],
    [EXTERNAL_ID.includes(text), "externalId"],
    [mentions(text, PERSONAL_DATES), "notes"],
    [mentions(text, DATE), "sessionDate"],
    [mentions(text, TIME), "sessionTime"],
    [mentions(text, LAST_NAME), "clientLastName"],
    [mentions(text, SUBJECT), "subject"],
    [mentions(text, EMAIL), "email"],
    [mentions(text, PHONE), "phone"],
    [mentions(text, TITLE), "title"],
    [
      SESSION_TYPE_ONLY.includes(text) ||
        (mentions(text, ["tipo"]) && mentions(text, ["sesion", "servicio"])),
      "sessionType",
    ],
    [mentions(text, LOOSE_DATE), "sessionDate"],
    [mentions(text, NAME), "clientName"],
  ];

  return rules.find(([applies]) => applies)?.[1] ?? "notes";
};

/** Best guess for one column, from its header and its values. */
export const guessField = (header: string, values: string[]): ImportField => {
  const filled = values.map((value) => value.trim()).filter(Boolean);

  if (filled.length === 0) {
    return "ignore";
  }

  // Checkbox answers such as the form's "I accept" columns.
  if (filled.every((value) => BOOLEAN_VALUE.test(value))) {
    return "ignore";
  }

  return guessFromHeader(header);
};

export const columnValues = (table: CsvTable, column: number) =>
  table.rows.map((row) => row[column] ?? "");

export const guessMapping = (table: CsvTable): ImportField[] =>
  table.headers.map((header, column) =>
    guessField(header, columnValues(table, column))
  );

// --- Dates --------------------------------------------------------------------

export type DayOrder = "dmy" | "mdy";

const MONTHS: Record<string, number> = {
  ene: 1,
  enero: 1,
  jan: 1,
  january: 1,
  feb: 2,
  febrero: 2,
  february: 2,
  mar: 3,
  marzo: 3,
  march: 3,
  abr: 4,
  abril: 4,
  apr: 4,
  april: 4,
  may: 5,
  mayo: 5,
  jun: 6,
  junio: 6,
  june: 6,
  jul: 7,
  julio: 7,
  july: 7,
  ago: 8,
  agosto: 8,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  septiembre: 9,
  setiembre: 9,
  september: 9,
  oct: 10,
  octubre: 10,
  october: 10,
  nov: 11,
  noviembre: 11,
  november: 11,
  dic: 12,
  diciembre: 12,
  dec: 12,
  december: 12,
};

const ISO_INSTANT =
  /^\d{4}-\d{2}-\d{2}[t ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?\s*(z|[+-]\d{2}:?\d{2})$/i;
const CLOCK = /(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*([ap])\.?\s?m\.?)?/i;
const HOUR_MERIDIEM = /\b(\d{1,2})\s*([ap])\.?\s?m\b\.?/i;
const YEAR_FIRST = /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/;
const NUMERIC_DATE = /\b(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2,4}))?\b/;
const DAY_MONTH_NAME =
  /\b(\d{1,2})(?:st|nd|rd|th)?\s*(?:de\s+)?([a-z]{3,10})\b\.?(?:\s*(?:de\s+|del\s+|,\s*)?(\d{4}))?/;
const MONTH_NAME_DAY =
  /\b([a-z]{3,10})\b\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:\s*,?\s*(?:de\s+)?(\d{4}))?/;

interface DateParts {
  readonly day: number;
  readonly month: number;
  readonly year?: number;
}

interface TimeParts {
  readonly hours: number;
  readonly minutes: number;
}

const toHours = (hours: number, meridiem: string | undefined) => {
  if (!meridiem) {
    return hours;
  }

  const base = hours % 12;
  return meridiem.toLowerCase() === "p" ? base + 12 : base;
};

/** "16:55", "4:30 PM", "4:30 p. m.", "10am" → hours and minutes. */
export const parseTime = (text: string): TimeParts | null => {
  const clock = CLOCK.exec(text);
  const meridiem = clock ? null : HOUR_MERIDIEM.exec(text);
  const hours = clock
    ? toHours(Number(clock[1]), clock[3])
    : meridiem && toHours(Number(meridiem[1]), meridiem[2]);
  const minutes = clock ? Number(clock[2]) : 0;

  if (hours === null || hours === undefined || hours > 23 || minutes > 59) {
    return null;
  }

  return { hours, minutes };
};

const fullYear = (year: string | undefined) => {
  if (!year) {
    return;
  }

  const value = Number(year);
  return year.length <= 2 ? 2000 + value : value;
};

const dateFromNames = (text: string): DateParts | null => {
  const dayFirst = DAY_MONTH_NAME.exec(text);
  const dayFirstMonth = dayFirst ? MONTHS[dayFirst[2] ?? ""] : undefined;

  if (dayFirst && dayFirstMonth) {
    return {
      day: Number(dayFirst[1]),
      month: dayFirstMonth,
      year: fullYear(dayFirst[3]),
    };
  }

  const monthFirst = MONTH_NAME_DAY.exec(text);
  const monthFirstMonth = monthFirst ? MONTHS[monthFirst[1] ?? ""] : undefined;

  if (monthFirst && monthFirstMonth) {
    return {
      day: Number(monthFirst[2]),
      month: monthFirstMonth,
      year: fullYear(monthFirst[3]),
    };
  }

  return null;
};

const dateParts = (text: string, order: DayOrder): DateParts | null => {
  const yearFirst = YEAR_FIRST.exec(text);

  if (yearFirst) {
    return {
      year: Number(yearFirst[1]),
      month: Number(yearFirst[2]),
      day: Number(yearFirst[3]),
    };
  }

  const numeric = NUMERIC_DATE.exec(text);

  if (numeric) {
    const first = Number(numeric[1]);
    const second = Number(numeric[2]);
    return {
      day: order === "dmy" ? first : second,
      month: order === "dmy" ? second : first,
      year: fullYear(numeric[3]),
    };
  }

  return dateFromNames(text);
};

/** DMY or MDY, decided by any value whose day is above 12. */
export const detectDayOrder = (values: string[]): DayOrder | null => {
  let dayFirst = false;
  let monthFirst = false;

  for (const value of values) {
    const text = value.trim();

    if (!text || YEAR_FIRST.test(text)) {
      continue;
    }

    const numeric = NUMERIC_DATE.exec(text);

    if (numeric) {
      dayFirst ||= Number(numeric[1]) > 12;
      monthFirst ||= Number(numeric[2]) > 12;
    }
  }

  if (dayFirst === monthFirst) {
    return null;
  }

  return dayFirst ? "dmy" : "mdy";
};

export interface ParsedSessionDate {
  readonly date: Date;
  readonly hasTime: boolean;
  /** The text had no year: the next matching day was assumed. */
  readonly inferredYear: boolean;
}

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

/**
 * Session date (and optional separate time) in the browser's timezone, as
 * when the date is typed in the card. Without a year, the next such day.
 */
export const parseSessionDate = (
  dateText: string,
  timeText: string,
  order: DayOrder,
  now: Date
): ParsedSessionDate | null => {
  const text = dateText.trim();

  if (ISO_INSTANT.test(text)) {
    const instant = new Date(text);
    return Number.isNaN(instant.getTime())
      ? null
      : { date: instant, hasTime: true, inferredYear: false };
  }

  const normalized = normalizeText(text.replace(CLOCK, " ")).replace(
    HOUR_MERIDIEM,
    " "
  );
  // normalizeText turns "/" into spaces; keep the original separators.
  const parts =
    dateParts(text.toLowerCase(), order) ?? dateFromNames(normalized);

  if (!parts || parts.month < 1 || parts.month > 12 || parts.day < 1) {
    return null;
  }

  const time = parseTime(timeText) ?? parseTime(text);
  const build = (year: number) =>
    new Date(
      year,
      parts.month - 1,
      parts.day,
      time?.hours ?? 0,
      time?.minutes ?? 0
    );

  let date = build(parts.year ?? now.getFullYear());

  if (parts.year === undefined && date < startOfDay(now)) {
    date = build(now.getFullYear() + 1);
  }

  // Rejects 31/02 and friends (Date would roll them into March).
  if (date.getMonth() !== parts.month - 1 || date.getDate() !== parts.day) {
    return null;
  }

  return {
    date,
    hasTime: time !== null,
    inferredYear: parts.year === undefined,
  };
};

// --- Contact fields ------------------------------------------------------------

const DOMAIN_TYPOS: Record<string, string> = {
  "gamil.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gmil.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.comd": "gmail.com",
  "gmail.om": "gmail.com",
  "hotmial.com": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "iclod.com": "icloud.com",
  "icloud.con": "icloud.com",
  "outlook.con": "outlook.com",
};

const emailSchema = z.email();

/** Fixes common domain typos (gamil.com → gmail.com) and validates. */
export const cleanEmail = (raw: string) => {
  const text = raw.trim();
  const at = text.lastIndexOf("@");
  const domain = at > 0 ? text.slice(at + 1).toLowerCase() : "";
  const fixedDomain = DOMAIN_TYPOS[domain];
  const email = fixedDomain ? `${text.slice(0, at)}@${fixedDomain}` : text;

  return {
    email: emailSchema.safeParse(email).success ? email : null,
    corrected: fixedDomain ? email : null,
  };
};

export const phoneDigits = (phone: string) => phone.replace(NON_DIGITS, "");

// --- Rows -------------------------------------------------------------------------

/** One card for the import_cards RPC. */
export interface ImportRowInput {
  readonly clientName: string;
  readonly email: string | null;
  readonly externalId: string;
  readonly line: number;
  readonly notes: string | null;
  readonly phone: string | null;
  readonly sessionAt: string | null;
  readonly title: string;
}

export type RowStatus = "ready" | "warning" | "skip";

export interface PreparedRow {
  readonly clientName: string;
  readonly contact: string;
  readonly hasTime: boolean;
  /** null when the row is skipped. */
  readonly input: ImportRowInput | null;
  readonly issues: string[];
  /** Spreadsheet row number (the header is row 1). */
  readonly line: number;
  readonly sessionAt: string | null;
  readonly status: RowStatus;
  readonly title: string;
}

interface CollectedRow {
  readonly first: Partial<Record<ImportField, string>>;
  readonly noteLines: string[];
}

const truncate = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;

/** Stable, dependency-free hash for the duplicate key (not for security). */
const hashText = (text: string) => {
  let a = 7;
  let b = 13;

  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    a = (a * 131 + code) % 2_147_483_647;
    b = (b * 257 + code) % 2_147_483_629;
  }

  return `${a.toString(36)}${b.toString(36)}`;
};

const collect = (
  headers: string[],
  row: string[],
  mapping: ImportField[]
): CollectedRow => {
  const first: Partial<Record<ImportField, string>> = {};
  const noteLines: string[] = [];

  for (const [column, field] of mapping.entries()) {
    const value = singleLine(row[column] ?? "");

    if (!value || field === "ignore") {
      continue;
    }

    if (field === "notes") {
      const line = `• ${cleanHeader(headers[column] ?? "")}: ${value}`;

      if (!noteLines.includes(line)) {
        noteLines.push(line);
      }
    } else if (!first[field]) {
      first[field] = value;
    }
  }

  return { first, noteLines };
};

interface RowContext {
  readonly dateMapped: boolean;
  readonly options: PrepareOptions;
}

export interface PrepareOptions {
  readonly dayOrder: DayOrder;
  readonly now: Date;
}

interface DateOutcome {
  readonly hasTime: boolean;
  readonly sessionAt: string | null;
}

const resolveDate = (
  { first }: CollectedRow,
  context: RowContext,
  issues: string[],
  notes: string[]
): DateOutcome => {
  const dateText = first.sessionDate ?? "";
  const timeText = first.sessionTime ?? "";

  if (!dateText) {
    if (context.dateMapped) {
      issues.push("Sin fecha de sesión.");
    }
    return { sessionAt: null, hasTime: false };
  }

  const { dayOrder, now } = context.options;
  const parsed = parseSessionDate(dateText, timeText, dayOrder, now);

  if (!parsed) {
    issues.push(`Fecha no reconocida («${dateText}»): se importa sin fecha.`);
    notes.push(`• Fecha indicada: ${[dateText, timeText].join(" ").trim()}`);
    return { sessionAt: null, hasTime: false };
  }

  if (timeText && !parseTime(timeText)) {
    issues.push(`Hora no reconocida («${timeText}»).`);
  }

  if (parsed.inferredYear) {
    issues.push(`Sin año: se asume ${parsed.date.getFullYear()}.`);
  }

  if (parsed.date < startOfDay(now)) {
    issues.push("La fecha ya pasó.");
  }

  return { sessionAt: parsed.date.toISOString(), hasTime: parsed.hasTime };
};

const resolveContact = (
  { first }: CollectedRow,
  issues: string[],
  notes: string[]
) => {
  let email: string | null = null;

  if (first.email) {
    const cleaned = cleanEmail(first.email);
    email = cleaned.email;

    if (!email) {
      issues.push(
        `Correo no válido («${first.email}»): se guarda en las notas.`
      );
      notes.push(`• Correo (no válido): ${first.email}`);
    } else if (cleaned.corrected) {
      issues.push(`Correo corregido: ${first.email} → ${cleaned.corrected}.`);
    }
  }

  let phone = first.phone ?? null;

  if (phone && phone.length > PHONE_MAX) {
    issues.push("Teléfono demasiado largo: se guarda en las notas.");
    notes.push(`• Teléfono: ${phone}`);
    phone = null;
  }

  return { email, phone };
};

const resolveTitle = (
  { first }: CollectedRow,
  clientName: string,
  notes: string[]
) => {
  const composed = [first.subject, first.sessionType]
    .filter(Boolean)
    .join(" · ");

  // With an explicit title, the child and type still go somewhere visible.
  if (first.title) {
    if (first.subject) {
      notes.push(`• Niño/a: ${first.subject}`);
    }
    if (first.sessionType) {
      notes.push(`• Tipo de sesión: ${first.sessionType}`);
    }
  }

  return truncate(first.title ?? (composed || clientName), TITLE_MAX);
};

const prepareRow = (
  headers: string[],
  row: string[],
  index: number,
  mapping: ImportField[],
  context: RowContext
): PreparedRow => {
  const line = index + 2;
  const collected = collect(headers, row, mapping);
  const { first } = collected;
  const issues: string[] = [];
  const extraNotes: string[] = [];
  const fullName = singleLine(
    [first.clientName, first.clientLastName].filter(Boolean).join(" ")
  );
  const clientName = truncate(fullName, NAME_MAX);

  if (fullName.length > NAME_MAX) {
    issues.push("Nombre recortado a 120 caracteres.");
  }

  const { email, phone } = resolveContact(collected, issues, extraNotes);
  const contact = [phone, email].filter(Boolean).join(" · ");
  const { sessionAt, hasTime } = resolveDate(
    collected,
    context,
    issues,
    extraNotes
  );

  if (!clientName) {
    return {
      line,
      status: "skip",
      issues: ["Falta el nombre del cliente."],
      input: null,
      title: first.title ?? first.subject ?? "—",
      clientName: "—",
      contact,
      sessionAt,
      hasTime,
    };
  }

  const titleNotes: string[] = [];
  const title = resolveTitle(collected, clientName, titleNotes);
  const allNotes = [...titleNotes, ...collected.noteLines, ...extraNotes].join(
    "\n"
  );

  if (allNotes.length > NOTES_MAX) {
    issues.push("Notas recortadas a 5000 caracteres.");
  }

  const externalId = first.externalId
    ? truncate(first.externalId, EXTERNAL_ID_MAX)
    : `csv:${hashText(
        [
          normalizeText(clientName),
          email?.toLowerCase() ?? "",
          phoneDigits(phone ?? ""),
          normalizeText(title),
          normalizeText(
            `${first.sessionDate ?? ""} ${first.sessionTime ?? ""}`
          ),
        ].join("|")
      )}`;

  return {
    line,
    status: issues.length > 0 ? "warning" : "ready",
    issues,
    title,
    clientName,
    contact,
    sessionAt,
    hasTime,
    input: {
      line,
      clientName,
      email,
      phone,
      title,
      sessionAt,
      notes: allNotes ? truncate(allNotes, NOTES_MAX) : null,
      externalId,
    },
  };
};

/** Every data row of the file, ready to preview and import. */
export const prepareRows = (
  table: CsvTable,
  mapping: ImportField[],
  options: PrepareOptions
): PreparedRow[] => {
  const context: RowContext = {
    options,
    dateMapped: mapping.includes("sessionDate"),
  };
  const seen = new Map<string, number>();

  return table.rows.map((row, index) => {
    const prepared = prepareRow(table.headers, row, index, mapping, context);
    const key = prepared.input?.externalId;

    if (!key) {
      return prepared;
    }

    const firstLine = seen.get(key);

    if (firstLine !== undefined) {
      return {
        ...prepared,
        status: "skip",
        issues: [`Repetida: igual que la fila ${firstLine}.`],
        input: null,
      };
    }

    seen.set(key, prepared.line);
    return prepared;
  });
};

/**
 * Splits rows into requests under a byte budget (server actions accept
 * ~1 MB). Each batch is one transaction; re-sending an imported row is a
 * no-op, so retrying after a failed batch is safe.
 */
export const batchRows = <T>(rows: T[], maxBytes: number): T[][] => {
  const encoder = new TextEncoder();
  const batches: T[][] = [];
  let current: T[] = [];
  let size = 0;

  for (const row of rows) {
    const rowSize = encoder.encode(JSON.stringify(row)).length + 1;

    if (current.length > 0 && size + rowSize > maxBytes) {
      batches.push(current);
      current = [];
      size = 0;
    }

    current.push(row);
    size += rowSize;
  }

  if (current.length > 0) {
    batches.push(current);
  }

  return batches;
};

/** Starter file whose headers the importer recognises on its own. */
export const IMPORT_TEMPLATE = [
  "Cliente,Teléfono,Correo,Niño/a,Tipo de sesión,Fecha,Hora,Notas",
  "María Pérez,+1 786 555 0100,maria@example.com,Mateo,Smash Cake,15/11/2026,10:30,Paquete de 20 fotos",
].join("\n");
