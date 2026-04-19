/**
 * Utilitaire d'observabilité léger.
 * Loggue les durées des opérations critiques avec des métadonnées utiles.
 * Actif en dev et en prod côté serveur ; silencieux côté client hors dev.
 */

const IS_SERVER = typeof window === "undefined";
const IS_DEV = process.env.NODE_ENV === "development";

type PerfMeta = Record<string, string | number | boolean | null | undefined>;

/**
 * Loggue la durée d'une opération depuis un timestamp de départ.
 * Usage :
 *   const t0 = Date.now();
 *   // ... opération ...
 *   perfLog("getConversationSummaries", t0, { rows: 12 });
 */
export function perfLog(label: string, startMs: number, meta?: PerfMeta): void {
  if (!IS_SERVER && !IS_DEV) return;

  const duration = Date.now() - startMs;
  const metaStr = meta
    ? " | " + Object.entries(meta).map(([k, v]) => `${k}=${v}`).join(" ")
    : "";

  const prefix = IS_SERVER ? "[perf/server]" : "[perf/client]";
  const color = duration > 500 ? "🔴" : duration > 200 ? "🟡" : "🟢";

  console.log(`${prefix} ${color} ${label} — ${duration}ms${metaStr}`);
}

/**
 * Wrappe une fonction async et loggue automatiquement sa durée.
 * Usage :
 *   const result = await withPerf("fetchAgents", () => getAllAgents());
 */
export async function withPerf<T>(label: string, fn: () => Promise<T>, meta?: PerfMeta): Promise<T> {
  const t0 = Date.now();
  const result = await fn();
  perfLog(label, t0, meta);
  return result;
}

/**
 * Crée un timer nommé qu'on peut stopper plus tard.
 * Usage :
 *   const stop = startTimer("loadPage");
 *   // ... travail ...
 *   stop({ extraMeta: true });
 */
export function startTimer(label: string) {
  const t0 = Date.now();
  return (meta?: PerfMeta) => perfLog(label, t0, meta);
}
