import { Button, Section, Text } from "@react-email/components";
import {
  colors,
  Eyebrow,
  Heading,
  mono,
  Paragraphs,
  Shell,
} from "../components/shell";

interface StageUpdateTemplateProps {
  readonly clientName: string;
  readonly galleryUrl?: string | null;
  readonly message: string;
  readonly stageName: string;
  readonly studioName: string;
}

/** Sent to the client when their card enters a stage with notify_client on. */
export const StageUpdateTemplate = ({
  clientName,
  galleryUrl,
  message,
  stageName,
  studioName,
}: StageUpdateTemplateProps) => (
  <Shell
    footer={`Recibes este correo porque ${studioName} gestiona tu sesión con Uphotox. Si tienes dudas, responde a este correo.`}
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
          Ver mi galería
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
  galleryUrl: "https://drive.google.com/",
};

export default StageUpdateTemplate;
