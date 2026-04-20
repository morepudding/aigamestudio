import { getConventions, getUniverseLore } from "@/lib/services/studioSettingsService";
import { SettingsPageClient } from "@/components/settings/SettingsPageClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [conventions, universeLore] = await Promise.all([
    getConventions(),
    getUniverseLore(),
  ]);

  return <SettingsPageClient initialConventions={conventions} initialUniverseLore={universeLore} />;
}
