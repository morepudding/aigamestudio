import { supabase } from "@/lib/supabase/client";

export async function getSetting(key: string): Promise<string> {
  const { data, error } = await supabase
    .from("studio_settings")
    .select("value")
    .eq("key", key)
    .single();

  if (error || !data) return "";
  return data.value;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const { error } = await supabase
    .from("studio_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() });

  if (error) throw new Error(`Failed to save setting "${key}": ${error.message}`);
}

export async function getConventions(): Promise<string> {
  return getSetting("conventions");
}

export async function setConventions(value: string): Promise<void> {
  return setSetting("conventions", value);
}

export async function getUniverseLore(): Promise<string> {
  return getSetting("universe_lore");
}

export async function setUniverseLore(value: string): Promise<void> {
  return setSetting("universe_lore", value);
}
