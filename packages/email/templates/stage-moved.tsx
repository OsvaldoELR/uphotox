import { Button, Section, Text } from "@react-email/components";
import { colors, Eyebrow, Heading, mono, Shell } from "../components/shell";

interface StageMovedTemplateProps {
  readonly actorName: string;
  readonly boardName: string;
  readonly boardUrl: string;
  readonly cardTitle: string;
  readonly clientName?: string | null;
  readonly clientNotified: boolean;
  readonly fromStage?: string | null;
  readonly studioName: string;
  readonly toStage: string;
}

/** Sent to the studio owner when a teammate moves or adds a card. */
export const StageMovedTemplate = ({
  actorName,
  boardName,
  boardUrl,
  cardTitle,
  clientName,
  clientNotified,
  fromStage,
  studioName,
  toStage,
}: StageMovedTemplateProps) => (
  <Shell
    footer="Recibes este aviso porque eres la dueña del estudio en Uphotox."
    preview={`${actorName} movió «${cardTitle}» a ${toStage}`}
    studioName={studioName}
  >
    <Eyebrow>{boardName}</Eyebrow>
    <Heading>{cardTitle}</Heading>
    <Text className="m-0 mb-4 text-[15px]" style={{ color: colors.ink }}>
      {fromStage
        ? `${actorName} la movió de «${fromStage}» a «${toStage}».`
        : `${actorName} la añadió en «${toStage}».`}
    </Text>
    {clientName ? (
      <Text className="m-0 mb-2 text-[14px]" style={{ color: colors.muted }}>
        Cliente: {clientName}
      </Text>
    ) : null}
    <Text
      className="m-0 mb-6 text-[12px] uppercase"
      style={{ color: colors.muted, fontFamily: mono, letterSpacing: "0.15em" }}
    >
      {clientNotified
        ? "Se avisó al cliente por correo"
        : "No se envió correo al cliente"}
    </Text>
    <Section>
      <Button
        className="px-6 py-3 font-bold text-[13px] uppercase"
        href={boardUrl}
        style={{
          backgroundColor: colors.signal,
          color: colors.ink,
          fontFamily: mono,
          letterSpacing: "0.14em",
        }}
      >
        Abrir tablero
      </Button>
    </Section>
  </Shell>
);

StageMovedTemplate.PreviewProps = {
  actorName: "Luis (Editor)",
  boardName: "Sesiones",
  boardUrl: "http://localhost:3000/tableros/1",
  cardTitle: "Boda Ana y Luis",
  clientName: "Ana García",
  clientNotified: true,
  fromStage: "En edición",
  studioName: "Estudio Luz",
  toStage: "Editadas",
};

export default StageMovedTemplate;
