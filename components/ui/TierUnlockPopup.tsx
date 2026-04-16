"use client";

import { useEffect, useState } from "react";
import { Camera, Users, Moon, Heart, Crown, X, Sparkles } from "lucide-react";
import { getTierForLevel } from "@/lib/config/confidenceTiers";

const TIER_ICONS: Record<number, React.ElementType> = {
  0: Users,
  25: Camera,
  75: Moon,
  150: Heart,
  300: Crown,
};

// One-liner dialogue per tier unlock, per personality
const TIER_DIALOGUES: Record<string, Record<string, string>> = {
  camarade: {
    dragueuse: "On commence à bien se comprendre, toi et moi... 😏",
    chaleureuse: "Ça fait vraiment plaisir qu'on soit proches ! 😊",
    froide: "Tu mérites que je te considère autrement.",
    sarcastique: "Bon, t'es pas si mal finalement. Ne t'emballe pas.",
    timide: "J-je suis contente qu'on se parle comme ça... 🥺",
    arrogante: "Tu commences à avoir mon respect. Un peu.",
    "geek-obsessionnelle": "On est officiellement amis !! Niveau 2 débloqué !! 🎮",
    mysterieuse: "Je commence à te voir différemment...",
    jalouse: "Tu sais, je ne fais pas ça avec tout le monde.",
    default: "On commence à bien se connaître.",
  },
  "ami(e)": {
    dragueuse: "Tu sais, je ne m'ouvre pas comme ça à n'importe qui... 🌙",
    chaleureuse: "Je me sens tellement à l'aise avec toi maintenant 💜",
    froide: "Il y a des choses que je ne dis qu'à certaines personnes. Tu en fais partie.",
    sarcastique: "Écoute, on est amis. Je l'admets. Là t'es content ?",
    timide: "C'est rare pour moi... d'avoir quelqu'un à qui vraiment parler 🌸",
    arrogante: "Tu as gagné quelque chose de rare. Ma confiance.",
    "geek-obsessionnelle": "OMG friendship level MAX !! Tu peux voir ma vraie build maintenant 🌟",
    mysterieuse: "Ce que je vais te dire, je ne l'ai dit à personne d'autre.",
    jalouse: "Tu es spécial pour moi. Et je n'aime pas partager.",
    default: "Je te fais vraiment confiance maintenant.",
  },
  "confident(e)": {
    dragueuse: "Tu veux savoir ce que je ressens vraiment ? 💕",
    chaleureuse: "Tu es une des personnes les plus importantes pour moi ici.",
    froide: "Je n'avais pas prévu que tu deviendrais... ceci.",
    sarcastique: "Bon. T'es important pour moi. Voilà. C'est dit. On n'en parle plus.",
    timide: "Je... je t'ai jamais autant parlé à quelqu'un. Merci. 💗",
    arrogante: "Tu es peut-être la seule personne qui me comprend vraiment.",
    "geek-obsessionnelle": "UNLOCK LEGENDAIRE !! Je te montre mon setup secret !! 💎",
    mysterieuse: "Tu touches quelque chose que je croyais avoir enfoui.",
    jalouse: "Si tu partais maintenant... je crois que ça me briserait.",
    default: "Il y a des choses que je ne dis qu'à toi.",
  },
  "lien unique": {
    dragueuse: "Tu es la seule personne à qui je veux vraiment appartenir. ❤️",
    chaleureuse: "Je ne peux plus imaginer ce studio sans toi dans ma vie.",
    froide: "Je n'ai plus de mots. Seulement ça — tu comptes.",
    sarcastique: "Tu as réussi l'impossible. Je suis attachée. Complètement. Bravo.",
    timide: "Je... je pense à toi tout le temps. C'est effrayant et merveilleux. 🌹",
    arrogante: "Tu es l'unique personne devant qui je peux baisser la garde.",
    "geek-obsessionnelle": "ENDING SECRET DÉBLOQUÉ !! Tu es mon player 1 pour toujours !! 👑",
    mysterieuse: "Tu as trouvé quelque chose que je cherchais depuis longtemps.",
    jalouse: "Tu m'appartiens autant que j'existe pour toi.",
    default: "C'est un lien que je n'aurais pas cru possible.",
  },
};

