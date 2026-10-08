import { describe, expect, test } from "vitest";
import {
  cleanEmail,
  cleanHeader,
  detectDayOrder,
  guessField,
  guessMapping,
  type ImportField,
  parseSessionDate,
  prepareRows,
} from "@/lib/client-import";
import { type CsvTable, parseCsv } from "@/lib/csv";

// Headers of the studio's real Typeform → Google Sheets export (no answers).
const TYPEFORM_HEADERS = [
  "Qué tipo de sesión fotográfica desea?",
  "Como desea obtener sus fotos",
  "Qué oferta desea?",
  "Qué oferta desea?",
  "Qué oferta desea?",
  "¿Quieres añadir alguno de estos extras a tu paquete?",
  "¿Quieres añadir alguno de estos extras a tu paquete?",
  "¿Quieres añadir alguno de estos extras a tu paquete?",
  "En que fecha será la boda",
  "Dirección del lugar donde será la boda",
  "¿Ya tienen quién les haga las invitaciones de su boda?",
  "Selecciona el tipo de invitacion que deseas ",
  "Nombre de la novia",
  "Nombre del novio",
  "Cual es tu email",
  "Teléfono de la persona para coordinar",
  "¿Desean añadir cobertura en video para su boda?",
  "Muchos novios al inicio piensan que solo con fotos es suficiente, pero después nos dicen que se arrepienten de no haber tenido video.",
  "Qué oferta desea?",
  "Qué oferta desea?",
  "Qué oferta desea?",
  "Qué oferta desea?",
  "Qué oferta desea?",
  "Opciones adicionales a la oferta escojida",
  "Donde desea su sesión?",
  "Donde desea su sesión?",
  "Cual es el nombre del niño/a?",
  "Que edad tiene {{field:0f5ee03a-3915-4717-9a0b-52d3bc24dc00}}?",
  "¿Cuándo es el cumpleaños de {{field:0f5ee03a-3915-4717-9a0b-52d3bc24dc00}}?",
  "Enhorabuena!! Qué tiempo tienes de embarazo?",
  "*ALGUNOS ASPECTOS A CONOCER:*\n\n-De 1 a 7 días desde el día de la sesión recibirá una galería con la preselección.\n\nLos detalles de la fotos se verán cuando la fotógrafa le escriba, lugar, hora, vestuario etc",
  "*ALGUNOS ASPECTOS A CONOCER:*\n\n-Para reservar su turno, deben abonar un depósito de $100.",
  "Cuál es su nombre?",
  "Cual es su número de teléfono?",
  "Déjanos tu correo para enviarte los detalles de reserva",
  "De todos estos artículos cual te llama más la atención para regalar?",
  "Alguna duda que quieras aclarar?",
  "name",
  "email",
  "Opciones adicionales a la oferta escojida",
  "Submitted At",
  "Token",
];

const typeformRow = (answers: Record<number, string>) =>
  TYPEFORM_HEADERS.map((_, column) => answers[column] ?? "");

const NOW = new Date(2026, 9, 7, 12, 0);
const GENERATED_ID = /^csv:/;

describe("parseCsv", () => {
  test("handles quotes, line breaks inside cells, BOM and CRLF", () => {
    const table = parseCsv(
      '﻿Nombre,"Nota, larga"\r\nAna,"Dijo ""hola""\nen dos líneas"\r\n\r\nLuis,\r\n'
    );

    expect(table.headers).toEqual(["Nombre", "Nota, larga"]);
    expect(table.rows).toEqual([
      ["Ana", 'Dijo "hola"\nen dos líneas'],
      ["Luis", ""],
    ]);
  });

  test("detects semicolons (Excel in Spanish)", () => {
    const table = parseCsv("Cliente;Fecha\nAna;15/11/2026");
    expect(table.rows[0]).toEqual(["Ana", "15/11/2026"]);
  });
});

