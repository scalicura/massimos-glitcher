import { STUDIO_SCHEMA_VERSION, validateProjectRecord } from './model.js';

const DATABASE_NAME = 'massimos-glitcher-studio';
const DATABASE_VERSION = 1;
const STORE_NAME = 'projects';

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('This browser does not support local project storage.')); return; }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.addEventListener('upgradeneeded', () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('modifiedAt', 'modifiedAt');
        store.createIndex('type', 'type');
      }
    });
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener('error', () => reject(new Error('Local project storage could not be opened.')), { once: true });
  });
}

async function transaction(mode, action) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      let result;
      try { result = action(store); } catch (error) { reject(error); return; }
      tx.addEventListener('complete', () => resolve(result?.result), { once: true });
      tx.addEventListener('abort', () => reject(new Error(tx.error?.name === 'QuotaExceededError' ? 'Browser storage quota exceeded. Delete unused projects or reduce image sizes.' : 'The local project transaction was cancelled.')), { once: true });
      tx.addEventListener('error', () => reject(new Error(tx.error?.name === 'QuotaExceededError' ? 'Browser storage quota exceeded. Delete unused projects or reduce image sizes.' : 'The local project transaction failed.')), { once: true });
    });
  } finally { database.close(); }
}

export function createProjectId() {
  return crypto.randomUUID?.() || `project-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function saveProject(record) {
  const validated = validateProjectRecord({ ...record, schemaVersion: STUDIO_SCHEMA_VERSION });
  await transaction('readwrite', (store) => store.put(validated));
  return validated;
}

export async function listProjects() {
  const records = await transaction('readonly', (store) => store.getAll());
  return (records || []).map((record) => {
    try { return validateProjectRecord(record); } catch { return null; }
  }).filter(Boolean).sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt));
}

export async function loadProject(id) {
  const record = await transaction('readonly', (store) => store.get(id));
  if (!record) throw new Error('That local project no longer exists.');
  return validateProjectRecord(record);
}

export async function deleteProject(id) {
  await transaction('readwrite', (store) => store.delete(id));
}

export async function duplicateProject(id, nextId) {
  const original = await loadProject(id);
  const now = new Date().toISOString();
  return saveProject({ ...original, id: nextId, name: `${original.name} copy`, createdAt: now, modifiedAt: now });
}

