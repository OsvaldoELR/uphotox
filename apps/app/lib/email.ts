import "server-only";

import { resend } from "@repo/email";
import type { ReactElement } from "react";
import { env } from "@/env";

/** Notifications are skipped (not failed) until Resend is configured. */
export const isEmailEnabled = () => Boolean(resend && env.RESEND_FROM);

interface SendEmailInput {
  /** Display name, e.g. the studio's name. The address is RESEND_FROM. */
  readonly fromName: string;
  /** `<event-type>/<entity-id>`: Resend drops repeats for 24h. */
  readonly idempotencyKey: string;
  readonly react: ReactElement;
  readonly replyTo?: string | null;
  readonly subject: string;
  readonly to: string;
}

export type SendEmailResult =
  | { status: "disabled" }
  | { status: "failed"; message: string }
  | { status: "sent"; id: string | undefined };

// The SDK returns { data, error } instead of throwing.
export const sendEmail = async ({
  fromName,
  idempotencyKey,
  react,
  replyTo,
  subject,
  to,
}: SendEmailInput): Promise<SendEmailResult> => {
  if (!(resend && env.RESEND_FROM)) {
    return { status: "disabled" };
  }

  const name = fromName.replace(/["<>]/g, "").trim() || "Uphotox";
  const { data, error } = await resend.emails.send(
    {
      from: `${name} <${env.RESEND_FROM}>`,
      to,
      subject,
      react,
      replyTo: replyTo ?? undefined,
    },
    { idempotencyKey }
  );

  if (error) {
    return { status: "failed", message: error.message };
  }

  return { status: "sent", id: data?.id };
};
