import { Panel } from "@repo/design-system/components/hud/panel";
import { TriangleAlertIcon } from "lucide-react";

/** Shown while the R2 variables are missing: nothing can be uploaded. */
export const StorageNotice = () => (
  <Panel className="flex items-start gap-3 border-flare/40 p-4">
    <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-flare" />
    <p className="text-sm">
      Falta conectar el almacenamiento de fotos (Cloudflare R2), así que todavía
      no se pueden crear galerías ni subir fotos.
    </p>
  </Panel>
);
