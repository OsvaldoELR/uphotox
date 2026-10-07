import { z } from "zod";

// Form tools (Make, Zapier, n8n…) send unmapped fields as "" or null.
const blankToUndefined = (value: unknown) =>
  value === "" || value === null ? undefined : value;

const optionalText = (max: number) =>
  z.preprocess(blankToUndefined, z.string().trim().max(max).optional());

const answerValue = z.preprocess(
  (value) => (Array.isArray(value) ? value.join(", ") : value),
  z.union([z.string(), z.number(), z.boolean()]).transform(String)
);

/**
 * Body accepted by POST /webhooks/clients/:token. Only `name` is required.
 * `answers` takes either [{ question, answer }] or { "Question": "Answer" }.
 */
export const inboundClientSchema = z.object({
  name: z
    .string({ error: "Falta el nombre del cliente (name)." })
    .trim()
    .min(1, "Falta el nombre del cliente (name).")
    .max(120),
  email: z.preprocess(
    blankToUndefined,
    z.email("El correo (email) no es válido.").max(320).optional()
  ),
  phone: optionalText(40),
  title: optionalText(120),
  session_at: z.preprocess(
    blankToUndefined,
    z.iso
      .datetime({
        offset: true,
        error:
          "session_at debe ser una fecha ISO 8601, p. ej. 2026-11-02T10:00:00Z.",
      })
      .optional()
  ),
  notes: optionalText(4000),
  answers: z.preprocess(
    blankToUndefined,
    z
      .union([
        z
          .array(
            z.object({
              question: z.string().trim().max(300),
              answer: z.preprocess(blankToUndefined, answerValue.optional()),
            })
          )
          .max(60),
        z.record(
          z.string().max(300),
          z.preprocess(blankToUndefined, answerValue.optional())
        ),
      ])
      .optional()
  ),
  external_id: optionalText(200),
});

export type InboundClient = z.output<typeof inboundClientSchema>;

const toPairs = (answers: InboundClient["answers"]) => {
  if (!answers) {
    return [];
  }

  const pairs = Array.isArray(answers)
    ? answers.map((item) => [item.question, item.answer] as const)
    : Object.entries(answers);

  return pairs.filter(
    (pair): pair is readonly [string, string] =>
      Boolean(pair[0]) && pair[1] !== undefined && pair[1] !== ""
  );
};

/** Card notes: free notes first, then every form answer, one per line. */
export const composeNotes = (payload: InboundClient, receivedAt: Date) => {
  const lines: string[] = [];

  if (payload.notes) {
    lines.push(payload.notes, "");
  }

  const pairs = toPairs(payload.answers);

  if (pairs.length > 0) {
    lines.push("Respuestas del formulario:");
    for (const [question, answer] of pairs) {
      lines.push(`• ${question}: ${answer}`);
    }
    lines.push("");
  }

  lines.push(`Recibido automáticamente el ${receivedAt.toISOString()}.`);

  return lines.join("\n").slice(0, 5000);
};

// Tokens are base64url, 32–64 chars (same rule as the database check).
const TOKEN_PATTERN = /^[\w-]{32,64}$/;

export const isWellFormedToken = (token: string) => TOKEN_PATTERN.test(token);
