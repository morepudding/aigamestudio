# Analyse qualitative des feedbacks agents

Date: 2026-04-21
Source: docs/agent-conversations-feedback-report-2026-04-21.md

## Vue d'ensemble

- Messages notes: 29
- Thumbs up: 16
- Thumbs down: 13
- Agents avec signal exploitable: eve, kaida_kurosawa, lyra_duskthorn, lysara_vexley
- Agents sans signal exploitable a ce stade: kael_voss, kyan_vega

Le signal utilisateur n'est pas aleatoire. Les thumbs up recompensent surtout des reponses qui ont une chute claire, une image concrete, une repartie courte ou une capacite a pivoter proprement quand la conversation change de ton. Les thumbs down apparaissent surtout sur trois familles de defauts: repetition quasi exacte, prolongation d'un sujet que l'utilisateur veut quitter, ou surenchere metaphorique qui n'ajoute pas assez de precision relationnelle.

## Analyse par agent

### Eve

Score observe: 5 positifs, 2 negatifs.

Lecture qualitative:

- Eve performe bien quand elle prend un motif installe et le pousse un cran plus loin avec une image nette. Les chevaux, le pingouin en costard, le super-heros presse: ce sont des images memorables, faciles a visualiser, avec une chute legere.
- Ses meilleurs messages gardent une structure simple: constat, image, chute. Ils restent lisibles meme quand le ton est absurde.
- Eve gere assez bien l'ambiguite et sait poser une limite en gardant du style. Le message sur le "rodeo ou metaphore douteuse" est un bon exemple de cadrage sans casser la dynamique.
- Ses thumbs down ne sanctionnent pas vraiment l'humour, mais un humour un peu moins precis. Le message sur le cinquieme cafe reste dans la meme zone semantique que les messages precedents sans vraie progression. Le message sur "panda" et "tomate" ajoute de l'image mais tourne un peu plus autour de la flatterie que de la relation ou du sujet.

Conclusion agent:

- Eve a un bon fit utilisateur quand elle reste imagée, concise et capable de recadrer sans devenir plate.
- Son risque principal n'est pas la repetition mechanique, mais la dilution: trop de comparaison successive sur le meme theme peut faire baisser l'impact.

### Kaida Kurosawa

Score observe: 6 positifs, 4 negatifs.

Lecture qualitative:

- Kaida genere le plus de signal utile. L'utilisateur repond bien a son ton taquin quand il est cible et relationnel.
- Ses thumbs up sont sur des piques courtes, des sous-entendus propres, et des reponses qui referment bien une tension. "Ah, donc c'est un cauchemar", "je veux un rapport detaille", ou le reve de refactorisation sont efficaces parce qu'ils sont nets, contextualises et personnalises.
- Les bons messages de Kaida ont presque toujours une fonction claire: teaser, piquer, ou relancer avec une promesse precise. Ils ne flottent pas.
- Les thumbs down montrent deux problemes distincts. D'abord la repetition brute de "tu t'es pose un peu ou pas encore ?". Ensuite des relances plus longues qui restent dans une energie generique ou trop facile, comme le plaid anti-realite ou la pause cafe sur la fin.
- Le bon pattern chez Kaida n'est pas juste la provocation. C'est la provocation precise, connectee au fil exact de l'echange. Quand elle improvise une ligne plus standard, le contraste se voit tout de suite et l'utilisateur la sanctionne.

Conclusion agent:

- Kaida a le meilleur potentiel relationnel du lot si on preserve sa precision et son mordant.
- Il faut fortement eviter les fillers conversationnels et les relances reutilisables d'une conversation a l'autre.

### Lyra Duskthorn

Score observe: 3 positifs, 5 negatifs.

Lecture qualitative:

- Lyra a une vraie capacite a plaire quand elle revient sur le concret de l'echange et qu'elle ouvre un sujet plus vivant que le cafe ou la fatigue.
- Ses thumbs up arrivent sur des messages qui repondent vraiment a l'utilisateur avec une couleur de personnage: moquerie douce, reference au coin detente, reunions absurdes, croquis en gribouillis abstraits.
- Ses thumbs down sont tres coherents: repetition mot pour mot de la meme question, insistance sur le cafe, et manque d'ecoute du signal utilisateur. Le cas le plus clair est a 17:57:01, ou l'utilisateur arrive pour parler et Lyra repart sur le cafe; 17 secondes plus tard, quand elle accepte de changer de sujet, elle obtient un thumbs up.
- Cela indique un probleme moins de style que de pilotage conversationnel. Le personnage fonctionne quand il suit le pivot demande. Il echoue quand il reste bloque sur un topic residue.

Conclusion agent:

- Lyra n'est pas rejetee pour son ton, mais pour sa faible discipline conversationnelle.
- C'est probablement l'agent qui gagnerait le plus vite en qualite avec une simple regle de non-repetition et de respect explicite des changements de sujet.

