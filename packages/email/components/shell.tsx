import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

// Email clients need literal colors: these mirror the app's "mesa de luz"
// tokens (lightbox, ink, signal-ink, signal).
export const colors = {
  lightbox: "#f3f7fa",
  ink: "#141c2e",
  muted: "#5b6577",
  border: "#dfe6ee",
  signalInk: "#0b6f8a",
  signal: "#22d3ee",
};

const PARAGRAPH_BREAK = /\n{2,}/;

export const mono =
  "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

interface ShellProps {
  readonly children: ReactNode;
  readonly footer: string;
  readonly preview: string;
  readonly studioName: string;
}

export const Shell = ({
  children,
  footer,
  preview,
  studioName,
}: ShellProps) => (
  <Tailwind>
    <Html lang="es">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        className="m-0 py-10 font-sans"
        style={{ backgroundColor: colors.lightbox }}
      >
        <Container className="mx-auto max-w-[560px] px-4">
          <Text
            className="m-0 mb-4 font-bold text-[11px] uppercase"
            style={{
              color: colors.signalInk,
              fontFamily: mono,
              letterSpacing: "0.3em",
            }}
          >
            {studioName}
          </Text>
          <Section
            className="bg-white"
            style={{ border: `1px solid ${colors.border}` }}
          >
            <Section style={{ height: 3, backgroundColor: colors.signal }} />
            <Section className="px-8 py-8">{children}</Section>
          </Section>
          <Text className="mt-6 text-xs" style={{ color: colors.muted }}>
            {footer}
          </Text>
        </Container>
      </Body>
    </Html>
  </Tailwind>
);

export const Eyebrow = ({ children }: { readonly children: ReactNode }) => (
  <Text
    className="m-0 mb-2 text-[11px] uppercase"
    style={{
      color: colors.signalInk,
      fontFamily: mono,
      letterSpacing: "0.25em",
    }}
  >
    {children}
  </Text>
);

export const Heading = ({ children }: { readonly children: ReactNode }) => (
  <Text
    className="m-0 mb-4 font-black text-2xl uppercase"
    style={{ color: colors.ink, fontFamily: mono, letterSpacing: "-0.01em" }}
  >
    {children}
  </Text>
);

/** Renders user-written text keeping its line breaks. */
export const Paragraphs = ({ text }: { readonly text: string }) => (
  <>
    {text
      .split(PARAGRAPH_BREAK)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .map((paragraph) => (
        <Text
          className="m-0 mb-4 text-[15px] leading-relaxed"
          key={paragraph}
          style={{ color: colors.ink, whiteSpace: "pre-line" }}
        >
          {paragraph}
        </Text>
      ))}
  </>
);
