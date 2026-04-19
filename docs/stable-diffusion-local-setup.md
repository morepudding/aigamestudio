# Stable Diffusion — Setup Local pour Eden Studio

## Contexte

Remplacer les appels OpenRouter (payants) par notre GPU local pour la génération d'images.
6 Go VRAM → on reste sur l'écosystème **SD1.5** (512px natif, léger, rapide).

---

## Interface à utiliser

**AUTOMATIC1111 WebUI** — lancer avec le flag `--api` :

```bash
# Windows (webui-user.bat) — ajouter dans COMMANDLINE_ARGS :
set COMMANDLINE_ARGS=--api --xformers
```

L'API sera disponible sur `http://localhost:7860`

---

## Checkpoints à télécharger (Civitai)

### Portraits / Avatars des agents
| Modèle | Lien Civitai | Pourquoi |
|---|---|---|
| **Realistic Vision v5.1** | chercher "Realistic Vision v5.1" | Meilleur checkpoint SD1.5 pour portraits photoréalistes |
| Deliberate v3 | chercher "Deliberate v3" | Alternative plus artistique |

→ Dossier : `models/Stable-diffusion/`

### Pixel Art / Office Assets
| Modèle | Lien Civitai | Pourquoi |
|---|---|---|
| **PixelKnit** | chercher "PixelKnit" | Checkpoint SD1.5 dédié pixel art, excellent résultat |
| Pixel Art Diffusion | chercher "Pixel Art Diffusion" | Alternative, style plus rétro |

→ Dossier : `models/Stable-diffusion/`

---

## LoRA recommandés (bonus)

| LoRA | Usage | Dossier |
|---|---|---|
| **Isometric Room / Game Assets** | Forcer perspective isométrique pour office assets | `models/Lora/` |
| **Pixel Art Style** | Renforcer le style pixel si checkpoint insuffisant | `models/Lora/` |

Usage dans le prompt : `<lora:isometric_game:0.8>`

---

## Mapping endpoints Eden Studio

| Endpoint Next.js | Modèle actuel | → Remplacer par |
|---|---|---|
| `/api/ai/generate-avatar` | OpenRouter flux.2-klein | SD local + **Realistic Vision v5.1** |
| `/api/ai/generate-office-asset` | OpenRouter gemini-2.5-flash | SD local + **PixelKnit** |
| `/api/ai/generate-exclusive-photo` | Civitai (déjà SD1.5) | Garder ou basculer en local |

---

## API AUTOMATIC1111 — appel type

```
POST http://localhost:7860/sdapi/v1/txt2img
{
  "prompt": "...",
  "negative_prompt": "...",
  "steps": 25,
  "cfg_scale": 7,
  "width": 512,
  "height": 512,
  "sampler_name": "DPM++ 2M Karras"
}
```

Réponse : image en base64 dans `images[0]`

---

## Prochaines étapes

1. Allumer le PC fixe, lancer AUTOMATIC1111 avec `--api`
2. Télécharger **Realistic Vision v5.1** + **PixelKnit** sur Civitai
3. Tester l'API manuellement : `curl http://localhost:7860/sdapi/v1/sd-models`
4. Modifier `generate-avatar/route.ts` → appel SD local
5. Modifier `generate-office-asset/route.ts` → appel SD local + switch de checkpoint
6. Exposer via **Cloudflare Tunnel** (voir section ci-dessous)

---

## img2img

AUTOMATIC1111 supporte aussi `img2img` via `POST /sdapi/v1/img2img`.
Utile pour :
- Générer l'**icône agent** à partir du portrait (cohérence de visage garantie)
- Partir d'une référence pour les **office assets** isométriques

```json
{
  "init_images": ["<base64>"],
  "prompt": "...",
  "denoising_strength": 0.6
}
```

> Note : `denoising_strength` entre 0.4 (proche de l'original) et 0.8 (très libre).

---

## Exposer le PC fixe depuis l'app déployée (Vercel)

**Choix retenu : Cloudflare Tunnel** — gratuit, URL fixe, aucune config réseau/box.

### Installation

```bash
# Télécharger cloudflared sur le PC fixe
# https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

cloudflared tunnel --url http://localhost:7860
# → génère une URL publique fixe : https://xxx.trycloudflare.com
```

### Config dans le projet

```env
# .env.local (et variables Vercel)
SD_API_URL=https://xxx.trycloudflare.com
```

Next.js appellera `${SD_API_URL}/sdapi/v1/txt2img` depuis Vercel.

> **Contrainte** : le PC fixe doit être allumé. Si éteint → prévoir un fallback OpenRouter.
