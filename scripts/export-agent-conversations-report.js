const fs = require("fs");
const path = require("path");

function parseUntrustedPayload(result) {
  const match = result.match(/<untrusted-data-[^>]+>\n([\s\S]*)\n<\/untrusted-data-[^>]+>/);
  if (!match) {
    throw new Error("Unable to locate SQL payload in MCP result");
  }

  return JSON.parse(match[1]);
}

function normalizeText(value) {
  return String(value ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function buildReport(rows) {
  const agents = new Map();

  for (const row of rows) {
    const agentSlug = row.agent_slug || "unknown";
    if (!agents.has(agentSlug)) {
      agents.set(agentSlug, {
        agentSlug,
        agentName: row.agent_name || agentSlug,
        conversations: new Map(),
        feedback: [],
      });
    }

    const agent = agents.get(agentSlug);
    if (!agent.conversations.has(row.conversation_id)) {
      agent.conversations.set(row.conversation_id, {
        conversationId: row.conversation_id,
        createdAt: row.conversation_created_at,
        lastMessageAt: row.conversation_last_message_at,
        messageCount: row.conversation_message_count,
        isPinned: row.is_pinned,
        awaitingUserReply: row.awaiting_user_reply,
        messages: [],
      });
    }

    agent.conversations.get(row.conversation_id).messages.push(row);
    if (row.user_feedback === 1 || row.user_feedback === -1) {
      agent.feedback.push(row);
    }
  }

  const sortedAgents = [...agents.values()].sort((left, right) =>
    left.agentSlug.localeCompare(right.agentSlug),
  );
  const totalConversations = new Set(rows.map((row) => row.conversation_id)).size;
  const thumbsUpCount = rows.filter((row) => row.user_feedback === 1).length;
  const thumbsDownCount = rows.filter((row) => row.user_feedback === -1).length;
  const lines = [];

  lines.push("# Export conversations agents");
  lines.push("");
  lines.push("Date export: 2026-04-21");
  lines.push("Source: Supabase project yfwkavupjnnvmchidujw (eden)");
  lines.push("");
  lines.push("## Synthese");
  lines.push("");
  lines.push(`- Agents avec conversations: ${sortedAgents.length}`);
  lines.push(`- Conversations: ${totalConversations}`);
  lines.push(`- Messages: ${rows.length}`);
  lines.push(`- Messages avec feedback positif: ${thumbsUpCount}`);
  lines.push(`- Messages avec feedback negatif: ${thumbsDownCount}`);
  lines.push("");
  lines.push("## Messages avec feedback");
  lines.push("");

  for (const agent of sortedAgents) {
    const positives = agent.feedback.filter((row) => row.user_feedback === 1).length;
    const negatives = agent.feedback.filter((row) => row.user_feedback === -1).length;

    lines.push(`### ${agent.agentName} (${agent.agentSlug})`);
    lines.push("");
    lines.push(`- Positifs: ${positives}`);
    lines.push(`- Negatifs: ${negatives}`);
    lines.push("");

    if (!agent.feedback.length) {
      lines.push("_Aucun feedback._");
      lines.push("");
      continue;
    }

    const sortedFeedback = [...agent.feedback].sort((left, right) =>
      left.message_at.localeCompare(right.message_at),
    );

    for (const row of sortedFeedback) {
      const feedback = row.user_feedback === 1 ? "+1" : "-1";
      lines.push(
        `- [${feedback}] ${row.message_at} | conversation ${row.conversation_id} | ${row.message_type}`,
      );
      for (const line of normalizeText(row.content).split("\n")) {
        lines.push(`  ${line}`);
      }
    }

    lines.push("");
  }

  lines.push("## Conversations completes");
  lines.push("");

  for (const agent of sortedAgents) {
    lines.push(`### ${agent.agentName} (${agent.agentSlug})`);
    lines.push("");

    const sortedConversations = [...agent.conversations.values()].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    );

    for (const conversation of sortedConversations) {
      lines.push(`#### Conversation ${conversation.conversationId}`);
      lines.push("");
      lines.push(`- Creee le: ${conversation.createdAt}`);
      lines.push(`- Dernier message: ${conversation.lastMessageAt}`);
      lines.push(`- Nombre de messages (colonne conversation): ${conversation.messageCount}`);
      lines.push(`- Nombre de messages extraits: ${conversation.messages.length}`);
      lines.push(`- Epinglee: ${conversation.isPinned}`);
      lines.push(`- En attente de reponse utilisateur: ${conversation.awaitingUserReply}`);
      lines.push("");

      const sortedMessages = [...conversation.messages].sort((left, right) =>
        left.message_at.localeCompare(right.message_at),
      );

      for (const row of sortedMessages) {
        const feedbackSuffix =
          row.user_feedback === 1
            ? " | feedback +1"
            : row.user_feedback === -1
              ? " | feedback -1"
              : "";
        lines.push(`- ${row.message_at} | ${row.sender} | ${row.message_type}${feedbackSuffix}`);
        for (const line of normalizeText(row.content).split("\n")) {
          lines.push(`  ${line}`);
        }
      }

      lines.push("");
    }
  }

  return lines.join("\n");
}

function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];

  if (!inputPath || !outputPath) {
    throw new Error("Usage: node scripts/export-agent-conversations-report.js <mcp-result-json> <output-md>");
  }

  const payload = JSON.parse(fs.readFileSync(path.resolve(inputPath), "utf8"));
  const rows = parseUntrustedPayload(payload.result);
  const report = buildReport(rows);

  fs.writeFileSync(path.resolve(outputPath), report, "utf8");
}

main();