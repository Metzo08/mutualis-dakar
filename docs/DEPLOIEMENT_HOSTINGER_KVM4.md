# Guide de Déploiement Production — SenMutuelles sur Hostinger KVM 4

**Profil serveur cible :** Hostinger KVM 4 (**4 vCPU · 16 Go RAM · 200 Go NVMe**)

## 1. Pare-feu VPS (`ufw`)
```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
# Coturn WebRTC (indispensable pour téléconsultation en 4G/NAT)
ufw allow 3478/tcp
ufw allow 3478/udp
ufw allow 49160:49200/udp
ufw enable
```
*(Ne jamais ouvrir `5432`, `6379` ni `9001` sur Internet.)*

## 2. Variables `backend/.env` à configurer
- `NODE_ENV=production`
- `DB_HOST=pgbouncer`
- `PG_SHARED_BUFFERS=4GB`, `PG_EFFECTIVE_CACHE=10GB`, `PG_WORK_MEM=16MB`, `PG_MAINT_WORK_MEM=512MB`
- `REDIS_MAX_MEMORY=512mb`
- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `TURN_STATIC_AUTH_SECRET` générés via `openssl rand -hex 64`
- `CORS_ORIGINS=https://VOTRE_DOMAINE`
- `PHOTOS_*` et `SOURCE_*` pointant vers les chemins Linux (ex: `/data/imports/...`)

## 3. Démarrage de la stack
```bash
npm run build
docker compose up -d --build
```
*(Pour la toute première initialisation sur base vierge uniquement : exécuter `ALLOW_DESTRUCTIVE_INIT_DB=I_CONFIRM_DATA_LOSS node backend/init_db.js`.)*
