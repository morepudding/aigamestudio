# Bureau Isométrique — Phase 1 : MVP "Faux Isométrique"

## Objectif

Remplacer (ou enrichir) la page d'accueil actuelle (`app/page.tsx`) par une vue de bureau stylisée où les agents apparaissent à leurs postes de travail. Clic sur un agent → ouvre le ChatPanel existant. Aucun moteur de rendu, aucune lib externe.

---

## Production des visuels

### Méthode : Flux via OpenRouter

Les images sont générées via `black-forest-labs/flux.2-klein-4b` sur OpenRouter — le même appel que `generate-avatar` (`app/api/ai/generate-avatar/route.ts`).

**Appel type :**
```ts
fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.OPEN_ROUTE_SERVICE_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "black-forest-labs/flux.2-klein-4b",
    messages: [{ role: "user", content: PROMPT }],
    modalities: ["image"],
  }),
});
// → data.choices[0].message.images[0].image_url.url (base64 data URL)
```

On crée une route dédiée `app/api/ai/generate-office-asset/route.ts` avec un paramètre `asset` (`"background"` | `"desk-marker"` | `"desk-empty"`) qui dispatch le bon prompt et upload dans Supabase Storage bucket `office-assets`.

### Méthode : Icônes département (code)

Les icônes de département sont des composants React SVG inline générés avec **Lucide React** (déjà installé dans le projet). Pas de fichier image, pas d'appel API. Un composant `DeptIcon` mappe chaque département à l'icône Lucide la plus pertinente avec la couleur du `departmentGradients`.

---

## Livrables d'images — générés par Flux

### 1. Fond de bureau — `bureau-bg.png`

**Prompt Flux :**
```
Isometric view of a dark cyberpunk indie game studio interior, open office space, 
night ambiance, neon blue and violet ambient lighting with warm desk lamp accents, 
8 empty workstations with glowing monitors, one elevated director desk near a large 
window, city skyline at night visible through floor-to-ceiling windows, 
server racks on the walls, whiteboards with colorful post-its, indoor plants, 
no people, ultra-detailed, sharp, dark theme, glassmorphism aesthetic, 
cinematic lighting, wide angle, 16:9 ratio
```

**Stockage :** Supabase Storage `office-assets/bureau-bg.png`
**Dimensions :** 1920×1080 minimum
**Format :** PNG

---

### 2. Marqueur de poste vide — `desk-marker.png`

**Note :** Ce livrable peut être remplacé par du CSS pur (ellipse avec `box-shadow` et `opacity`). L'image n'est utile que si on veut un effet plus travaillé.

Si généré par Flux :
```
Isometric floor shadow, oval glowing halo on dark floor, 
soft neon blue light emission, transparent background, 
minimal, 60x30px equivalent, no text, isolated element
```

**Recommandation :** Faire en CSS d'abord, Flux si insatisfaisant.

---

### 3. Écran de bureau allumé — `desk-glow.png` *(optionnel)*

Overlay lumineux positionné sur chaque poste occupé pour simuler l'écran allumé.

```
Glowing computer monitor screen light on dark desk surface, 
isometric perspective, cold blue-white light spill, 
no text on screen, dark ambient, isolated element, 
transparent background PNG
```

---

## Livrables icônes département — code (Lucide React)

Composant `DeptIcon` à créer dans `components/ui/DeptIcon.tsx`.

| Département | ID | Lucide Icon | Couleur |
|-------------|-----|-------------|---------|
| Art | `art` | `Palette` | `from-pink-500 to-rose-600` |
| Programming | `programming` | `Code2` | `from-cyan-500 to-blue-600` |
| Game Design | `game-design` | `Gamepad2` | `from-amber-500 to-orange-600` |
| Audio | `audio` | `Music` | `from-violet-500 to-purple-600` |
| Narrative | `narrative` | `BookOpen` | `from-emerald-500 to-teal-600` |
| QA | `qa` | `Bug` | `from-lime-500 to-green-600` |
| Marketing | `marketing` | `Megaphone` | `from-red-500 to-pink-600` |
| Production | `production` | `Kanban` | `from-indigo-500 to-blue-600` |

**Usage attendu :** badge sur le poste de travail de l'agent dans la vue bureau, et éventuellement dans les tooltips.

---

## Coordonnées de positionnement des agents

Les postes seront positionnés en `position: absolute` sur le fond. Voici les zones approximatives (% de la largeur/hauteur du conteneur) — **à calibrer après réception du fond** :

| Poste | Zone suggérée (X%, Y%) | Département |
|-------|------------------------|-------------|
| Poste 1 | 15%, 35% | Art |
| Poste 2 | 30%, 25% | Programming |
| Poste 3 | 50%, 20% | Game Design |
| Poste 4 | 65%, 30% | Audio |
| Poste 5 | 75%, 50% | Narrative |
| Poste 6 | 40%, 55% | QA |
| Poste 7 | 20%, 60% | Marketing |
| Direction | 85%, 15% | Production / Admin |

**Important pour le prompt Flux :** les postes doivent être visuellement distincts et espacés pour que le positionnement CSS soit précis.

---

## Architecture code

```
app/
  page.tsx                          ← remplace le dashboard par IsometricOffice (+ fallback)
  api/ai/generate-office-asset/
    route.ts                        ← POST { asset: "background" | "desk-marker" } → génère + upload Supabase

components/
  office/
    IsometricOffice.tsx             ← composant principal : fond + agents positionnés
    AgentDeskSpot.tsx               ← un poste : MoodRing + tooltip + clic → chat
    DeskMarker.tsx                  ← halo CSS (ou image) sous l'avatar
  ui/
    DeptIcon.tsx                    ← icônes Lucide par département (nouveau)
```

### Ce qui est réutilisé sans changement
- `MoodRing` — avatar avec anneau coloré selon humeur
- `ChatPanelProvider` / `useChatPanel` — ouverture du chat au clic
- `fetch("/api/agents")` — liste des agents depuis Supabase

---

## Ce qui sera codé

- Route API `generate-office-asset` : dispatch prompt → Flux → upload Supabase Storage
- Composant `IsometricOffice` : fond + positionnement absolu des agents
- Composant `AgentDeskSpot` : MoodRing + tooltip (nom, rôle, humeur) + clic → ChatPanel
- Composant `DeptIcon` : icônes Lucide par département
- Composant `DeskMarker` : halo CSS animé sous l'avatar
- Fallback : si aucun agent chargé → dashboard classique

---

## Ce qui n'est PAS dans le scope Phase 1

- Animations de déplacement des agents
- Pathfinding / IA de comportement
- Vrai moteur isométrique avec tiles
- Événements spontanés visuels dans le bureau
- Cycle jour/nuit

---

## Checklist

### Images (Flux)
- [ ] `bureau-bg.png` — fond principal, généré via `generate-office-asset`
- [ ] `desk-marker.png` — optionnel, CSS d'abord
- [ ] `desk-glow.png` — optionnel, polish

### Code
- [ ] `app/api/ai/generate-office-asset/route.ts`
- [ ] `components/ui/DeptIcon.tsx` — icônes Lucide
- [ ] `components/office/DeskMarker.tsx` — halo CSS
- [ ] `components/office/AgentDeskSpot.tsx`
- [ ] `components/office/IsometricOffice.tsx`
- [ ] `app/page.tsx` — intégration + fallback

**Dossier assets dans le projet :** `public/office/`  
**Bucket Supabase :** `office-assets`
