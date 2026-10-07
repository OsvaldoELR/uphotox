import { describe, expect, test } from "vitest";
import {
  composeNotes,
  inboundClientSchema,
  isWellFormedToken,
} from "../lib/inbound-client";

const receivedAt = new Date("2026-10-07T12:00:00Z");

describe("inboundClientSchema", () => {
  test("accepts the minimal payload", () => {
    const result = inboundClientSchema.safeParse({ name: "Ana García" });
    expect(result.success).toBe(true);
  });

  test("treats empty fields from Make/Zapier as missing", () => {
    const result = inboundClientSchema.parse({
      name: " Ana ",
      email: "",
      phone: null,
      session_at: "",
      external_id: "",
    });

    expect(result).toEqual({ name: "Ana" });
  });

  test("rejects a missing name and an invalid email with a clear message", () => {
    expect(inboundClientSchema.safeParse({}).error?.issues[0]?.message).toBe(
      "Falta el nombre del cliente (name)."
    );
    expect(
      inboundClientSchema.safeParse({ name: "Ana", email: "nope" }).error
        ?.issues[0]?.message
    ).toBe("El correo (email) no es válido.");
  });

  test("requires ISO dates with timezone", () => {
    expect(
      inboundClientSchema.safeParse({
        name: "Ana",
        session_at: "2026-11-02T10:00:00Z",
      }).success
    ).toBe(true);
    expect(
      inboundClientSchema.safeParse({ name: "Ana", session_at: "mañana" })
        .success
    ).toBe(false);
  });
});

describe("composeNotes", () => {
  test("lists answers given as an array, skipping empty ones", () => {
    const payload = inboundClientSchema.parse({
      name: "Ana",
      notes: "Prefiere tarde",
      answers: [
        { question: "Tipo de sesión", answer: "Familia" },
        { question: "Mascotas", answer: "" },
        { question: "Personas", answer: 4 },
        { question: "Estilos", answer: ["Exterior", "Estudio"] },
      ],
    });

    expect(composeNotes(payload, receivedAt)).toBe(
      [
        "Prefiere tarde",
        "",
        "Respuestas del formulario:",
        "• Tipo de sesión: Familia",
        "• Personas: 4",
        "• Estilos: Exterior, Estudio",
        "",
        "Recibido automáticamente el 2026-10-07T12:00:00.000Z.",
      ].join("\n")
    );
  });

  test("accepts answers as an object", () => {
    const payload = inboundClientSchema.parse({
      name: "Ana",
      answers: { "¿Cómo nos conociste?": "Instagram" },
    });

    expect(composeNotes(payload, receivedAt)).toContain(
      "• ¿Cómo nos conociste?: Instagram"
    );
  });
});

test("isWellFormedToken", () => {
  expect(isWellFormedToken("a".repeat(43))).toBe(true);
  expect(isWellFormedToken("short")).toBe(false);
  expect(isWellFormedToken(`${"a".repeat(40)}/../x`)).toBe(false);
});
