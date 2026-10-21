import "server-only";
import { chmodSync, closeSync, mkdirSync, openSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

let database: DatabaseSync | undefined;

export function getDatabase(): DatabaseSync {
  if (database) return database;
  // shortcut: SQLite needs a durable local volume, use a shared database before deploying across hosts.
  const path = resolve(/* turbopackIgnore: true */ process.env.DEVRELAY_DB_PATH || ".data/devrelay.sqlite");
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  closeSync(openSync(/* turbopackIgnore: true */ path, "a", 0o600));
  chmodSync(path, 0o600);
  const db = new DatabaseSync(path);
  try {
    db.exec("PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;");
    const version = db.prepare("PRAGMA user_version").get()?.user_version;
    if (typeof version !== "number" || version > 1) throw new Error("Unsupported DevRelay database version.");
    db.exec(`
      CREATE TABLE IF NOT EXISTS incidents (
        owner_id TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL,
        PRIMARY KEY (owner_id, id)
      );
      CREATE TABLE IF NOT EXISTS investigations (
        sequence INTEGER PRIMARY KEY, id TEXT NOT NULL UNIQUE,
        owner_id TEXT NOT NULL, incident_id TEXT NOT NULL,
        created_at TEXT NOT NULL, snapshot TEXT NOT NULL,
        FOREIGN KEY (owner_id, incident_id) REFERENCES incidents(owner_id, id)
      );
      CREATE INDEX IF NOT EXISTS investigations_by_incident ON investigations(owner_id, incident_id, sequence DESC);
      PRAGMA user_version = 1;
    `);
    database = db;
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

export function transaction<T>(work: (db: DatabaseSync) => T): T {
  const db = getDatabase();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = work(db);
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