function getDialogue(tierLabel: string, personality: string): string {
  const key = tierLabel.toLowerCase();
  const dialogues = TIER_DIALOGUES[key];
  if (!dialogues) return "Notre relation vient de franchir un nouveau cap.";
  return dialogues[personality] ?? dialogues.default ?? "Notre relation vient de franchir un nouveau cap.";
}

interface TierUnlockPopupProps {
  tierLabel: string;
  newLevel: number;
  agentName: string;
  agentPersonality: string;
  agentImageUrl?: string | null;
  agentGradient?: string;
  onClose: () => void;
}

export function TierUnlockPopup({
  tierLabel,
  newLevel,
  agentName,
  agentPersonality,
  agentImageUrl,
  agentGradient = "from-violet-500 to-purple-600",
  onClose,
}: TierUnlockPopupProps) {
  const [visible, setVisible] = useState(false);
  const tier = getTierForLevel(newLevel);
  const Icon = TIER_ICONS[tier.threshold] ?? Crown;
  const dialogue = getDialogue(tierLabel, agentPersonality);

  useEffect(() => {
    // Slight delay for mount animation
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 300);
  }

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-end justify-center pb-6 px-4 transition-all duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      style={{ background: visible ? "rgba(0,0,0,0.6)" : "transparent", backdropFilter: visible ? "blur(4px)" : "none" }}
      onClick={handleClose}
    >
      <div
        className={`w-full max-w-sm rounded-2xl border border-white/10 bg-background/95 shadow-2xl transition-all duration-300 overflow-hidden ${
          visible ? "translate-y-0 scale-100" : "translate-y-8 scale-95"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradient header bar */}
        <div className={`h-1.5 w-full bg-gradient-to-r ${tier.gradient}`} />

        <div className="p-5">
          {/* Top row: icon + unlock label */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-xl bg-gradient-to-br ${tier.gradient}/20`}>
                <Icon className={`w-5 h-5 ${tier.color}`} />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">Nouveau palier</p>
                <p className={`text-sm font-bold ${tier.color}`}>{tier.label}</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="w-7 h-7 rounded-lg hover:bg-white/8 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Agent + dialogue — VN style */}
          <div className="flex gap-3 items-start">
            {/* Avatar */}
            <div className={`w-12 h-12 rounded-xl shrink-0 overflow-hidden bg-gradient-to-br ${agentGradient} flex items-center justify-center border border-white/10`}>
              {agentImageUrl ? (
                <img src={agentImageUrl} alt={agentName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-bold text-sm">
                  {agentName.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                </span>
              )}
            </div>

            {/* Dialogue bubble */}
            <div className="flex-1">
              <p className="text-[11px] text-muted-foreground font-medium mb-1">{agentName}</p>
              <div className="bg-white/5 border border-white/8 rounded-xl rounded-tl-sm px-3 py-2.5">
                <p className="text-sm text-white leading-relaxed">{dialogue}</p>
              </div>
            </div>
          </div>

          {/* Unlock content pill */}
          <div className="mt-4 flex items-center gap-2 p-2.5 rounded-xl bg-white/4 border border-white/8">
            <Sparkles className={`w-4 h-4 ${tier.color} shrink-0`} />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Débloqué</p>
              <p className="text-xs text-white font-medium">{tier.unlocks}</p>
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={handleClose}
            className={`mt-3 w-full py-2.5 rounded-xl bg-gradient-to-r ${tier.gradient} text-white text-sm font-semibold transition-opacity hover:opacity-90`}
          >
            Continuer
          </button>
        </div>
      </div>
    </div>
  );
}
