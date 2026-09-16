import { initializeApp as initClientApp, getApps as getClientApps, FirebaseApp as ClientApp } from 'firebase/app';
import {
  getFirestore as getClientFirestore,
  doc as clientDoc,
  collection as clientCollection,
  getDoc as clientGetDoc,
  getDocs as clientGetDocs,
  setDoc as clientSetDoc,
  deleteDoc as clientDeleteDoc,
  writeBatch as clientWriteBatch,
  runTransaction as clientRunTransaction,
  query as clientQuery,
  where as clientWhere,
  limit as clientLimit,
  Firestore as ClientFirestore,
  DocumentReference,
  CollectionReference,
  Query,
} from 'firebase/firestore';
import { initializeApp as initAdminApp, getApps as getAdminApps, App as AdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuthSdk } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

let adminAppInstance: AdminApp | null = null;
let adminAuthInstance: ReturnType<typeof getAdminAuthSdk> | null = null;
let clientAppInstance: ClientApp | null = null;
let clientDbInstance: ClientFirestore | null = null;
let activeDatabaseId = 'ai-studio-0e40d00e-d249-4cfb-9b34-c114c9ca9db6';
let activeProjectId = 'inner-volt-dxfhk';
let activeApiKey = 'AIzaSyBayelHKX_mQAt9DSheBVRymEqXbF1bROI';

function loadAppletConfig() {
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(raw);
      if (config.projectId) activeProjectId = config.projectId;
      if (config.apiKey) activeApiKey = config.apiKey;
      if (config.firestoreDatabaseId) activeDatabaseId = config.firestoreDatabaseId;
    }
  } catch (e) {
    console.warn('[Firebase] Could not read firebase-applet-config.json:', e);
  }
}

loadAppletConfig();

function getClientDb(): ClientFirestore {
  if (!clientDbInstance) {
    if (!getClientApps().length) {
      clientAppInstance = initClientApp({
        projectId: activeProjectId,
        apiKey: activeApiKey,
        authDomain: `${activeProjectId}.firebaseapp.com`,
      });
    } else {
      clientAppInstance = getClientApps()[0];
    }
    clientDbInstance = getClientFirestore(clientAppInstance, activeDatabaseId);
    console.log(`[Firestore Provider] Initialized database: ${activeDatabaseId} (project: ${activeProjectId})`);
  }
  return clientDbInstance;
}

class DocSnapshotAdapter {
  id: string;
  ref: any;
  private _snap: any;

  constructor(snap: any, ref: any) {
    this._snap = snap;
    this.id = snap.id;
    this.ref = ref;
  }

  get exists(): boolean {
    return typeof this._snap.exists === 'function' ? this._snap.exists() : Boolean(this._snap.exists);
  }

  data(): any {
    return typeof this._snap.data === 'function' ? this._snap.data() : this._snap.data;
  }
}

function stripUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(stripUndefined) as unknown as T;
  }
  if (typeof obj === 'object') {
    if (obj instanceof Date || (obj as any).constructor?.name !== 'Object') {
      return obj;
    }
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        result[key] = stripUndefined(value);
      }
    }
    return result;
  }
  return obj;
}

function createDocAdapter(rawDocRef: DocumentReference) {
  const docAdapter: any = {
    id: rawDocRef.id,
    path: rawDocRef.path,
    rawRef: rawDocRef,
    collection: (subName: string) => createCollectionAdapter(clientCollection(rawDocRef, subName)),
    get: async () => {
      const snap = await clientGetDoc(rawDocRef);
      return new DocSnapshotAdapter(snap, docAdapter);
    },
    set: async (data: any, options?: { merge?: boolean }) => {
      const cleanData = stripUndefined(data);
      return await clientSetDoc(rawDocRef, cleanData, options || {});
    },
    delete: async () => {
      return await clientDeleteDoc(rawDocRef);
    },
  };
  return docAdapter;
}

class QuerySnapshotAdapter {
  docs: DocSnapshotAdapter[];
  empty: boolean;
  size: number;

  constructor(snap: any) {
    this.docs = snap.docs.map((d: any) => new DocSnapshotAdapter(d, createDocAdapter(d.ref)));
    this.empty = Boolean(snap.empty);
    this.size = typeof snap.size === 'number' ? snap.size : this.docs.length;
  }

  forEach(callback: (doc: DocSnapshotAdapter) => void): void {
    this.docs.forEach(callback);
  }

