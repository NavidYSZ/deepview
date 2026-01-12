import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

type RawProjectRow = {
  id: number;
  domain: string;
  nodes: string;
  edges: string;
  createdAt: string;
};

export type ProjectData = {
  domain: string;
  nodes: unknown;
  edges: unknown;
  createdAt: string;
};

const dbFile = path.join(process.cwd(), "data.sqlite");

// Ensure the database file exists so Coolify can mount it as a volume if desired.
if (!fs.existsSync(dbFile)) {
  fs.writeFileSync(dbFile, "");
}

const db = new Database(dbFile);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL,
    nodes TEXT NOT NULL,
    edges TEXT NOT NULL,
    createdAt TEXT NOT NULL
  )
`);

export function saveProject(domain: string, nodes: unknown, edges: unknown) {
  const stmt = db.prepare(
    "INSERT INTO projects (domain, nodes, edges, createdAt) VALUES (?, ?, ?, ?)"
  );

  stmt.run(domain, JSON.stringify(nodes), JSON.stringify(edges), new Date().toISOString());
}

export function getLatestProject(): ProjectData | null {
  const row = db
    .prepare<[], RawProjectRow>("SELECT * FROM projects ORDER BY createdAt DESC LIMIT 1")
    .get();

  if (!row) return null;

  return {
    domain: row.domain,
    nodes: safeParse(row.nodes),
    edges: safeParse(row.edges),
    createdAt: row.createdAt,
  };
}

function safeParse(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
