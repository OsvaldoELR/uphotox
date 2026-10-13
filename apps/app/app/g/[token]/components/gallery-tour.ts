import { type DriveStep, driver } from "driver.js";
import "driver.js/dist/driver.css";
import "./gallery-tour.css";

/**
 * First-visit guide of the client gallery (driver.js): it dims the page and
 * highlights each part while explaining what to tap. Shown once per device;
 * the «?» button replays it.
 */

const SEEN_KEY = "uphotox:gallery-tour:v1";

export const tourSeen = () => {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    // Storage blocked (private mode, settings): the guide shows each visit.
    return false;
  }
};

const markSeen = () => {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Nothing to do: the guide can be closed anyway.
  }
};

// driver.js writes titles and texts as HTML; names come from the studio.
const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

interface TourInput {
  readonly extraPrice: string;
  readonly firstName: string;
  readonly includedCount: number | null;
}

const steps = ({
  extraPrice,
  firstName,
  includedCount,
}: TourInput): DriveStep[] => [
  {
    popover: {
      title: firstName ? `¡Hola, ${escapeHtml(firstName)}!` : "¡Hola!",
      description:
        "Aquí eliges tus fotos favoritas de la sesión. Te enseñamos cómo en menos de un minuto.",
    },
  },
  {
    element: '[data-tour="package"]',
    popover: {
      title: "Tu paquete",
      description:
        includedCount === null
          ? "Puedes elegir todas las fotos que quieras."
          : `Incluye <b>${includedCount} ${includedCount === 1 ? "foto" : "fotos"}</b>. Si eliges más, cada foto extra cuesta <b>${escapeHtml(extraPrice)}</b>.`,
      side: "bottom",
    },
  },
  {
    element: '[data-tour="photo"]',
    popover: {
      title: "Mira cada foto en grande",
      description:
        "Toca una foto para verla a pantalla completa. Desliza (o usa las flechas) para pasar a la siguiente.",
      side: "bottom",
    },
  },
  {
    element: '[data-tour="heart"]',
    popover: {
      title: "Marca tus favoritas",
      description:
        "Toca el corazón para elegir una foto. Si cambias de idea, vuelve a tocarlo para quitarla.",
      side: "top",
    },
  },
  {
    element: '[data-tour="counter"]',
    popover: {
      title: "Tu cuenta",
      description:
        "Aquí ves cuántas llevas. Todo se guarda solo: puedes cerrar y seguir otro día, o elegir desde otro móvil con este mismo enlace.",
      side: "top",
    },
  },
  {
    element: '[data-tour="favorites"]',
    popover: {
      title: "Revisa tu selección",
      description: "Toca «Mis favoritas» para ver solo las que marcaste.",
      side: "bottom",
    },
  },
  {
    element: '[data-tour="confirm"]',
    popover: {
      title: "Envíanos tu selección",
      description:
        "Cuando termines, pulsa «Confirmar». Después ya no se puede cambiar, así que revisa antes tus favoritas.",
      side: "top",
    },
  },
  {
    element: '[data-tour="help"]',
    popover: {
      title: "¿Necesitas ayuda?",
      description:
        "Toca aquí para ver esta guía otra vez. Y si tienes dudas, escríbenos por WhatsApp.",
      side: "bottom",
    },
  },
];

/** Starts the guide and remembers it was shown. */
export const startTour = (input: TourInput) => {
  const tour = driver({
    steps: steps(input),
    popoverClass: "uphotox-tour",
    showProgress: true,
    progressText: "{{current}} de {{total}}",
    nextBtnText: "Siguiente",
    prevBtnText: "Atrás",
    doneBtnText: "¡A elegir!",
    overlayColor: "#0b1220",
    overlayOpacity: 0.62,
    stagePadding: 6,
    stageRadius: 6,
    smoothScroll: true,
    // The client follows the guide; taps on the page wait until it ends.
    disableActiveInteraction: true,
    skipMissingElement: true,
    onDestroyed: markSeen,
  });

  tour.drive();
  return tour;
};
