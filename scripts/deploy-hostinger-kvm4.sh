#!/usr/bin/env bash
# =============================================================================
# MUTUALIS DAKAR (SenMutuelles) · Script d'installation Production Hostinger KVM 4
# Équipe Ngone Cissé (SEN-E-AGENCE · Malick Gueye & Ousmane Gueye)
# Cible : Ubuntu 24.04 LTS (4 vCPU · 16 Go RAM · 200 Go NVMe)
# Usage : sudo bash deploy-hostinger-kvm4.sh senmutuelles.sn contact@senmutuelles.sn
# =============================================================================

set -euo pipefail

DOMAIN="${1:-senmutuelles.sn}"
EMAIL="${2:-admin@${DOMAIN}}"
APP_DIR="/opt/mutualis-dakar"
REPO_URL="https://github.com/Metzo08/mutualis-dakar.git"

echo "================================================================="
echo "  DÉPLOIEMENT MUTUALIS DAKAR sur Hostinger KVM 4"
echo "  Domaine : ${DOMAIN} | Email SSL : ${EMAIL}"
echo "================================================================="

if [[ $EUID -ne 0 ]]; then
  echo "Erreur : veuillez exécuter ce script en root (sudo bash ...)."
  exit 1
fi

echo "[1/7] Mise à jour du système et outils de base..."
apt-get update -y
apt-get install -y ca-certificates curl gnupg lsb-release git ufw fail2ban openssl

echo "[2/7] Installation de Docker Engine & Docker Compose v2..."
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list >/dev/null
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

echo "[3/7] Configuration du pare-feu UFW (Zero-Trust : ports DB/Redis/MinIO fermés)..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
# Coturn WebRTC (téléconsultation 4G/NAT)
ufw allow 3478/tcp
ufw allow 3478/udp
ufw allow 49160:49200/udp
ufw --force enable
systemctl enable --now fail2ban

echo "[4/7] Clonage / mise à jour du dépôt MUTUALIS DAKAR..."
if [[ ! -d "${APP_DIR}/.git" ]]; then
  git clone "${REPO_URL}" "${APP_DIR}"
else
  cd "${APP_DIR}" && git pull --ff-only
fi
cd "${APP_DIR}"

echo "[5/7] Génération des secrets de production (backend/.env et .env racine)..."
if [[ ! -f "${APP_DIR}/backend/.env" ]]; then
  DB_PASS="$(openssl rand -hex 24)"
  S3_KEY="mutualis_$(openssl rand -hex 8)"
  S3_SECRET="$(openssl rand -hex 32)"
  JWT_SEC="$(openssl rand -hex 64)"
  JWT_REF="$(openssl rand -hex 64)"
  TURN_SEC="$(openssl rand -hex 48)"

  cat > "${APP_DIR}/backend/.env" <<EOF
NODE_ENV=production
PORT=5000
DB_USER=postgres
DB_PASSWORD=${DB_PASS}
DB_NAME=mutualis
DB_HOST=pgbouncer
DB_PORT=5432
PG_SHARED_BUFFERS=4GB
PG_EFFECTIVE_CACHE=10GB
PG_WORK_MEM=16MB
PG_MAINT_WORK_MEM=512MB
REDIS_URL=redis://redis:6379
REDIS_MAX_MEMORY=512mb
REALTIME_DRIVER=redis
S3_ENDPOINT=http://minio:9000
S3_BUCKET=mutualis-csu
S3_ACCESS_KEY=${S3_KEY}
S3_SECRET_KEY=${S3_SECRET}
JWT_SECRET=${JWT_SEC}
JWT_REFRESH_SECRET=${JWT_REF}
TURN_STATIC_AUTH_SECRET=${TURN_SEC}
TURN_REALM=${DOMAIN}
CORS_ORIGINS=https://${DOMAIN},https://www.${DOMAIN}
EOF
  chmod 600 "${APP_DIR}/backend/.env"
  cp "${APP_DIR}/backend/.env" "${APP_DIR}/.env"
  chmod 600 "${APP_DIR}/.env"
  echo "  -> Secrets générés et protégés (chmod 600)."
else
  echo "  -> backend/.env existe déjà, conservé intact."
fi

echo "[6/7] Adaptation du domaine Nginx (${DOMAIN})..."
sed -i "s/senmutuelles\.sn/${DOMAIN}/g" "${APP_DIR}/nginx.d/senmutuelles.conf"

echo "[7/7] Compilation Frontend & démarrage de la stack Docker..."
docker run --rm -v "${APP_DIR}:/app" -w /app node:22-alpine sh -c "npm ci && npm run build"

echo ""
echo "================================================================="
echo "  PRÊT POUR LE CERTIFICAT SSL & LE LANCEMENT FINAL !"
echo "  1. Vérifiez que le DNS A de ${DOMAIN} pointe vers l'IP du VPS."
echo "  2. Obtenez le certificat Let's Encrypt :"
echo "     docker run --rm -p 80:80 -v mutualis-dakar_certbot_conf:/etc/letsencrypt certbot/certbot certonly --standalone -d ${DOMAIN} -d www.${DOMAIN} --email ${EMAIL} --agree-tos --no-eff-email"
echo "  3. Lancez la stack complète :"
echo "     cd ${APP_DIR} && docker compose up -d --build"
echo "================================================================="
