import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import postgres from 'postgres';
import { get as blobGet, put as blobPut } from '@vercel/blob';
import { createDemoWorkspaceState } from '../shared/seedData';
import type { WorkspaceState } from '../shared/types';

export interface StorageInfo {
  driver: 'postgres' | 'vercel_blob' | 'file' | 'memory';
  persistent: boolean;
  note: string;
}

export interface WorkspaceStore {
  getState(): Promise<WorkspaceState>;
  saveState(state: WorkspaceState): Promise<WorkspaceState>;
  getStorageInfo(): StorageInfo;
}

export class MemoryWorkspaceStore implements WorkspaceStore {
  private state: WorkspaceState;

  constructor(initialState?: WorkspaceState) {
    this.state = initialState ?? createDemoWorkspaceState();
  }

  async getState(): Promise<WorkspaceState> {
    return structuredClone(this.state);
  }

  async saveState(state: WorkspaceState): Promise<WorkspaceState> {
    this.state = structuredClone(state);
    return structuredClone(this.state);
  }

  getStorageInfo(): StorageInfo {
    return {
      driver: 'memory',
      persistent: false,
      note: 'In-memory workspace store',
    };
  }
}

export class JsonFileWorkspaceStore implements WorkspaceStore {
  private readonly filePath: string;
  private cache: WorkspaceState | null = null;

  constructor(filePath = path.join(process.cwd(), '.data', 'workspace.json')) {
    this.filePath = filePath;
  }

  async getState(): Promise<WorkspaceState> {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        this.cache = JSON.parse(raw) as WorkspaceState;
        return structuredClone(this.cache);
      }
    } catch {
      // Fallback to in-memory cache or seeded demo state
    }

    if (this.cache) return structuredClone(this.cache);

    const demo = createDemoWorkspaceState();
    await this.saveState(demo);
    return demo;
  }

  async saveState(state: WorkspaceState): Promise<WorkspaceState> {
    this.cache = structuredClone(state);
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.cache, null, 2), 'utf8');
    } catch {
      // Retain in-memory cache if filesystem is read-only
    }
    return structuredClone(this.cache);
  }

  getStorageInfo(): StorageInfo {
    return {
      driver: 'file',
      persistent: true,
      note: `Local JSON file (${this.filePath})`,
    };
  }
}

export class PostgresWorkspaceStore implements WorkspaceStore {
  private readonly sql: ReturnType<typeof postgres>;
  private readonly workspaceId: string;
  private readyPromise: Promise<void> | null = null;
  private fallbackCache: WorkspaceState = createDemoWorkspaceState();
  private healthy = true;

  constructor(databaseUrl: string, workspaceId = 'default') {
    this.workspaceId = workspaceId;
    this.sql = postgres(databaseUrl, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 5,
      ssl: databaseUrl.includes('railway.internal') || databaseUrl.includes('localhost')
        ? false
        : 'prefer',
    });
  }

  private ensureReady(): Promise<void> {
    if (!this.readyPromise) {
      this.readyPromise = (async () => {
        await this.sql`
          CREATE TABLE IF NOT EXISTS subledger_workspaces (
            id TEXT PRIMARY KEY,
            state JSONB NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;
      })();
    }
    return this.readyPromise;
  }

  async getState(): Promise<WorkspaceState> {
    try {
      await this.ensureReady();
      const rows = await this.sql<{ state: WorkspaceState }[]>`
        SELECT state FROM subledger_workspaces WHERE id = ${this.workspaceId} LIMIT 1
      `;
      this.healthy = true;
      if (rows.length > 0 && rows[0]?.state) {
        const parsed =
          typeof rows[0].state === 'string'
            ? (JSON.parse(rows[0].state) as WorkspaceState)
            : rows[0].state;
        this.fallbackCache = parsed;
        return structuredClone(parsed);
      }

      const initial = createDemoWorkspaceState();
      await this.saveState(initial);
      return initial;
    } catch (err) {
      this.healthy = false;
      this.readyPromise = null;
      console.error('[SubLedger][PostgresStore] getState fallback:', err);
      return structuredClone(this.fallbackCache);
    }
  }

  async saveState(state: WorkspaceState): Promise<WorkspaceState> {
    this.fallbackCache = structuredClone(state);
    try {
      await this.ensureReady();
      const payload = JSON.stringify(state);
      await this.sql`
        INSERT INTO subledger_workspaces (id, state, updated_at)
        VALUES (${this.workspaceId}, ${payload}::jsonb, NOW())
        ON CONFLICT (id)
        DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()
      `;
      this.healthy = true;
    } catch (err) {
      this.healthy = false;
      this.readyPromise = null;
      console.error('[SubLedger][PostgresStore] saveState fallback:', err);
    }
    return structuredClone(this.fallbackCache);
  }

  getStorageInfo(): StorageInfo {
    return {
      driver: this.healthy ? 'postgres' : 'memory',
      persistent: this.healthy,
      note: this.healthy
        ? 'PostgreSQL durable workspace store'
        : 'PostgreSQL temporarily unavailable — serving memory fallback',
    };
  }
}

export class VercelBlobWorkspaceStore implements WorkspaceStore {
  private readonly blobPath: string;
  private readonly fallback: JsonFileWorkspaceStore;
  private healthy = true;

  constructor(blobPath = 'subledger/workspace.json') {
    this.blobPath = blobPath;
    this.fallback = new JsonFileWorkspaceStore(path.join(os.tmpdir(), 'subledger-workspace.json'));
  }

  async getState(): Promise<WorkspaceState> {
    try {
      const result = await blobGet(this.blobPath, { access: 'private', useCache: false });
      if (result && result.statusCode === 200 && result.stream) {
        const text = await new Response(result.stream).text();
        const parsed = JSON.parse(text) as WorkspaceState;
        await this.fallback.saveState(parsed);
        this.healthy = true;
        return parsed;
      }

      const demo = createDemoWorkspaceState();
      await this.saveState(demo);
      return demo;
    } catch (err) {
      this.healthy = false;
      console.error('[SubLedger][VercelBlobStore] getState fallback:', err);
      return this.fallback.getState();
    }
  }

  async saveState(state: WorkspaceState): Promise<WorkspaceState> {
    const saved = await this.fallback.saveState(state);
    try {
      await blobPut(this.blobPath, JSON.stringify(saved, null, 2), {
        access: 'private',
        allowOverwrite: true,
        addRandomSuffix: false,
        contentType: 'application/json',
      });
      this.healthy = true;
    } catch (err) {
      this.healthy = false;
      console.error('[SubLedger][VercelBlobStore] saveState fallback:', err);
    }
    return saved;
  }

  getStorageInfo(): StorageInfo {
    return {
      driver: this.healthy ? 'vercel_blob' : 'file',
      persistent: this.healthy,
      note: this.healthy
        ? 'Vercel Blob private durable store'
        : 'Vercel Blob temporarily unavailable — serving tmp fallback',
    };
  }
}

export function createDefaultStore(): WorkspaceStore {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl && databaseUrl.trim().length > 0) {
    return new PostgresWorkspaceStore(databaseUrl.trim());
  }
  return new JsonFileWorkspaceStore();
}

export function createServerlessStore(): WorkspaceStore {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl && databaseUrl.trim().length > 0) {
    return new PostgresWorkspaceStore(databaseUrl.trim());
  }
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim() || process.env.BLOB_STORE_ID?.trim()) {
    return new VercelBlobWorkspaceStore();
  }
  return new JsonFileWorkspaceStore(path.join(os.tmpdir(), 'subledger-workspace.json'));
}
