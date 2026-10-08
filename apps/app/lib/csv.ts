/**
 * Minimal RFC 4180 CSV reader for files exported from Google Sheets, Excel or
 * form tools: quoted fields (with commas, quotes and line breaks inside), a
 * BOM, \r\n or \n line ends, and "," ";" or tab as delimiter.
 */

const DELIMITERS = [",", ";", "\t"] as const;
const BOM = "﻿";

/** UTF-8 when valid; otherwise Windows-1252 (old Excel "CSV" exports). */
export const decodeCsv = (buffer: ArrayBuffer) => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
};

/** The delimiter used most often in the header record, outside quotes. */
export const detectDelimiter = (text: string) => {
  const counts = new Map<string, number>(DELIMITERS.map((d) => [d, 0]));
  let quoted = false;

  for (const char of text) {
    if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && (char === "\n" || char === "\r")) {
      break;
    } else if (!quoted && counts.has(char)) {
      counts.set(char, (counts.get(char) ?? 0) + 1);
    }
  }

  let best: string = DELIMITERS[0];

  for (const [delimiter, count] of counts) {
    if (count > (counts.get(best) ?? 0)) {
      best = delimiter;
    }
  }

  return best;
};

export interface CsvTable {
  readonly headers: string[];
  /** Data records, each padded to headers.length. */
  readonly rows: string[][];
}

/** Reads a quoted field from just after its opening quote ("" = one "). */
const readQuoted = (text: string, start: number) => {
  let value = "";
  let index = start;

  while (index < text.length) {
    const char = text[index];

    if (char !== '"') {
      value += char;
      index++;
    } else if (text[index + 1] === '"') {
      value += '"';
      index += 2;
    } else {
      break;
    }
  }

  // `end` is the closing quote; the caller's loop steps past it.
  return { value, end: index };
};

const parseRecords = (text: string, delimiter: string) => {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";

  for (let index = 0; index < text.length; index++) {
    const char = text[index];

    if (char === '"' && field === "") {
      const quoted = readQuoted(text, index + 1);
      field = quoted.value;
      index = quoted.end;
    } else if (char === delimiter) {
      record.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") {
        index++;
      }
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field !== "" || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  return records;
};

/** First record = headers. Blank records are dropped. */
export const parseCsv = (input: string): CsvTable => {
  const text = input.startsWith(BOM) ? input.slice(1) : input;
  const records = parseRecords(text, detectDelimiter(text)).filter((record) =>
    record.some((cell) => cell.trim() !== "")
  );
  const [header = [], ...data] = records;
  const width = Math.max(header.length, ...data.map((row) => row.length));
  const pad = (row: string[]) =>
    Array.from({ length: width }, (_, index) => row[index] ?? "");

  return {
    headers: pad(header).map((cell) => cell.trim()),
    rows: data.map(pad),
  };
};
