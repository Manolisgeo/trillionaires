import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { Candidate, Id, Interview, Role } from "./types";

export const DATA_DIR = path.resolve(process.cwd(), "../data");
const DB_PATH = path.join(DATA_DIR, "db.json");

interface DB { roles: Role[]; candidates: Candidate[]; interviews: Interview[] }
type Table = keyof DB;
type AppendKey = "transcript" | "events" | "evidence" | "integrity";

export function newId(): Id {
  return randomBytes(9).toString("base64url"); // 12 chars
}

// In-process async mutex: serializes every read-modify-write.
let chain: Promise<unknown> = Promise.resolve();
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(() => undefined, () => undefined);
  return run;
}

async function ensureDirs(): Promise<void> {
  for (const d of ["", "uploads", "recordings", "boards"]) {
    await fs.mkdir(path.join(DATA_DIR, d), { recursive: true });
  }
}

async function load(): Promise<DB> {
  await ensureDirs();
  try {
    const raw = await fs.readFile(DB_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<DB>;
    return { roles: parsed.roles ?? [], candidates: parsed.candidates ?? [], interviews: parsed.interviews ?? [] };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return { roles: [], candidates: [], interviews: [] };
    throw e;
  }
}

async function save(db: DB): Promise<void> {
  const tmp = `${DB_PATH}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
  await fs.rename(tmp, DB_PATH);
}

type Row = { id: Id };

function makeTable<T extends Row>(table: Table, withCreatedAt = true) {
  const rows = (db: DB) => db[table] as unknown as T[];
  return {
    list: (): Promise<T[]> => locked(async () => rows(await load())),
    get: (id: Id): Promise<T | null> =>
      locked(async () => rows(await load()).find((r) => r.id === id) ?? null),
    create: (input: Omit<T, "id" | "createdAt">): Promise<T> =>
      locked(async () => {
        const db = await load();
        const row = { ...input, id: newId(), ...(withCreatedAt ? { createdAt: new Date().toISOString() } : {}) } as unknown as T;
        rows(db).push(row);
        await save(db);
        return row;
      }),
    update: (id: Id, patch: Partial<T>): Promise<T> =>
      locked(async () => {
        const db = await load();
        const list = rows(db);
        const i = list.findIndex((r) => r.id === id);
        if (i < 0) throw new Error(`${table}/${id} not found`);
        list[i] = { ...list[i], ...patch, id } as T;
        await save(db);
        return list[i];
      }),
  };
}

export const store = {
  roles: makeTable<Role>("roles"),
  candidates: makeTable<Candidate>("candidates"),
  interviews: {
    ...makeTable<Interview>("interviews"),
    append: (id: Id, key: AppendKey, items: unknown[]): Promise<void> =>
      locked(async () => {
        const db = await load();
        const iv = db.interviews.find((r) => r.id === id);
        if (!iv) throw new Error(`interviews/${id} not found`);
        (iv[key] as unknown[]).push(...items);
        await save(db);
      }),
  },
};