### Lysara Vexley

Score observe: 2 positifs, 2 negatifs.

Lecture qualitative:

- Lysara a un signal plus petit, mais il raconte quelque chose de propre. Les thumbs up recompensent des reponses logiques, ancrees dans le scenario karting, avec un leger decalage ironique.
- Son message positif sur l'angle parfait fonctionne car il garde la logique interne de la scene et prolonge la blague de maniere credible.
- Son thumbs down principal sur le "fait avere" montre une sur-explication ou une formulation un peu auto-enfermee. L'image est la meme, mais le dosage est moins bon.
- Elle subit aussi la question repetitive "tu t'es pose un peu ou pas encore ?", ce qui confirme que ce probleme ne vient pas de l'identite de l'agent mais d'un mecanisme plus global.

Conclusion agent:

- Lysara semble bien performer quand elle reste analytique, un peu seche, et concentree sur la logique de la situation.
- Il faut eviter les formulations qui surchargent une meme blague sans la clarifier.

### Kael Voss

Score observe: 0 positif, 0 negatif.

Lecture qualitative:

- Pas assez de feedback pour juger la qualite percue.
- Les deux messages visibles sont des ouvertures assez generiques sur la fatigue et la reunion. Ils ne donnent pas encore un style tres distinctif.

Conclusion agent:

- Aucune conclusion solide.
- Priorite: obtenir quelques interactions notees avant d'ajuster le prompt.

### Kyan Vega

Score observe: 0 positif, 0 negatif.

Lecture qualitative:

- Pas assez de feedback pour juger la qualite percue.
- Les messages sont plutot fonctionnels et socialement plausibles, mais le style est encore peu differencie.

Conclusion agent:

- Aucune conclusion solide.
- Priorite: obtenir quelques interactions notees avant d'ajuster le prompt.

## Synthese globale thumbs up vs thumbs down

### Ce que les thumbs up semblent recompenser

- Une image mentale immediate: cheval, pingouin en costard, gribouillis abstraits, angle parfait en karting.
- Une reponse qui fait avancer la scene au lieu de recycler le sujet precedent.
- Un ton joueur mais proprement calibre a la relation en cours.
- Une repartie courte a moyenne, avec une chute identifiable.
- Un pivot assume quand l'utilisateur change le sujet ou pose une limite.
- Un ancrage tres local dans le dernier message utilisateur plutot qu'une relance generique.

### Ce que les thumbs down semblent sanctionner

- La repetition mot pour mot d'une meme phrase entre agents ou a plusieurs moments de la meme conversation.
- L'insistance sur un sujet que l'utilisateur veut quitter, surtout le cafe dans cet echantillon.
- Les relances fillers qui pourraient etre prononcees par n'importe quel agent.
- Les messages qui prolongent une metaphore sans lui donner de nouvelle information ou de nouvelle tension.
- Les reponses qui manquent de pilotage conversationnel, meme si le ton de base est correct.

### Pattern transversal le plus net

Le pattern le plus fort est la sanction de la repetition systemique. La phrase "tu t'es pose un peu ou pas encore ?" prend plusieurs thumbs down chez plusieurs agents. Ce n'est donc pas un probleme de personnage mais un probleme de generation ou d'orchestration commun.

### Deuxieme pattern transversal

Le deuxieme pattern est la recompense des messages qui semblent ecrits pour ce moment exact de la conversation. Meme quand le style est absurde, l'utilisateur aime que la reponse soit precise, situee, et non interchangeable.

### Troisieme pattern transversal

L'utilisateur accepte tres bien la taquinerie, l'humour et la flirtation legere, mais seulement si le message reste vif et fin. Des qu'il bascule vers le generique, le redondant, ou le pilotage automatique, la sanction tombe vite.

## Hypotheses produit

- Il existe probablement un reservoir de relances faibles reutilisees entre agents, en particulier autour de la fatigue, de la pause et du cafe.
- Le systeme semble parfois privilegier la continuite thematique au detriment de l'ecoute du dernier signal utilisateur.
- Les agents les mieux percus ne sont pas necessairement les plus droles, mais les plus specifiques et les plus reactifs au contexte immediat.

## Priorites d'amelioration

1. Interdire la repetition recente exacte ou quasi exacte d'une meme relance, a minima par agent et idealement globalement.
2. Ajouter une regle de pivot: si l'utilisateur demande de changer de sujet ou montre une lassitude sur un theme, le prochain message ne doit pas relancer ce theme.
3. Favoriser des reponses plus courtes avec une seule image forte plutot qu'une accumulation de metaphore.
4. Renforcer l'ancrage au dernier message utilisateur avant toute relance de personnalite.
5. Preserver la couleur propre de Kaida, Eve, Lyra et Lysara, mais supprimer les fillers partageables entre elles.