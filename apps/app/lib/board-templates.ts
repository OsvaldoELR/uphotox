export interface StageTemplate {
  readonly message: string | null;
  readonly name: string;
  readonly notifyClient: boolean;
}

/**
 * One board = one complete pipeline for a kind of session (weddings, family,
 * commercial…). Booking and editing live in the same flow so each client is a
 * single card that moves forward and gets one email per stage.
 */
export const BOARD_TEMPLATES = {
  session: {
    label: "Flujo completo de sesión",
    description:
      "De la reserva a la entrega: 7 etapas y un correo al cliente en cada una.",
    stages: [
      {
        name: "Agendado",
        notifyClient: true,
        message:
          "¡Tu sesión está confirmada! Te esperamos en la fecha acordada.",
      },
      {
        name: "Sesión realizada",
        notifyClient: true,
        message:
          "¡Gracias por tu sesión! Ya estamos revisando tus fotos y pronto te las enviaremos para que elijas.",
      },
      {
        name: "Enviadas para escoger",
        notifyClient: true,
        message:
          "Tus fotos están listas para que elijas tus favoritas.\n\nRevisa tu galería y avísanos con tu selección.",
      },
      {
        name: "Escogidas",
        notifyClient: true,
        message:
          "Recibimos tu selección. En breve empezamos a editar tus fotos.",
      },
      {
        name: "En edición",
        notifyClient: true,
        message: "Tus fotos favoritas están en proceso de edición.",
      },
      {
        name: "Editadas",
        notifyClient: true,
        message:
          "¡Tus fotos ya están editadas! Estamos preparando la entrega final.",
      },
      {
        name: "Entregadas",
        notifyClient: true,
        message:
          "¡Tus fotos están listas! Puedes verlas y descargarlas desde tu álbum.",
      },
    ],
  },
  blank: {
    label: "En blanco",
    description: "Tres etapas sin avisos para adaptarlas a tu proceso.",
    stages: [
      { name: "Por hacer", notifyClient: false, message: null },
      { name: "En curso", notifyClient: false, message: null },
      { name: "Hecho", notifyClient: false, message: null },
    ],
  },
} as const satisfies Record<
  string,
  { label: string; description: string; stages: readonly StageTemplate[] }
>;

export type BoardTemplateId = keyof typeof BOARD_TEMPLATES;

export const BOARD_TEMPLATE_IDS = Object.keys(
  BOARD_TEMPLATES
) as BoardTemplateId[];

/** Gap between neighbours; moves land halfway between two positions. */
export const POSITION_STEP = 1024;

export const defaultStageMessage = (stageName: string, studioName: string) =>
  `Tu sesión con ${studioName} pasó a la etapa «${stageName}».`;
