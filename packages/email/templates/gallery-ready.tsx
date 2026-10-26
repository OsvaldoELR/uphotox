import { Button, Section, Text } from "@react-email/components";
import {
  colors,
  Eyebrow,
  Heading,
  mono,
  Shell,
  WhatsappBlock,
} from "../components/shell";

interface GalleryReadyTemplateProps {
  readonly clientName: string;
  /** Formatted deadline, e.g. «12 de diciembre». */
  readonly deadline: string;
  /** Formatted price of each extra photo, e.g. «$20». */
  readonly extraPrice: string;
  /** Photos in the package; null = no limit. */
  readonly includedCount: number | null;
  /** Book/canvas the client will decide, as one sentence; omitted if none. */
  readonly products?: string | null;
  readonly selectionUrl: string;
  readonly sessionTitle: string;
  readonly studioName: string;
  readonly whatsappUrl?: string | null;
}

/** Sent to the client when the studio sends the selection gallery. */
export const GalleryReadyTemplate = ({
  clientName,
  deadline,
  extraPrice,
  includedCount,
  products,
  selectionUrl,
  sessionTitle,
  studioName,
  whatsappUrl,
}: GalleryReadyTemplateProps) => (
  <Shell
    footer={`Aviso automático de ${studioName} vía Uphotox.`}
    preview={`Tus fotos de ${sessionTitle} están listas para elegir`}
    studioName={studioName}
  >
    <Eyebrow>Tu galería está lista</Eyebrow>
    <Heading>Hola, {clientName}</Heading>
    <Text className="m-0 mb-4 text-[15px] leading-relaxed">
      Ya puedes elegir tus fotos favoritas de «{sessionTitle}».
    </Text>
    <Section
      className="mb-6 px-4 py-3"
      style={{ border: `1px solid ${colors.border}` }}
    >
      <Text className="m-0 text-[15px] leading-relaxed">
        {includedCount === null
          ? "Elige todas las que quieras."
          : `Tu paquete incluye ${includedCount} ${includedCount === 1 ? "foto" : "fotos"}. Si quieres más, cada foto extra cuesta ${extraPrice}.`}
      </Text>
      {products ? (
        <Text className="m-0 mt-2 text-[15px] leading-relaxed">{products}</Text>
      ) : null}
      <Text
        className="m-0 mt-2 text-[12px] uppercase"
        style={{
          color: colors.signalInk,
          fontFamily: mono,
          letterSpacing: "0.12em",
        }}
      >
        Tienes hasta el {deadline}
      </Text>
    </Section>
    <Section>
      <Button
        className="px-6 py-3 font-bold text-[13px] uppercase"
        href={selectionUrl}
        style={{
          backgroundColor: colors.signal,
          color: colors.ink,
          fontFamily: mono,
          letterSpacing: "0.14em",
        }}
      >
        Elegir mis fotos
      </Button>
    </Section>
    <Text
      className="m-0 mt-6 text-[14px] leading-relaxed"
      style={{ color: colors.muted }}
    >
      Todo se guarda solo: puedes elegir en varias veces y desde cualquier móvil
      con este mismo enlace. Cuando termines, pulsa «Confirmar selección».
    </Text>
    {whatsappUrl ? <WhatsappBlock href={whatsappUrl} /> : null}
  </Shell>
);

GalleryReadyTemplate.PreviewProps = {
  clientName: "Ana García",
  deadline: "12 de diciembre",
  extraPrice: "$20",
  includedCount: 24,
  products:
    "Tu paquete incluye un libro 8×11 y un canvas 16×20: al terminar de elegir tus favoritas escogerás entre ellas la portada y la contraportada del libro y la foto del canvas. La portada decide si el libro sale vertical u horizontal.",
  selectionUrl: "http://localhost:3000/g/ejemplo",
  sessionTitle: "Mateo · Smash Cake",
  studioName: "Estudio Luz",
  whatsappUrl: "https://wa.me/34612345678",
};

export default GalleryReadyTemplate;
