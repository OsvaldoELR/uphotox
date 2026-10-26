import { Button, Section, Text } from "@react-email/components";
import { colors, Eyebrow, Heading, mono, Shell } from "../components/shell";

interface SelectionReceivedTemplateProps {
  readonly cardTitle: string;
  readonly clientName: string;
  readonly clientNote?: string | null;
  /** e.g. «2 extras · $40»; omitted when nothing is extra. */
  readonly extras?: string | null;
  readonly galleryUrl: string;
  readonly includedCount: number | null;
  readonly picked: number;
  /** One line per book/canvas with the photos chosen for it. */
  readonly products?: readonly string[];
  /** Stage the card moved to, if it moved. */
  readonly stageName?: string | null;
  readonly studioName: string;
}

/** Sent to the owner and the card's assignee when the client confirms. */
export const SelectionReceivedTemplate = ({
  cardTitle,
  clientName,
  clientNote,
  extras,
  galleryUrl,
  includedCount,
  picked,
  products,
  stageName,
  studioName,
}: SelectionReceivedTemplateProps) => (
  <Shell
    footer="Recibes este aviso porque eres la dueña del estudio o la responsable de la tarjeta en Uphotox."
    preview={`${clientName} eligió ${picked} fotos de «${cardTitle}»`}
    studioName={studioName}
  >
    <Eyebrow>Selección recibida</Eyebrow>
    <Heading>{cardTitle}</Heading>
    <Text className="m-0 mb-4 text-[15px]" style={{ color: colors.ink }}>
      {clientName} eligió {picked} {picked === 1 ? "foto" : "fotos"}
      {includedCount === null ? "." : ` (su paquete incluye ${includedCount}).`}
    </Text>
    {extras ? (
      <Text
        className="m-0 mb-4 inline-block px-3 py-1 font-bold text-[12px] uppercase"
        style={{
          color: colors.signalInk,
          fontFamily: mono,
          letterSpacing: "0.15em",
          border: `1px solid ${colors.signalInk}`,
        }}
      >
        Extras · {extras}
      </Text>
    ) : null}
    {products && products.length > 0 ? (
      <Section
        className="mb-4 px-4 py-3"
        style={{ border: `1px solid ${colors.border}` }}
      >
        <Text
          className="m-0 mb-1 text-[11px] uppercase"
          style={{
            color: colors.signalInk,
            fontFamily: mono,
            letterSpacing: "0.2em",
          }}
        >
          Libro y canvas
        </Text>
        {products.map((line) => (
          <Text className="m-0 text-[14px] leading-relaxed" key={line}>
            {line}
          </Text>
        ))}
      </Section>
    ) : null}
    {clientNote ? (
      <Section
        className="mb-4 px-4 py-3"
        style={{ borderLeft: `2px solid ${colors.signalInk}` }}
      >
        <Text
          className="m-0 mb-1 text-[11px] uppercase"
          style={{
            color: colors.signalInk,
            fontFamily: mono,
            letterSpacing: "0.2em",
          }}
        >
          Comentario del cliente
        </Text>
        <Text
          className="m-0 text-[15px] leading-relaxed"
          style={{ whiteSpace: "pre-line" }}
        >
          {clientNote}
        </Text>
      </Section>
    ) : null}
    {stageName ? (
      <Text
        className="m-0 mb-6 text-[12px] uppercase"
        style={{
          color: colors.muted,
          fontFamily: mono,
          letterSpacing: "0.15em",
        }}
      >
        La tarjeta pasó a «{stageName}»
      </Text>
    ) : null}
    <Section>
      <Button
        className="px-6 py-3 font-bold text-[13px] uppercase"
        href={galleryUrl}
        style={{
          backgroundColor: colors.signal,
          color: colors.ink,
          fontFamily: mono,
          letterSpacing: "0.14em",
        }}
      >
        Ver la selección
      </Button>
    </Section>
  </Shell>
);

SelectionReceivedTemplate.PreviewProps = {
  cardTitle: "Mateo · Smash Cake",
  clientName: "Ana García",
  clientNote: "¿Podéis quitar el chupete en la foto 12?",
  extras: "2 extras · $40",
  galleryUrl: "http://localhost:3000/galerias/1",
  includedCount: 12,
  picked: 14,
  products: [
    "Libro 11×8 horizontal · portada IMG_0012 · contraportada IMG_0031",
    "Canvas 16×20 vertical · IMG_0007",
  ],
  stageName: "Escogidas",
  studioName: "Estudio Luz",
};

export default SelectionReceivedTemplate;
