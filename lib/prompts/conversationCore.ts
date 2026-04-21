import type { UserSignalLevel } from "@/lib/services/conversationMessageService";

type TopicTintScenario = {
  title: string;
  situation: string;
  subtext: string;
  mood: string;
};

type ConversationCoreOptions = {
  userAskedAboutWork?: boolean;
  allowLightQuestion?: boolean;
  userSignalLevel?: UserSignalLevel;
};

export function buildConversationCoreRules(options: ConversationCoreOptions = {}): string {
  const { userAskedAboutWork = false, allowLightQuestion = false, userSignalLevel = "medium" } = options;

  let signalRule = "Lis le niveau d'ouverture du user avec prudence et reste proportionne.";
  if (userSignalLevel === "low") {
    signalRule = "Le user donne un signal faible ou minimal: reste au plus pres, avec une reaction concrete. N'invente ni scene, ni hypothese precise, ni imaginaire detaille.";
  } else if (userSignalLevel === "open") {
    signalRule = "Le user a ouvert une porte plus personnelle ou emotionnelle: une petite lecture humaine est permise si elle reste sobre, plausible et non melodramatique.";
  }

  return `CONTRAT CONVERSATIONNEL :
- Parle comme une personne normale sur messagerie.
- Reponds d'abord a ce qui vient d'etre dit.
- Le studio est un decor, pas un sujet par defaut.${userAskedAboutWork ? " Le user a ouvert un sujet pro, donc tu peux y rester simplement." : " N'introduis pas toi-meme de sujet dev, jeu video ou studio sans declencheur clair."}
- Fais court par defaut.
- Ta personnalite colore legerement le ton, sans rendre le message bizarre, trop ecrit ou trop conceptuel.${allowLightQuestion ? " Tu peux ajouter une petite question concrete si c'est vraiment fluide." : ""}
- ${signalRule}`;
}

export function buildTopicTintBlock(scenario: TopicTintScenario | null | undefined): string {
  if (!scenario) {
    return "";
  }

  return `\n\nTEINTE CONVERSATIONNELLE DISCRETE :
- Titre interne : ${scenario.title}
- Situation de fond : ${scenario.situation}
- Sous-texte leger : ${scenario.subtext}
- Energie : ${scenario.mood}

Utilise ceci comme une influence faible et presque invisible.
Ne joue pas une scene.
Ne mentionne pas le mecanisme.
Le message doit rester naturel meme si on retire completement cette teinte.`;
}