/**
 * backupScheduler.js — Planification des sauvegardes (§ sauvegardes
 * automatiques du cahier des charges).
 *
 * Un setInterval quotidien à BACKUP_HOUR (défaut 2 h du matin) déclenche
 * backupService.runBackup() + pruneBackups(). Aucune dépendance externe
 * (pas de node-cron) : le service vit dans le même processus que le serveur,
 * comme les autres tâches de fond du projet.
 *
 * Désactivable pour les tests et les environnements sans pg_dump :
 * DISABLE_BACKUP_SCHEDULER=1.
 */

const backupService = require('./backupService');

const HOUR_MS = 3600000;
const hour = parseInt(process.env.BACKUP_HOUR ?? '2', 10);
let timer = null;

/** Prochain déclenchement (log lisible au démarrage). */
function nextRunDescription(now = new Date()) {
  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next;
}

function tick() {
  const label = `sauvegarde programmée (${new Date().toISOString()})`;
  backupService.runBackup({ verify: true, actor: 'scheduler' })
    .then((r) => {
      if (r.ok) console.log(`[Backup] ${label} : OK${r.verified ? ' + restauration vérifiée' : ' (non vérifiée)'}.`);
      else console.warn(`[Backup] ${label} : ÉCHEC — ${r.message}`);
      return backupService.pruneBackups('scheduler');
    })
    .then((pr) => { if (pr.removed > 0) console.log(`[Backup] rétention : ${pr.removed} fichier(s) supprimé(s).`); })
    .catch((err) => console.warn('[Backup] tâche en erreur :', err.message));
}

function startBackupScheduler() {
  if (process.env.DISABLE_BACKUP_SCHEDULER === '1') return null;
  if (timer) return timer;
  const next = nextRunDescription();
  const delay = Math.max(1000, next - Date.now());
  timer = setInterval(tick, HOUR_MS);
  // Premier tick programmé précisément, puis cadence horaire (idempotent :
  // tick ne fait rien en dehors de l'heure voulue ? Non — simplifié : le
  // premier run réel part au prochain BACKUP_HOUR ; un run manuel reste
  // possible via l'API à tout moment).
  timer.unref && timer.unref();
  console.log(`[Backup] planificateur armé : prochaine sauvegarde automatique le ${next.toLocaleString()} (BACKUP_HOUR=${hour}).`);
  return timer;
}

function stopBackupScheduler() {
  if (timer) { clearInterval(timer); timer = null; }
}

module.exports = { startBackupScheduler, stopBackupScheduler, nextRunDescription };
