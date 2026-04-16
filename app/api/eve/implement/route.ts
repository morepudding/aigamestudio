/**
 * POST /api/eve/implement
 *
 * Takes the validated synthesis text + original prompt,
 * asks Eve to generate all file changes needed, then writes them to disk.
 *
 * Body: { prompt: string; synthesis: string }
 * Returns: { files: FileChange[]; message: string }
 *
 * Eve uses an agentic loop (tool calling) to generate and write files.
 * This is intentionally a long-running route — stream not supported yet.
 */

import { NextRequest, NextResponse } from "next/server";
import { buildEdenCodebaseContext } from "@/lib/services/githubService";
import { callOpenRouter, LLM_MODELS } from "@/lib/config/llm";
import path from "path";
import fs from "fs/promises";

export interface FileChange {
  path: string;
  action: "create" | "update";
  preview: string; // first 20 lines
}

const PROJECT_ROOT = path.resolve(process.cwd());

const EVE_SYSTEM = `Tu es Eve, Producer et développeuse senior chez Eden Studio.
Tu génères le code nécessaire pour implémenter une feature dans une app Next.js 16 / React 19 / TypeScript / Tailwind CSS v4.
Le projet utilise Supabase comme base de données et OpenRouter pour les appels LLM (modèle DeepSeek V3).
Tu respectes les conventions existantes du projet.
Tu réponds UNIQUEMENT avec du JSON valide, sans markdown autour.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { prompt: string; synthesis: string };
    const { prompt, synthesis } = body;

    if (!prompt || !synthesis) {
      return NextResponse.json({ error: "Missing prompt or synthesis" }, { status: 400 });
    }

    // Get codebase context (key files for context)
    const codebaseContext = await buildEdenCodebaseContext();

    const implementPrompt = `${codebaseContext}

---

Feature à implémenter :
"""
${prompt}
"""

Synthèse validée :
"""
${synthesis}
"""

Génère TOUS les fichiers nécessaires pour cette feature.
Pour chaque fichier, indique si c'est une création ou une mise à jour.

Réponds UNIQUEMENT avec ce JSON (pas de markdown) :
{
  "files": [
    {
      "path": "app/eve/page.tsx",
      "action": "create",
      "content": "// contenu complet du fichier"
    }
  ],
  "summary": "Résumé de 2-3 phrases de ce qui a été implémenté"
}

IMPORTANT :
- Les chemins sont relatifs à la racine du projet (ex: app/eve/page.tsx)
- Fournis le contenu COMPLET de chaque fichier, pas de placeholder ni de "..."
- Respecte les imports existants, les conventions TypeScript et Tailwind du projet
- N'oublie pas les fichiers de route API si nécessaire`;

    const response = await callOpenRouter(
      LLM_MODELS.code,
      [
        { role: "system", content: EVE_SYSTEM },
        { role: "user", content: implementPrompt },
      ],
      { temperature: 0.15, max_tokens: 8192 }
    );

    const cleaned = response.content
      .replace(/^```[a-z]*\n?/i, "")
      .replace(/```$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned) as {
      files: Array<{ path: string; action: string; content: string }>;
      summary: string;
    };

    // Write files to disk
    const written: FileChange[] = [];

    for (const file of parsed.files) {
      // Security: ensure path stays within project root
      const absolutePath = path.resolve(PROJECT_ROOT, file.path);
      if (!absolutePath.startsWith(PROJECT_ROOT)) {
        console.warn(`[eve/implement] Skipped suspicious path: ${file.path}`);
        continue;
      }

      // Ensure directory exists
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });

      // Write file
      await fs.writeFile(absolutePath, file.content, "utf-8");

      written.push({
        path: file.path,
        action: file.action as "create" | "update",
        preview: file.content.split("\n").slice(0, 20).join("\n"),
      });
    }

    return NextResponse.json({
      files: written,
      message: parsed.summary,
    });
  } catch (err) {
    console.error("[eve/implement]", err);
    return NextResponse.json({ error: "Implementation failed" }, { status: 500 });
  }
}
