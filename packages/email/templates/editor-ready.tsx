import { Button, Section, Text } from "@react-email/components";
import { colors, Eyebrow, Heading, mono, Shell } from "../components/shell";

interface EditorReadyTemplateProps {
  readonly cardTitle: string;
  /** Photos that failed (to send again or keep the original). */
  readonly failed: number;
  /** Photos cleaned. */
  readonly ready: number;
  /** Of the cleaned ones, those the automatic reviewer flagged. */
  readonly review: number;
  readonly reviewUrl: string;
  readonly studioName: string;
}

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

const summary = (ready: number, review: number) =>
  `${plural(ready, "foto está lista", "fotos están listas")} para revisar${
    review > 0 ? `; el revisor marcó ${review} para mirar con calma` : ""
  }.`;

/** Sent to the member who sent the photos, when none is left in the cloud. */
export const EditorReadyTemplate = ({
  cardTitle,
  failed,
  ready,
  review,
  reviewUrl,
  studioName,
}: EditorReadyTemplateProps) => (
  <Shell
    footer="Recibes este aviso porque enviaste estas fotos al editor de Uphotox."
    preview={`${plural(ready, "foto limpia", "fotos limpias")} de «${cardTitle}»`}
    studioName={studioName}
  >
    <Eyebrow>Fondos limpios</Eyebrow>
    <Heading>{cardTitle}</Heading>
    <Text className="m-0 mb-4 text-[15px]" style={{ color: colors.ink }}>
      {summary(ready, review)}
    </Text>
    {failed > 0 ? (
      <Text
        className="m-0 mb-4 text-[12px] uppercase"
        style={{
          color: colors.muted,
          fontFamily: mono,
          letterSpacing: "0.15em",
        }}
      >
        {plural(failed, "falló", "fallaron")}: puedes rehacerlas o quedarte con
        la original
      </Text>
    ) : null}
    <Section>
      <Button
        className="px-6 py-3 font-bold text-[13px] uppercase"
        href={reviewUrl}
        style={{
          backgroundColor: colors.signal,
          color: colors.ink,
          fontFamily: mono,
          letterSpacing: "0.14em",
        }}
      >
        Revisar las fotos
      </Button>
    </Section>
  </Shell>
);

EditorReadyTemplate.PreviewProps = {
  cardTitle: "Mateo · Smash Cake",
  failed: 1,
  ready: 29,
  review: 3,
  reviewUrl: "http://localhost:3000/galerias/1/limpieza",
  studioName: "Estudio Luz",
};

export default EditorReadyTemplate;