describe("guessField", () => {
  const guess = (header: string) => guessField(header, ["algo"]);

  test("reads the Typeform export", () => {
    const expected: Record<number, ImportField> = {
      0: "sessionType",
      1: "notes",
      2: "notes",
      8: "sessionDate",
      11: "notes",
      12: "clientName",
      14: "email",
      15: "phone",
      17: "notes",
      24: "notes",
      26: "subject",
      27: "notes",
      28: "notes",
      29: "notes",
      30: "notes",
      32: "clientName",
      33: "phone",
      34: "email",
      36: "notes",
      40: "ignore",
      41: "externalId",
    };

    const actual = Object.fromEntries(
      Object.keys(expected).map((column) => [
        column,
        guess(TYPEFORM_HEADERS[Number(column)] ?? ""),
      ])
    );

    expect(actual).toEqual(expected);
  });

  test("reads a calendar export and the template", () => {
    expect(guess("Subject")).toBe("title");
    expect(guess("Start Date")).toBe("sessionDate");
    expect(guess("Start Time")).toBe("sessionTime");
    expect(guess("End Date")).toBe("ignore");
    expect(guess("Fecha del evento")).toBe("sessionDate");
    expect(guess("Niño/a")).toBe("subject");
    expect(guess("Cliente")).toBe("clientName");
    expect(guess("Apellidos")).toBe("clientLastName");
    expect(guess("Fecha de nacimiento")).toBe("notes");
    expect(guess("¿Alguna duda ahora?")).toBe("notes");
  });

  test("ignores empty and checkbox columns", () => {
    expect(guessField("Cuál es su nombre?", ["", " "])).toBe("ignore");
    expect(guessField("Acepto", ["TRUE", "TRUE", "FALSE"])).toBe("ignore");
  });
});

describe("cleanHeader", () => {
  test("drops Typeform recall tags and markdown", () => {
    expect(cleanHeader(TYPEFORM_HEADERS[27] ?? "")).toBe("Que edad tiene …?");
    expect(cleanHeader(TYPEFORM_HEADERS[30] ?? "").startsWith("ALGUNOS")).toBe(
      true
    );
  });
});

describe("dates", () => {
  const parse = (date: string, time = "", order: "dmy" | "mdy" = "dmy") => {
    const parsed = parseSessionDate(date, time, order, NOW);
    return parsed
      ? {
          y: parsed.date.getFullYear(),
          m: parsed.date.getMonth() + 1,
          d: parsed.date.getDate(),
          h: parsed.date.getHours(),
          min: parsed.date.getMinutes(),
          hasTime: parsed.hasTime,
          inferredYear: parsed.inferredYear,
        }
      : null;
  };

  test("numeric dates in both orders, with or without time", () => {
    expect(parse("15/11/2026")).toMatchObject({
      y: 2026,
      m: 11,
      d: 15,
      hasTime: false,
    });
    expect(parse("11/15/2026", "", "mdy")).toMatchObject({ m: 11, d: 15 });
    expect(parse("15/11/2026", "4:30 PM")).toMatchObject({
      h: 16,
      min: 30,
      hasTime: true,
    });
    expect(parse("16/1/2026 16:55:35")).toMatchObject({
      y: 2026,
      m: 1,
      d: 16,
      h: 16,
      min: 55,
    });
    expect(parse("2026-11-15")).toMatchObject({ m: 11, d: 15 });
    expect(parse("15.11.26", "10:00 a. m.")).toMatchObject({ y: 2026, h: 10 });
  });

  test("month names in Spanish and English", () => {
    expect(parse("15 de noviembre de 2026")).toMatchObject({
      m: 11,
      d: 15,
      inferredYear: false,
    });
    expect(parse("sábado 21 nov 2026 10am")).toMatchObject({
      m: 11,
      d: 21,
      h: 10,
    });
    expect(parse("November 21, 2026")).toMatchObject({ m: 11, d: 21 });
  });

  test("without a year, the next such day", () => {
    expect(parse("Noviembre 20")).toMatchObject({
      y: 2026,
      inferredYear: true,
    });
    expect(parse("3 de enero")).toMatchObject({ y: 2027, m: 1, d: 3 });
    expect(parse("11/15", "", "mdy")).toMatchObject({ y: 2026, m: 11, d: 15 });
  });

  test("rejects what is not a date", () => {
    expect(parse("31/02/2026")).toBeNull();
    expect(parse("El día que me paguen en el trabajo")).toBeNull();
    expect(parse("No es ahora")).toBeNull();
  });

  test("ISO instants keep their offset", () => {
    const parsed = parseSessionDate(
      "2026-11-15T10:00:00-05:00",
      "",
      "dmy",
      NOW
    );
    expect(parsed?.date.toISOString()).toBe("2026-11-15T15:00:00.000Z");
  });

  test("detects the day order from unambiguous values", () => {
    expect(detectDayOrder(["3/4/2026", "15/11/2026"])).toBe("dmy");
    expect(detectDayOrder(["11/15/2026", "3/4/2026"])).toBe("mdy");
    expect(detectDayOrder(["3/4/2026"])).toBeNull();
    expect(detectDayOrder(["15/11/2026", "11/15/2026"])).toBeNull();
  });
});

