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
  /** The whole session unedited, offered with the email sent on confirming. */
  readonly offer?: {
    readonly note: string;
    /** Formatted, e.g. «$100». */
    readonly price: string;
    /** WhatsApp link with a message asking for it. */
    readonly whatsappUrl?: string | null;
  } | null;
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
  offer,
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
    {offer ? (
      <Section
        className="mt-6 px-4 py-3"
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
          Galería completa
        </Text>
        <Text className="m-0 font-bold text-[15px]">
          ¿Quieres todas las fotos de tu sesión?
        </Text>
        <Text className="m-0 mt-1 mb-3 text-[15px] leading-relaxed">
          {`${offer.note} Precio: ${offer.price}.`}
        </Text>
        {offer.whatsappUrl ? (
          <Button
            className="px-5 py-2.5 font-bold text-[12px] uppercase"
            href={offer.whatsappUrl}
            style={primaryButton}
          >
            La quiero
          </Button>
        ) : null}
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
