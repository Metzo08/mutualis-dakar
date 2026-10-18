# Guide — Interagir avec les agents MUTUALIS (OpenCode)

## 1. Lancer OpenCode

Dans le dossier du projet :

```powershell
opencode
```

L'agent principal chargé par défaut est `mutualis-orchestrator` (défini dans `opencode.json`). Il lit automatiquement `AGENTS.md` comme règles projet.

## 2. Comment demander un travail

Parlez-lui en français, comme à un chef de projet. Exemples :

| Vous dites | Ce qui se passe |
|---|---|
| « Ajoute une route API pour lister les rendez-vous paginés, réservée aux agents » | L'orchestrateur délègue à `mutualis-backend-engineer`, puis à `testing-api-tester`, puis applique la revue |
| « La page Galerie affiche des données qui ne remontent pas, corrige » | L'orchestrateur envoie `mutualis-frontend-engineer` analyser, corriger, puis rejouer build+tests |
| « Vérifie qu'un citoyen ne peut pas lire les bons de commande d'un autre » | Mission `security-appsec-engineer` (audit lecture seule) |
| « Revois mon dernier commit » | `mutualis-orchestrator` → `mutualis-code-reviewer` (rapport CRITICAL/HIGH/… + verdict) |

Bonnes pratiques :
- un besoin par message, avec le résultat attendu ;
- précisez la couche si vous la connaissez (« backend », « page X ») ;
- les agents ne considèrent jamais un travail terminé sans tests verts (règle `AGENTS.md` §9).

## 3. Commandes utiles dans la session

| Commande | Effet |
|---|---|
| `/agents` | Liste les agents disponibles |
| `/models` | Liste les modèles (Groq, Gemini, NVIDIA, OpenCode Zen) configurés dans `opencode.json` |
| Tab | Bascule vers un autre agent explicitement |
| `/init` | (Re)génère/actualise le contexte projet si besoin |

## 4. Modèles gratuits configurés

Définis dans `opencode.json` — choisissez via `/models` :

| Provider | Modèle | Usage conseillé |
|---|---|---|
| Google | `gemini-2.0-flash` | Orchestration, revue, raisonnement (rapide, gros contexte) |
| Groq | `llama-3.3-70b-versatile` | Génération de code backend/frontend (très rapide) |
| Groq | `llama-3.1-8b-instant` | Tâches simples, très bas latence |
| NVIDIA NIM | `meta/llama-3.3-70b-instruct`, `nvidia/llama-3.1-nemotron-70b-instruct` | Alternative de code/raisonnement |
| OpenCode Zen | `groq-code-agent`, `grok-code` | Agents spécialisés « code » gratuits |
| Hugging Face | `meta-llama/Llama-3.3-70B-Instruct`, `Qwen/Qwen2.5-Coder-32B-Instruct` | Modèles open-source via HF Router |
| B.AI | `minimax-m3` | Modèles gratuits via agrégateur B.AI |
| xAI | `grok-code-fast-1` | Génération de code rapide (Grok) |
| UnoRouter | `grok-code`, `llama-3.3-70b` | Routeur OpenAI-compatible, 232+ modèles |

Clés API — à définir dans l'environnement Windows (jamais dans le code) :

```powershell
setx GROQ_API_KEY "votre_cle"      # https://console.groq.com/keys
setx GEMINI_API_KEY "votre_cle"    # https://aistudio.google.com/apikey
setx NVIDIA_API_KEY "votre_cle"    # https://build.nvidia.com
setx HUGGINGFACE_API_KEY "votre_cle"  # https://huggingface.co/settings/tokens
setx BAI_API_KEY "votre_cle"       # https://chat.b.ai
setx XAI_API_KEY "votre_cle"       # https://console.x.ai
setx UNOROUTER_API_KEY "votre_cle" # https://unorouter.com/en
setx XKIRO_API_KEY "votre_cle"     # https://xkiro.com (si disponible)
```

Après `setx`, fermez et rouvrez le terminal. Dans OpenCode, vérifiez avec `/models`.

Épinglage actuel des agents MUTUALIS :
- `mutualis-orchestrator` → `google/gemini-2.0-flash`
- `mutualis-code-reviewer` → `google/gemini-2.0-flash`
- `mutualis-backend-engineer` → `groq/llama-3.3-70b-versatile`
- `mutualis-frontend-engineer` → `groq/llama-3.3-70b-versatile`

Pour changer : modifiez la ligne `model:` dans le front-matter du `.md` de l'agent.

## 5. Sécurité

- Les agents respectent `AGENTS.md` : jamais de secret dans le code, jamais de données personnelles dans les logs.
- `mutualis-code-reviewer` est lecture seule par conception.
- Ahmed Tall valide toute mise en production (règle 13 d'`AGENTS.md`).
