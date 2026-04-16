"use client";

/**
 * SpontaneousManager — runs globally (independent of which chat is open).
 * Manages one timer per agent and sends spontaneous messages in background.
 */

import { useEffect, useRef } from "react";
import { getAgentMemories, formatMemoriesForPrompt } from "@/lib/services/memoryService";
import { sendMessage, getConversationForAgent } from "@/lib/services/chatService";

// ─── Config ──────────────────────────────────────────────────────────────────
const IDLE_MS = 10 * 60 * 1000;          // 10 min inactivity before first message
const CHECK_MS = 60 * 1000;              // check every minute
const MIN_BETWEEN_SPONTANEOUS_MS = 8 * 60 * 1000; // min 8 min between two spontaneous
const MAX_PENDING = 3;                   // max unanswered spontaneous messages per agent

type SpontaneousType = "idle" | "thinking_of_you" | "personal" | "memory_callback";

interface AgentInfo {
  slug: string;
  name: string;
  role: string;
  personality_primary: string;
  personality_nuance?: string;
  backstory?: string;
  mood?: string | null;
  confidence_level?: number | null;
}

function pickType(confidenceLevel: number, hasMemories: boolean): SpontaneousType {
  const types: SpontaneousType[] = ["idle", "thinking_of_you", "personal"];
  if (hasMemories) types.push("memory_callback");
  if (confidenceLevel >= 40) types.push("thinking_of_you", "thinking_of_you");
  if (confidenceLevel >= 60) types.push("personal", "memory_callback");
  return types[Math.floor(Math.random() * types.length)];
}

// Per-agent runtime state (not React state — no re-renders needed)
interface AgentState {
  lastSpontaneous: number;      // timestamp of last spontaneous sent
  pendingCount: number;         // unanswered spontaneous messages
  timer: ReturnType<typeof setInterval> | null;
}

export function SpontaneousManager() {
  const agentStatesRef = useRef<Record<string, AgentState>>({});
  // Track global last user activity (any tab/page interaction)
  const lastActivityRef = useRef<number>(Date.now());

  // Listen for any user interaction to reset idle timer
  useEffect(() => {
    const touch = () => { lastActivityRef.current = Date.now(); };
    window.addEventListener("mousemove", touch, { passive: true });
    window.addEventListener("keydown", touch, { passive: true });
    window.addEventListener("touchstart", touch, { passive: true });
    window.addEventListener("click", touch, { passive: true });
    return () => {
      window.removeEventListener("mousemove", touch);
      window.removeEventListener("keydown", touch);
      window.removeEventListener("touchstart", touch);
      window.removeEventListener("click", touch);
    };
  }, []);

  // Load agents and start per-agent timers
  useEffect(() => {
    let cancelled = false;

    async function startTimers() {
      let agents: AgentInfo[] = [];
      try {
        const res = await fetch("/api/agents");
        if (!res.ok) return;
        agents = await res.json();
      } catch {
        return;
      }
      if (cancelled) return;

      for (const agent of agents) {
        // Init state for this agent
        agentStatesRef.current[agent.slug] = {
          lastSpontaneous: 0,
          pendingCount: 0,
          timer: null,
        };

        const state = agentStatesRef.current[agent.slug];

        state.timer = setInterval(async () => {
          if (cancelled) return;

          const idleMs = Date.now() - lastActivityRef.current;
          if (idleMs < IDLE_MS) return;

          const st = agentStatesRef.current[agent.slug];
          if (!st) return;

          // Don't spam — respect pending limit
          if (st.pendingCount >= MAX_PENDING) return;

          // Enforce minimum gap between spontaneous messages
          const timeSinceLast = Date.now() - st.lastSpontaneous;
          if (st.pendingCount > 0 && timeSinceLast < MIN_BETWEEN_SPONTANEOUS_MS) return;
          if (st.pendingCount === 0 && st.lastSpontaneous > 0 && timeSinceLast < MIN_BETWEEN_SPONTANEOUS_MS) return;

          // Get conversation (must exist)
          const conv = await getConversationForAgent(agent.slug);
          if (!conv) return;

          // Check DB-level: is agent already awaiting reply?
          // We allow spontaneous to bypass if pending is 0, but respect pending limit
          // (sendMessage with skipBlockingCheck=true handles this)

          // Load memories
          let memoriesFormatted = "";
          try {
            const mems = await getAgentMemories(agent.slug);
            memoriesFormatted = formatMemoriesForPrompt(mems);
          } catch { /* silent */ }

          const type = pickType(agent.confidence_level ?? 0, memoriesFormatted.length > 0);

          // Generate message
          let messageText = "";
          try {
            const res = await fetch("/api/ai/spontaneous", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: agent.name,
                role: agent.role,
                gender: "femme",
                personalityPrimary: agent.personality_primary,
                personalityNuance: agent.personality_nuance ?? "",
                backstory: agent.backstory ?? "",
                memories: memoriesFormatted || undefined,
                mood: agent.mood ?? undefined,
                confidenceLevel: agent.confidence_level ?? 0,
                type,
              }),
            });
            if (!res.ok) return;
            const data = await res.json();
            messageText = data.message ?? "";
          } catch {
            return;
          }

          if (!messageText) return;

          // Send message (skip blocking check — this is a spontaneous initiative)
          const sent = await sendMessage(conv.id, messageText, "agent", "normal", true);
          if (sent) {
            agentStatesRef.current[agent.slug].pendingCount += 1;
            agentStatesRef.current[agent.slug].lastSpontaneous = Date.now();
          }
        }, CHECK_MS);
      }
    }

    startTimers();

    return () => {
      cancelled = true;
      for (const state of Object.values(agentStatesRef.current)) {
        if (state.timer) clearInterval(state.timer);
      }
      agentStatesRef.current = {};
    };
  }, []);

  // Reset pending count when user sends a message to an agent
  // Listen via Supabase realtime on messages table (user sender)
  useEffect(() => {
    // We poll the conversations to detect user replies and reset pending counts
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/agents");
        if (!res.ok) return;
        const agents: AgentInfo[] = await res.json();
        for (const agent of agents) {
          const conv = await getConversationForAgent(agent.slug);
          if (!conv) continue;
          // If conversation is NOT awaiting user reply, user replied — reset pending
          if (!conv.awaitingUserReply && agentStatesRef.current[agent.slug]) {
            agentStatesRef.current[agent.slug].pendingCount = 0;
          }
        }
      } catch { /* silent */ }
    }, 30 * 1000); // check every 30s

    return () => clearInterval(interval);
  }, []);

  return null; // invisible component
}
