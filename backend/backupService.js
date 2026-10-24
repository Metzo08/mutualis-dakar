/**
 * backupService.js — Sauvegardes vérifiables de la base (§ « sauvegardes
 * automatiques et tests de restauration » du cahier des charges).
 *
 * PRINCIPE : une sauvegarde qui n'a jamais été restaurée n'est pas une
 * sauvegarde, c'est un espoir. Ce module :
 *   1. lance `pg_dump` (format custom `-Fc`, compressé, restaurable par
 *      pg_restore) sur la base configurée dans .env ;
 *   2. VÉRIFIE chaque sauvegarde en la restaurant dans une base temporaire
 *      jetable (`mutualis_restore_check`), puis en comparant le nombre de
 *      tables et les compteurs de quelques tables clés entre l'original et
 *      la copie restaurée ;
 *   3. journalise chaque opération dans le journal d'audit, sans contenu
 *      personnel (uniquement des comptages et des chemins).
 *
 * AUCUNE donnée personnelle n'est copiée hors du serveur : le fichier de
 * sauvegarde reste dans BACKUP_DIR, la base de vérification est détruite
 * après contrôle (DROP DATABASE ... WITH (FORCE) si disponible).
 *
 * Les exécutions programmées sont planifiées par backupScheduler.js (cron
 * simple par setTimeout, sans dépendance externe).
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { query } = require('./db');
const { recordAudit } = require('./auditTrail');

/** Répertoire des sauvegardes (surchargeable par l'environnement). */
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, 'backups');

/**
 * Chemin de pg_dump. Sur Windows, il n'est pas toujours dans le PATH : on
 * cherche dans les installations PostgreSQL standard avant d'échouer.
 */
function findBinary(name) {
  const envKey = process.env[`PG_${name.toUpperCase()}_PATH`] || process.env[`PG_${name}_PATH`];
  if (envKey) return envKey;
  const candidates = [];
  if (process.env.PGBIN) candidates.push(path.join(process.env.PGBIN, `${name}.exe`), path.join(process.env.PGBIN, name));
  if (process.env.PG_BIN) candidates.push(path.join(process.env.PG_BIN, `${name}.exe`), path.join(process.env.PG_BIN, name));
  if (process.env['ProgramFiles']) {
    const root = path.join(process.env['ProgramFiles'], 'PostgreSQL');
    try {
      for (const v of fs.readdirSync(root)) {
        candidates.push(path.join(root, v, 'bin', `${name}.exe`));
      }
    } catch { /* pas d'installation standard */ }
  }
  candidates.push(name); // espère le PATH
  for (const c of candidates) {
    try { fs.accessSync(c, fs.constants.X_OK); return c; } catch { /* suivant */ }
  }
  return null;
}

/** Exécute un binaire avec arguments et environnement, capture sortie/erreur, timeout. */
function run(binary, args, timeoutMs = 10 * 60 * 1000, env = process.env) {
  return new Promise((resolve) => {
    const child = spawn(binary, args, { windowsHide: true, env });
    let stdout = '';
    let stderr = '';
    let done = false;
    const timer = setTimeout(() => {
      if (!done) { done = true; child.kill(); resolve({ ok: false, stderr: 'timeout' }); }
    }, timeoutMs);
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (err) => {
      if (done) return; done = true; clearTimeout(timer);
      resolve({ ok: false, stderr: err.message });
    });
    child.on('exit', (code) => {
      if (done) return; done = true; clearTimeout(timer);
      resolve({ ok: code === 0, code, stdout, stderr });
    });
  });
}

