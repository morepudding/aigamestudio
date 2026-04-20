#!/usr/bin/env node
// Simulates a server-side cron for nudges in local dev.
// Calls POST /api/ai/nudge every 60 seconds.

const INTERVAL_MS = 60_000;
const NUDGE_URL = "http://localhost:3000/api/ai/nudge";

async function runNudges() {
  try {
    const res = await fetch(NUDGE_URL, { method: "POST" });
    const data = await res.json();
    const count = data.processed ?? 0;
    if (count > 0) {
      console.log(`[nudge-cron] ${new Date().toLocaleTimeString()} — ${count} nudge(s) envoyé(s)`);
    }
  } catch {
    // Server not ready yet, silent fail
  }
}

console.log("[nudge-cron] Démarré — poll toutes les 60s sur", NUDGE_URL);
runNudges();
setInterval(runNudges, INTERVAL_MS);
