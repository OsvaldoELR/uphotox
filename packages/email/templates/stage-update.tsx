import { Button, Section, Text } from "@react-email/components";
import {
  colors,
  Eyebrow,
  Heading,
  mono,
  Paragraphs,
  Shell,
} from "../components/shell";

// WhatsApp's dark green: recognisable and readable on white.
const whatsappGreen = "#128c4a";

interface StageUpdateTemplateProps {
  readonly clientName: string;
  readonly galleryUrl?: string | null;
  readonly message: string;
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
    {galleryUrl ? (
      <Section className="mt-2">
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
          Ver mi álbum
        </Button>
      </Section>
    ) : null}
    {whatsappUrl ? (
      <Section
        className="mt-8 pt-6"
        style={{ borderTop: `1px solid ${colors.border}` }}
      >
        <Text className="m-0 mb-3 text-[14px]" style={{ color: colors.muted }}>
          ¿Tienes alguna duda? Escríbenos por WhatsApp.
        </Text>
        <Button
          className="px-5 py-2.5 font-bold text-[12px] uppercase"
          href={whatsappUrl}
          style={{
            border: `1px solid ${whatsappGreen}`,
            color: whatsappGreen,
            fontFamily: mono,
            letterSpacing: "0.14em",
          }}
        >
          Escribir por WhatsApp
        </Button>
      </Section>
    ) : null}
  </Shell>
);

StageUpdateTemplate.PreviewProps = {
  clientName: "Ana García",
  stageName: "Enviadas para escoger",
  studioName: "Estudio Luz",
  message:
    "Tus fotos están listas para que elijas tus favoritas.\n\nRevisa tu galería y márcalas cuando puedas.",
  galleryUrl: "https://photos.app.goo.gl/",
  whatsappUrl: "https://wa.me/34612345678",
};

export default StageUpdateTemplate;
