// Helper IndexedDB pour le mode hors-ligne de MUTUALIS DAKAR.
// Stocke les données critiques (carte CMU, mutuelles, bénéficiaires) et
// met en file d'attente les actions effectuées hors-ligne pour sync ultérieure.

const DB_NAME = 'mutualis-dakar-offline';
const DB_VERSION = 1;
const STORES = {
  cache: 'cache',       // données mises en cache (mutuelles, locations, carte CMU)
  outbox: 'outbox'      // actions en attente de synchronisation
};

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORES.cache)) {
        db.createObjectStore(STORES.cache, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORES.outbox)) {
        const outbox = db.createObjectStore(STORES.outbox, { keyPath: 'id', autoIncrement: true });
        outbox.createIndex('status', 'status', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

// --- Cache (lecture/écriture de données mises en cache) ---

export async function cacheSet(key, data) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.cache, 'readwrite');
      tx.objectStore(STORES.cache).put({ key, data, cachedAt: Date.now() });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch { return false; }
}

export async function cacheGet(key) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.cache, 'readonly');
      const req = tx.objectStore(STORES.cache).get(key);
      req.onsuccess = () => resolve(req.result ? req.result.data : null);
      req.onerror = () => reject(req.error);
    });
  } catch { return null; }
}

// --- Outbox (file d'attente des actions hors-ligne) ---

export async function outboxAdd(action, payload) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.outbox, 'readwrite');
      const req = tx.objectStore(STORES.outbox).add({
        action,
        payload,
        status: 'pending',
        createdAt: Date.now()
      });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB outboxAdd échoué :', err);
    return null;
  }
}

export async function outboxGetAll() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.outbox, 'readonly');
      const req = tx.objectStore(STORES.outbox).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch { return []; }
}

export async function outboxDelete(id) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.outbox, 'readwrite');
      tx.objectStore(STORES.outbox).delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch { return false; }
}

// --- Synchronisation : envoie les actions en attente vers le backend ---

export async function syncOutbox() {
  const items = await outboxGetAll();
  if (items.length === 0) return { synced: 0, failed: 0 };

  const token = localStorage.getItem('cmu-token') || '';
  let synced = 0;
  let failed = 0;

  for (const item of items) {
    try {
      const res = await fetch('http://localhost:5000/api/sync/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          deviceId: getDeviceId(),
          action: item.action,
          payload: item.payload
        })
      });
      if (res.ok) {
        await outboxDelete(item.id);
        synced++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }
  return { synced, failed };
}

// Identifiant de device (généré une fois, stocké en localStorage)
function getDeviceId() {
  let id = localStorage.getItem('cmu-device-id');
  if (!id) {
    id = 'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('cmu-device-id', id);
  }
  return id;
}

// Nombre d'actions en attente (pour badge dans l'UI)
export async function outboxCount() {
  const items = await outboxGetAll();
  return items.filter((i) => i.status === 'pending').length;
}
