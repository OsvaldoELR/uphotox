import { Button, Section, Text } from "@react-email/components";
import { colors, Eyebrow, Heading, mono, Shell } from "../components/shell";

interface TeamWelcomeTemplateProps {
  readonly email: string;
  readonly invitedBy: string;
  readonly name: string;
  readonly role: string;
  readonly signInUrl: string;
  readonly studioName: string;
}

/** Sent to a teammate the owner just created. Never includes the password. */
export const TeamWelcomeTemplate = ({
  email,
  invitedBy,
  name,
  role,
  signInUrl,
  studioName,
}: TeamWelcomeTemplateProps) => (
  <Shell
    footer="Si no esperabas este correo, puedes ignorarlo."
    preview={`${invitedBy} te dio acceso a ${studioName} en Uphotox`}
    studioName={studioName}
  >
    <Eyebrow>Bienvenida al equipo</Eyebrow>
    <Heading>Hola, {name}</Heading>
    <Text className="m-0 mb-4 text-[15px]" style={{ color: colors.ink }}>
      {invitedBy} te dio acceso a {studioName} en Uphotox con el rol{" "}
      <strong>{role}</strong>.
    </Text>
    <Text className="m-0 mb-6 text-[14px]" style={{ color: colors.muted }}>
      Entra con tu correo ({email}) y la contraseña que te facilitó tu estudio.
      Puedes cambiarla cuando quieras desde «¿Olvidaste tu contraseña?».
    </Text>
    <Section>
      <Button
        className="px-6 py-3 font-bold text-[13px] uppercase"
        href={signInUrl}
        style={{
          backgroundColor: colors.signal,
          color: colors.ink,
          fontFamily: mono,
          letterSpacing: "0.14em",
        }}
      >
        Entrar a Uphotox
      </Button>
    </Section>
  </Shell>
);

TeamWelcomeTemplate.PreviewProps = {
  email: "luis@estudioluz.com",
  invitedBy: "Marta",
  name: "Luis",
  role: "Editor",
  signInUrl: "http://localhost:3000/sign-in",
  studioName: "Estudio Luz",
};

export default TeamWelcomeTemplate;
