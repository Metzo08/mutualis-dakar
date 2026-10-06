# ═════════════════════════════════════════════════════════════════════════════
# MUTUALIS DAKAR — IMAGE BACKEND
# ═════════════════════════════════════════════════════════════════════════════
#
# Étapes de construction multiniveau :
#   1. deps  → installe les dépendances natives (bcrypt, sharp) qui exigent
#              des outils de compilation. Ils ne sont PLUS nécessaires ensuite.
#   2. runtime → ne contient que les modules produits par la compilation, plus
#              le code applicatif.
#
# Pourquoi deux étapes : `bcrypt` et `sharp` sont des modules natifs. Ils se
# compilent dans `deps`, et `sharp` embarque des bibliothèques graphiques
# volumineuses. Les garder dans l'image finale l'alourdirait pour rien.
# ═════════════════════════════════════════════════════════════════════════════

# ── Étape 1 : compilation des dépendances natives ───────────────────────────
FROM node:22-bookworm-slim AS deps

# python3, make, g++ : requis pour compiler bcrypt et sharp.
# apt-get est nettoyé dans la même commande : les indices de paquets nont
# rien à faire dans l'image finale et alourdissent le build de contexte.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copie uniquement les manifestes AVANT le code : tant que ces fichiers ne
# changent pas, Docker réutilise la couche `npm ci`. Le code change tous les
# jours, les dépendances rarement.
COPY backend/package.json backend/package-lock.json ./

# `npm ci` et non `npm install` : il installe EXACTEMENT les versions du
# verrouillage. `npm install` peut en déduire d'autres et introduire un
# écart entre ce qui est testé et ce qui est déployé.
RUN npm ci --omit=dev

# ── Étape 2 : image d'exécution ─────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime

# tini : sans lui, aucun processus .init dans le conteneur, Node ne reçoit pas
# les signaux et l'arrêt prend 10 s (le filet de sécurité du code), ce qui
# finit par faire tuer le conteneur de force.
RUN apt-get update \
    && apt-get install -y --no-install-recommends tini ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
WORKDIR /app

# Les modules natifs compilés en étape 1, avec leurs dépendances partagées.
COPY --from=deps /app/node_modules ./node_modules

COPY backend/ ./

# Utilisateur non privilégié. L'exécution en root donnerait à une éventuelle
# intrusion tous les droits sur le conteneur.
RUN chown -R node:node /app
USER node

EXPOSE 5000

# tini devient le PID 1 et transmet les signaux à Node.
ENTRYPOINT ["/usr/bin/tini", "--"]

# La sonde de santé est définie dans docker-compose.yml : ici on se limite au
# signal de vie de base.
CMD ["node", "server.js"]