import { HudLabel } from "@repo/design-system/components/hud/hud-label";
import { Panel } from "@repo/design-system/components/hud/panel";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/studio";
import { formatWhatsapp } from "@/lib/whatsapp";
import { Header } from "../components/header";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = {
  title: "Ajustes · Uphotox",
  description: "Ajustes del estudio.",
};

const SettingsPage = async () => {
  const context = await requirePermission("settings.manage");

  return (
    <>
      <Header page="Ajustes" trail={[{ label: "Panel", href: "/" }]} />
      <div className="flex flex-1 flex-col gap-6 px-4 pt-4 pb-12 md:px-10">
        <div className="flex flex-col gap-2">
          <HudLabel align="start">Ajustes del estudio</HudLabel>
          <p className="max-w-prose text-muted-foreground text-sm">
            Cómo se presenta tu estudio en los avisos que reciben tus clientes.
          </p>
        </div>
        <Panel className="max-w-xl p-6">
          <SettingsForm
            name={context.studio.name}
            whatsapp={
              context.studio.whatsapp
                ? formatWhatsapp(context.studio.whatsapp)
                : ""
            }
          />
        </Panel>
      </div>
    </>
  );
};

export default SettingsPage;
