import { Button, Section, Text } from "@react-email/components";
import {
  colors,
  Eyebrow,
  Heading,
  mono,
  Paragraphs,
  Shell,
  WhatsappBlock,
} from "../components/shell";

const primaryButton = {
  backgroundColor: colors.signal,
  color: colors.ink,
  fontFamily: mono,
  letterSpacing: "0.14em",
};

interface StageUpdateTemplateProps {
  readonly clientName: string;
  readonly galleryUrl?: string | null;
  readonly message: string;
  /** Client link of an open selection gallery: «Elegir mis fotos». */
  readonly selectionUrl?: string | null;
  readonly stageName: string;
  readonly studioName: string;
  /** wa.me link to the studio; the contact block is hidden without it. */
  readonly whatsappUrl?: string | null;
}

/**
 * Sent to the client when their card enters a stage with notify_client on.
 * It is a notification: clients are pointed to WhatsApp, never to "reply".
 */
export const StageUpdateTemplate = ({
  clientName,
  galleryUrl,
  message,
  selectionUrl,
  stageName,
  studioName,
  whatsappUrl,
}: StageUpdateTemplateProps) => (
  <Shell
    footer={`Aviso automático de ${studioName} vía Uphotox.`}
    preview={`${stageName}: novedades de tu sesión con ${studioName}`}
    studioName={studioName}
  >
    <Eyebrow>Novedades de tu sesión</Eyebrow>
    <Heading>Hola, {clientName}</Heading>
    <Text
      className="m-0 mb-6 inline-block px-3 py-1 font-bold text-[12px] uppercase"
      style={{
        color: colors.signalInk,
        fontFamily: mono,
        letterSpacing: "0.15em",
        border: `1px solid ${colors.signalInk}`,
      }}
    >
      Etapa · {stageName}
    </Text>
    <Paragraphs text={message} />
    {selectionUrl ? (
      <Section className="mt-2">
        <Button
          className="px-6 py-3 font-bold text-[13px] uppercase"
          href={selectionUrl}
          style={primaryButton}
        >
          Elegir mis fotos
        </Button>
      </Section>
    ) : null}
    {galleryUrl ? (
      <Section className="mt-2">
        <Button
          className="px-6 py-3 font-bold text-[13px] uppercase"
          href={galleryUrl}
          style={primaryButton}
        >
          Ver mi álbum
        </Button>
      </Section>
    ) : null}
    {whatsappUrl ? <WhatsappBlock href={whatsappUrl} /> : null}
  </Shell>
);

StageUpdateTemplate.PreviewProps = {
  clientName: "Ana García",
  stageName: "Enviadas para escoger",
  studioName: "Estudio Luz",
  message:
    "Tus fotos están listas para que elijas tus favoritas.\n\nMárcalas con el corazón y confirma tu selección cuando termines.",
  selectionUrl: "http://localhost:3000/g/ejemplo",
  whatsappUrl: "https://wa.me/34612345678",
};

export default StageUpdateTemplate;
