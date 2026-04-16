import { NextRequest, NextResponse } from "next/server";
import { callOpenRouter, LLM_MODELS } from "@/lib/config/llm";
import type { MomentVivantPlaythrough } from "@/lib/types/momentVivant";

export async function POST(req: NextRequest) {
  const playthrough = (await req.json()) as MomentVivantPlaythrough;
  const { agentName, momentType, exchanges } = playthrough;

  if (!agentName || !exchanges?.length) {
    return NextResponse.json({ error: "Missing playthrough data" }, { status: 400 });
  }

  const exchangeLog = exchanges
    .map(
      (e, i) =>
        `Échange ${i + 1} :\n  ${agentName} : "${e.replique}"\n  Boss a répondu : "${e.choixJoueur}"\n  ${agentName} : "${e.reponseAgent}"`
    )
    .join("\n\n");

  const prompt = `Tu es un assistant narratif pour Eden Studio.

Voici ce qui s'est passé lors d'un Moment Vivant entre ${agentName} et son boss.
Type de moment : ${momentType}

${exchangeLog}

Rédige un résumé mémoriel (4-6 phrases) à la première personne de ${agentName}.
Ce résumé sera stocké dans sa mémoire et relu lors des prochaines conversations et moments futurs.

Il DOIT capturer :
1. LA SCÈNE : Qu'est-ce qui s'est passé concrètement ? Le détail qui rend le souvenir vivant.
2. LE TON DU BOSS : Comment il a répondu — chaleureux ? taquin ? audacieux ? distant ? Il a dit quoi exactement qui t'a marqué ?
3. CE QUE ÇA A CHANGÉ : En quoi ce moment fait évoluer ce que tu penses de lui / votre relation. Quelque chose a bougé, même légèrement.
4. LE FIL NARRATIF : Un détail réutilisable plus tard — un truc que tu pourrais rementionner, une private joke née de ce moment, une question restée en suspens.

Écris comme un VRAI souvenir — pas un rapport, pas une liste.
Le genre de truc qu'on se repasse dans la tête avant de s'endormir.
Français, tutoiement, 1ère personne.`;

  try {
    const result = await callOpenRouter(
      LLM_MODELS.chat,
      [{ role: "user", content: prompt }],
      { temperature: 0.7, max_tokens: 500 }
    );

    return NextResponse.json({ memory: result.content.trim() });
  } catch (err) {
    console.error("moment-vivant/memory error:", err);
    return NextResponse.json({ error: "Memory generation failed" }, { status: 500 });
  }
}
