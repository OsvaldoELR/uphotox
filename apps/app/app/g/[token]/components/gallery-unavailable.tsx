import { Button } from "@repo/design-system/components/ui/button";
import { ImagesIcon } from "lucide-react";

interface GalleryUnavailableProperties {
  readonly message: string;
  readonly studioName?: string;
  readonly title: string;
  readonly whatsappUrl?: string | null;
}

/** Closed, expired, removed or unknown gallery: what happened and who to ask. */
export const GalleryUnavailable = ({
  message,
  studioName,
  title,
  whatsappUrl,
}: GalleryUnavailableProperties) => (
  <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
    {studioName ? (
      <p className="font-mono text-[10px] text-signal-ink uppercase tracking-[0.3em]">
        {studioName}
      </p>
    ) : null}
    <ImagesIcon className="size-9 text-signal-ink/60" />
    <h1 className="font-black font-mono text-xl uppercase tracking-wide">
      {title}
    </h1>
    <p className="max-w-sm text-muted-foreground text-sm">{message}</p>
    {whatsappUrl ? (
      <Button asChild variant="outline">
        <a href={whatsappUrl} rel="noopener" target="_blank">
          Escribir por WhatsApp
        </a>
      </Button>
    ) : null}
  </main>
);