describe("cleanEmail", () => {
  test("fixes common domain typos and rejects broken addresses", () => {
    expect(cleanEmail("ana@gamil.com")).toEqual({
      email: "ana@gmail.com",
      corrected: "ana@gmail.com",
    });
    expect(cleanEmail("luis@hotmail.com").corrected).toBeNull();
    expect(cleanEmail("sin-arroba.com").email).toBeNull();
  });
});

describe("prepareRows", () => {
  test("turns a Typeform row into a titled card with its answers in notes", () => {
    const table: CsvTable = {
      headers: TYPEFORM_HEADERS,
      rows: [
        typeformRow({
          0: "Niños y familia",
          1: "Impresas y Digitales",
          18: "$285 - 12 FOTOS impresas medida 4x6",
          24: "Exterior",
          26: "Mateo",
          27: "2",
          28: "18 enero",
          30: "TRUE",
          31: "TRUE",
          32: "Ana Prueba",
          33: "+1 305 555 0100",
          34: "ana.prueba@gamil.com",
          40: "16/1/2026 16:55:35",
          41: "tok123",
        }),
        typeformRow({ 0: "NAVIDAD", 26: "Leo", 33: "+13055550101" }),
      ],
    };
    const [first, second] = prepareRows(table, guessMapping(table), {
      dayOrder: "dmy",
      now: NOW,
    });

    expect(first?.status).toBe("warning");
    expect(first?.issues).toEqual([
      "Correo corregido: ana.prueba@gamil.com → ana.prueba@gmail.com.",
    ]);
    expect(first?.input).toMatchObject({
      line: 2,
      clientName: "Ana Prueba",
      email: "ana.prueba@gmail.com",
      phone: "+1 305 555 0100",
      title: "Mateo · Niños y familia",
      sessionAt: null,
      externalId: "tok123",
    });
    expect(first?.input?.notes?.split("\n")).toEqual([
      "• Como desea obtener sus fotos: Impresas y Digitales",
      "• Qué oferta desea?: $285 - 12 FOTOS impresas medida 4x6",
      "• Donde desea su sesión?: Exterior",
      "• Que edad tiene …?: 2",
      "• ¿Cuándo es el cumpleaños de …?: 18 enero",
    ]);

    expect(second?.status).toBe("skip");
    expect(second?.issues).toEqual(["Falta el nombre del cliente."]);
  });

  test("dates, duplicates and an explicit title", () => {
    const table = parseCsv(
      [
        "Cliente,Teléfono,Niño/a,Tipo de sesión,Título,Fecha,Hora",
        "Ana,+13055550100,Mateo,Smash Cake,Mateo 1 año,15/11/2026,10:30",
        "Ana,+13055550100,Mateo,Smash Cake,Mateo 1 año,15/11/2026,10:30",
        "Luis,,,,,mañana,",
        "Eva,,,,,,",
      ].join("\n")
    );
    const rows = prepareRows(table, guessMapping(table), {
      dayOrder: "dmy",
      now: NOW,
    });

    expect(rows.map((row) => row.status)).toEqual([
      "ready",
      "skip",
      "warning",
      "warning",
    ]);
    expect(rows[0]?.input?.title).toBe("Mateo 1 año");
    expect(rows[0]?.input?.notes).toBe(
      "• Niño/a: Mateo\n• Tipo de sesión: Smash Cake"
    );
    expect(rows[0]?.hasTime).toBe(true);
    expect(rows[0]?.input?.externalId).toMatch(GENERATED_ID);
    expect(rows[1]?.issues).toEqual(["Repetida: igual que la fila 2."]);
    expect(rows[2]?.issues).toEqual([
      "Fecha no reconocida («mañana»): se importa sin fecha.",
    ]);
    expect(rows[2]?.input?.title).toBe("Luis");
    expect(rows[3]?.issues).toEqual(["Sin fecha de sesión."]);
  });
});
