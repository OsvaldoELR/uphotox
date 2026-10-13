import { z } from "zod";

// Same rule as the studios.whatsapp check constraint (E.164 without "+").
const WHATSAPP_DIGITS = /^[1-9]\d{7,14}$/;
const NON_DIGITS = /\D/g;
const INTERNATIONAL_PREFIX = /^00/;
// wa.me needs the country code: 11+ digits ("+1 786…", "+34 612…").
const INTERNATIONAL_NUMBER = /^[1-9]\d{10,14}$/;

/** "+34 612 34 56 78" or "0034…" → "34612345678". */
export const normalizeWhatsapp = (value: string) =>
  value.replace(NON_DIGITS, "").replace(INTERNATIONAL_PREFIX, "");

/** Optional form field: empty → null, otherwise normalized and validated. */
export const whatsappField = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : normalizeWhatsapp(value)))
  .refine((value) => value === null || WHATSAPP_DIGITS.test(value), {
    message:
      "Escribe el WhatsApp con el código de país, por ejemplo +34 612 345 678.",
  });

export const formatWhatsapp = (digits: string) => `+${digits}`;

/** wa.me link, optionally with a prefilled message. */
export const whatsappUrl = (digits: string, message?: string) =>
  message
    ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
    : `https://wa.me/${digits}`;

/** A client's phone as wa.me digits, or null if it lacks the country code. */
export const clientWhatsappDigits = (phone: string | null | undefined) => {
  const digits = phone ? normalizeWhatsapp(phone) : "";
  return INTERNATIONAL_NUMBER.test(digits) ? digits : null;
};