/** Historique des sauvegardes (persisté dans platform_settings). */
async function loadHistory() {
  try {
    const r = await query(`SELECT value FROM platform_settings WHERE key = 'backup_history' LIMIT 1`);
    const v = r.rows && r.rows[0] && r.rows[0].value;
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

async function saveHistory(entries) {
  const kept = entries.slice(-100);
  await query(
    `INSERT INTO platform_settings (key, value, updated_at)
     VALUES ('backup_history', $1::jsonb, CURRENT_TIMESTAMP)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
    [JSON.stringify(kept)]
  );
}

async function recordHistory(entry) {
  const h = await loadHistory();
  h.push(entry);
  await saveHistory(h).catch(() => { });
}

/**
 * État courant : dernière sauvegarde réussie, dernière vérification de
 * restauration, fichiers présents. Consommé par le centre de sécurité (§4.1)
 * pour remplacer le statut « NON_VÉRIFIÉ » par un état mesuré.
 */
async function backupStatus() {
  const history = await loadHistory();
  const last = history.filter((h) => h.type === 'DUMP').slice(-1)[0] || null;
  const lastRestore = history.filter((h) => h.type === 'RESTORE_CHECK').slice(-1)[0] || null;
  let files = [];
  try {
    files = fs.readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith('.dump'))
      .map((f) => {
        const st = fs.statSync(path.join(BACKUP_DIR, f));
        return { file: f, sizeBytes: st.size, createdAt: st.mtime.toISOString() };
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, 20);
  } catch { /* répertoire absent : aucune sauvegarde locale */ }
  return {
    configured: Boolean(findBinary('pg_dump')),
    backupDir: BACKUP_DIR,
    files,
    lastDump: last,
    lastRestoreCheck: lastRestore,
    history: history.slice(-20).reverse(),
  };
}

/**
 * Lance une sauvegarde + sa vérification de restauration.
 * @param {object} [opts]
 * @param {boolean} [opts.verify=true] — restaure dans une base jetable pour contrôler.
 * @param {string} [opts.actor] — acteur (audit).
 * @returns {Promise<{ok:boolean, file?:string, sizeBytes?:number, verified?:boolean, message:string}>}
 */
async function runBackup({ verify = true, actor = 'scheduler' } = {}) {
  const dumpBin = findBinary('pg_dump');
  if (!dumpBin) {
    const msg = 'pg_dump introuvable : installez PostgreSQL client ou définissez PG_PG_DUMP_PATH.';
    await recordAudit({ action: 'BACKUP_ECHEC', actor, details: msg, objectType: 'BACKUP', result: 'FAILURE', severity: 'WARNING' });
    return { ok: false, message: msg };
  }
  const cfg = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || '5432',
    user: process.env.DB_USER || 'postgres',
    db: process.env.DB_NAME || 'MUTUALIS DAKAR',
    password: process.env.DB_PASSWORD || 'postgres',
  };
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  const file = path.join(BACKUP_DIR, `mutualis-${stamp}.dump`);
  // Le mot de passe par l'environnement (jamais en ligne de commande :
  // visible dans la liste des processus).
  const env = { ...process.env, PGPASSWORD: cfg.password };

  // Compteurs de référence capturés AVANT le dump : c'est le seul instant
  // stable pour la comparaison avec la base restaurée (la base originale
  // continue d'écrire, notamment dans audit_logs, pendant la vérification).
  const expected = await captureCounts(cfg, process.env.DB_PASSWORD || 'postgres');

  const t0 = Date.now();
  const dump = await run(dumpBin, [
    '-h', cfg.host, '-p', String(cfg.port), '-U', cfg.user,
    '-Fc', '-Z', '6',            // format custom, compression niveau 6
    '--no-owner', '--no-privileges',
    '-f', file, cfg.db,
  ], 30 * 60 * 1000, env);
  if (!dump.ok || !fs.existsSync(file) || fs.statSync(file).size === 0) {
    const msg = `pg_dump a échoué : ${(dump.stderr || 'raison inconnue').slice(0, 300)}`;
    await recordAudit({ action: 'BACKUP_ECHEC', actor, details: msg, objectType: 'BACKUP', result: 'FAILURE', severity: 'WARNING' });
    await recordHistory({ type: 'DUMP', ok: false, at: new Date().toISOString(), by: actor, message: msg });
    return { ok: false, message: msg };
  }
  const sizeBytes = fs.statSync(file).size;
  const entry = {
    type: 'DUMP', ok: true, at: new Date().toISOString(), by: actor,
    file: path.basename(file), sizeBytes, durationMs: Date.now() - t0,
  };
  await recordAudit({
    action: 'BACKUP_REUSSI', actor,
    details: `Sauvegarde ${entry.file} (${Math.round(sizeBytes / 1024)} Ko, ${entry.durationMs} ms)${verify ? ' — vérification de restauration en cours' : ''}.`,
    objectType: 'BACKUP', objectRef: entry.file, result: 'SUCCESS',
  });
  await recordHistory(entry);

  if (!verify) return { ok: true, file: entry.file, sizeBytes, message: 'Sauvegarde créée (sans vérification).' };

  const restore = await verifyRestore(file, cfg, actor, expected);
  return { ok: true, file: entry.file, sizeBytes, verified: restore.ok, message: restore.message, tables: restore.tables };
}

/**
 * Vérifie une sauvegarde en la restaurant dans une base JETABLE et en
 * comparant les compteurs clés. La base de contrôle est détruite ensuite.
 */
const CHECK_DB = 'mutualis_restore_check';
const CHECK_TABLES = ['beneficiaries', 'agents', 'audit_logs', 'card_lifecycle_events'];

/** Compte les lignes des tables clés dans la base originale (référence de vérification). */
async function captureCounts(cfg, password) {
  const psqlBin = findBinary('psql');
  if (!psqlBin) return null;
  const env = { ...process.env, PGPASSWORD: password };
  const counts = {};
  for (const table of CHECK_TABLES) {
    const r = await run(psqlBin, [
      '-h', cfg.host, '-p', String(cfg.port), '-U', cfg.user, '-d', cfg.db, '-tAc',
      `SELECT COUNT(*) FROM ${table}`,
    ], 2 * 60 * 1000, env);
    counts[table] = r.ok ? parseInt((r.stdout || '0').trim(), 10) : -1;
  }
  return counts;
}

async function verifyRestore(dumpFile, cfg, actor, expected = null) {
  const restoreBin = findBinary('pg_restore');
  const psqlBin = findBinary('psql');
  if (!restoreBin || !psqlBin) {
    const msg = 'pg_restore/psql introuvables : la vérification est impossible (sauvegarde conservée).';
    await recordHistory({ type: 'RESTORE_CHECK', ok: false, at: new Date().toISOString(), by: actor, message: msg });
    return { ok: false, message: msg };
  }
  const env = { ...process.env, PGPASSWORD: cfg.password };
  const admin = (sql) => run(psqlBin, [
    '-h', cfg.host, '-p', String(cfg.port), '-U', cfg.user, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', sql,
  ], 5 * 60 * 1000, env);

  // Base jetable : recréée à chaque vérification.
  await admin(`DROP DATABASE IF EXISTS "${CHECK_DB}" WITH (FORCE)`);
  const created = await admin(`CREATE DATABASE "${CHECK_DB}" OWNER "${cfg.user}"`);
  if (!created.ok) {
    const msg = `Création de la base de contrôle impossible : ${(created.stderr || '').slice(0, 200)}`;
    await recordHistory({ type: 'RESTORE_CHECK', ok: false, at: new Date().toISOString(), by: actor, message: msg });
    return { ok: false, message: msg };
  }
  const restored = await run(restoreBin, [
    '-h', cfg.host, '-p', String(cfg.port), '-U', cfg.user, '-d', CHECK_DB,
    '--no-owner', '--no-privileges', dumpFile,
  ], 30 * 60 * 1000, env);
  if (!restored.ok) {
    await admin(`DROP DATABASE IF EXISTS "${CHECK_DB}" WITH (FORCE)`);
    const msg = `pg_restore a échoué : ${(restored.stderr || 'raison inconnue').slice(0, 300)}`;
    await recordAudit({ action: 'BACKUP_VERIF_ECHEC', actor, details: msg, objectType: 'BACKUP', result: 'FAILURE', severity: 'CRITICAL' });
    await recordHistory({ type: 'RESTORE_CHECK', ok: false, at: new Date().toISOString(), by: actor, message: msg });
    return { ok: false, message: msg };
  }

  // Comparaison des compteurs clés référence ↔ copie restaurée.
  // Sans référence fournie (appel autonome), on capture l'état original
  // AVANT la restauration — c'est déjà un instant postérieur au dump, la
  // comparaison tient donc compte de la seule croissance monotone.
  const reference = expected || await captureCounts(cfg, cfg.password);
  const counts = {};
  let mismatch = null;
  for (const table of CHECK_TABLES) {
    const one = async (db) => {
      const r = await run(psqlBin, [
        '-h', cfg.host, '-p', String(cfg.port), '-U', cfg.user, '-d', db, '-tAc',
        `SELECT COUNT(*) FROM ${table}`,
      ], 2 * 60 * 1000, env);
      return r.ok ? parseInt((r.stdout || '0').trim(), 10) : -1;
    };
    const a = reference && typeof reference[table] === 'number' ? reference[table] : await one(cfg.db);
    const b = await one(CHECK_DB);
    counts[table] = { reference: a, restored: b };
    // audit_logs croît en continu (chaque contrôle écrit lui-même son audit) :
    // la base restaurée doit être un sous-ensemble cohérent (restauré <= référence).
    const ok = table === 'audit_logs' ? (b >= 0 && b <= a) : (a === b);
    if (!ok && mismatch === null) mismatch = table;
  }
  // La base de contrôle est TOUJOURS détruite, même en cas d'écart.
  await admin(`DROP DATABASE IF EXISTS "${CHECK_DB}" WITH (FORCE)`);

  const ok = mismatch === null;
  const message = ok
    ? `Restauration vérifiée : compteurs identiques (${CHECK_TABLES.join(', ')}).`
    : `ÉCART détecté sur « ${mismatch} » : ${JSON.stringify(counts[mismatch])}`;
  await recordAudit({
    action: ok ? 'BACKUP_VERIFIE' : 'BACKUP_ECART',
    actor, details: message, objectType: 'BACKUP',
    result: ok ? 'SUCCESS' : 'FAILURE', severity: ok ? 'INFO' : 'CRITICAL',
  });
  await recordHistory({ type: 'RESTORE_CHECK', ok, at: new Date().toISOString(), by: actor, message, counts });
  return { ok, message, tables: counts };
}

/**
 * Supprime les sauvegardes au-delà de la rétention (BACKUP_RETENTION_DAYS,
 * défaut 30). Journalisé, jamais silencieux.
 */
async function pruneBackups(actor = 'scheduler') {
  const days = parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10) || 30;
  const cutoff = Date.now() - days * 86400000;
  let removed = 0;
  try {
    for (const f of fs.readdirSync(BACKUP_DIR)) {
      if (!f.endsWith('.dump')) continue;
      const p = path.join(BACKUP_DIR, f);
      if (fs.statSync(p).mtimeMs < cutoff) { fs.unlinkSync(p); removed += 1; }
    }
  } catch { /* répertoire absent */ }
  if (removed > 0) {
    await recordAudit({
      action: 'BACKUP_NETTOYAGE', actor,
      details: `${removed} sauvegarde(s) supprimée(s) (rétention ${days} jours).`,
      objectType: 'BACKUP', result: 'SUCCESS',
    });
  }
  return { removed, retentionDays: days };
}

module.exports = { runBackup, verifyRestore, backupStatus, pruneBackups, loadHistory, BACKUP_DIR };