  [Symbol.iterator]() {
    return this.docs[Symbol.iterator]();
  }

  docChanges() {
    return [];
  }
}

function createQueryAdapter(q: Query) {
  const queryAdapter: any = {
    rawQuery: q,
    where: (field: string, op: any, val: any) =>
      createQueryAdapter(clientQuery(q, clientWhere(field, op === '==' ? '==' : op, val))),
    limit: (n: number) => createQueryAdapter(clientQuery(q, clientLimit(n))),
    get: async () => {
      const snap = await clientGetDocs(q);
      return new QuerySnapshotAdapter(snap);
    },
  };
  return queryAdapter;
}

function createCollectionAdapter(rawColRef: CollectionReference) {
  const colAdapter: any = {
    id: rawColRef.id,
    path: rawColRef.path,
    rawCol: rawColRef,
    doc: (id?: string) => createDocAdapter(id ? clientDoc(rawColRef, id) : clientDoc(rawColRef)),
    where: (field: string, op: any, val: any) =>
      createQueryAdapter(clientQuery(rawColRef, clientWhere(field, op === '==' ? '==' : op, val))),
    limit: (n: number) => createQueryAdapter(clientQuery(rawColRef, clientLimit(n))),
    get: async () => {
      const snap = await clientGetDocs(rawColRef);
      return new QuerySnapshotAdapter(snap);
    },
  };
  return colAdapter;
}

export function createFirestoreBridge(db: ClientFirestore) {
  return {
    collection: (name: string) => createCollectionAdapter(clientCollection(db, name)),
    batch: () => {
      const b = clientWriteBatch(db);
      return {
        set: (docRef: any, data: any, opts?: any) => {
          const cleanData = stripUndefined(data);
          return b.set(docRef.rawRef || docRef, cleanData, opts || {});
        },
        delete: (docRef: any) => b.delete(docRef.rawRef || docRef),
        commit: () => b.commit(),
      };
    },
    runTransaction: async (updateFunction: (transaction: any) => Promise<any>) => {
      return await clientRunTransaction(db, async (tx) => {
        const txAdapter = {
          get: async (docRef: any) => {
            const rawRef = docRef.rawRef || docRef;
            const snap = await tx.get(rawRef);
            return new DocSnapshotAdapter(snap, docRef);
          },
          set: (docRef: any, data: any, opts?: any) => {
            const rawRef = docRef.rawRef || docRef;
            const cleanData = stripUndefined(data);
            tx.set(rawRef, cleanData, opts || {});
            return txAdapter;
          },
          update: (docRef: any, data: any) => {
            const rawRef = docRef.rawRef || docRef;
            const cleanData = stripUndefined(data);
            tx.update(rawRef, cleanData);
            return txAdapter;
          },
          delete: (docRef: any) => {
            const rawRef = docRef.rawRef || docRef;
            tx.delete(rawRef);
            return txAdapter;
          },
        };
        return await updateFunction(txAdapter);
      });
    },
  };
}

export function getAdminDb(): any {
  const cDb = getClientDb();
  return createFirestoreBridge(cDb);
}

export function getAdminAuth(): ReturnType<typeof getAdminAuthSdk> {
  if (!adminAuthInstance) {
    try {
      if (!getAdminApps().length) {
        adminAppInstance = initAdminApp({
          projectId: activeProjectId,
        });
      } else {
        adminAppInstance = getAdminApps()[0] as AdminApp;
      }
      adminAuthInstance = getAdminAuthSdk(adminAppInstance);
    } catch (err) {
      console.warn('[Admin Auth] Auth initialized in fallback mode');
    }
  }
  return adminAuthInstance || ({} as any);
}

export const adminAuth = new Proxy({} as ReturnType<typeof getAdminAuthSdk>, {
  get(_target, prop) {
    const auth = getAdminAuth();
    return (auth as any)?.[prop];
  },
});

export const adminDb = new Proxy({} as any, {
  get(_target, prop) {
    const db = getAdminDb();
    return (db as any)[prop];
  },
});

export function getFirestoreDatabaseId(): string {
  return activeDatabaseId;
}

export const FIRESTORE_DATABASE_ID = {
  toString() {
    return getFirestoreDatabaseId();
  },
  valueOf() {
    return getFirestoreDatabaseId();
  },
  [Symbol.toPrimitive]() {
    return getFirestoreDatabaseId();
  },
} as unknown as string;
