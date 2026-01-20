import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import type { Edge, Node } from "reactflow";

type FlowNode = Node<{
  label: string;
  path?: string;
  isRoot?: boolean;
  statusCode?: number;
  unreachable?: boolean;
  metaTitle?: string;
  metaDescription?: string;
  h1?: string;
}>;
type FlowEdge = Edge;

export type Project = {
  id: number;
  name: string;
  slug: string;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type Domain = {
  id: number;
  projectId: number;
  hostname: string;
  isPrimary: boolean;
  createdAt: string;
};

export type ProjectFeature = {
  projectId: number;
  feature: string;
  enabled: boolean;
  config: Record<string, unknown>;
};

export type Snapshot = {
  id: number;
  projectId: number;
  domainId: number | null;
  source: string;
  schemaVersion: number;
  meta: Record<string, unknown>;
  createdAt: string;
};

export type SnapshotWithPayload = {
  snapshot: Snapshot;
  nodes: FlowNode[];
  edges: FlowEdge[];
  domain: string;
};

export type KeywordImport = {
  id: number;
  projectId: number;
  domainId: number | null;
  source: string;
  fileName: string | null;
  meta: Record<string, unknown>;
  createdAt: string;
};

export type Keyword = {
  id: number;
  projectId: number;
  importId: number;
  domainId: number;
  term: string;
  url: string | null;
  path: string;
  volume: number | null;
  difficulty: number | null;
  position: number | null;
  meta: Record<string, unknown>;
  createdAt: string;
};

export type NodeSuggestion = {
  id: number;
  projectId: number;
  domainId: number | null;
  path: string;
  field: "metaTitle" | "metaDescription" | "h1";
  value: string;
  createdAt: string;
};

export type GhostPage = {
  id: number;
  projectId: number;
  domainId: number | null;
  path: string;
  label: string;
  x: number;
  y: number;
  meta: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

const dbFile = path.join(process.cwd(), "data.sqlite");

if (!fs.existsSync(dbFile)) {
  fs.writeFileSync(dbFile, "");
}

const db = new Database(dbFile);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const tableExists = (name: string) => {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name);
  return Boolean(row);
};

const isLegacyProjectsTable = () => {
  if (!tableExists("projects")) return false;
  const columns = db.prepare("PRAGMA table_info(projects)").all() as Array<{ name: string }>;
  const names = columns.map((c) => c.name);
  return names.includes("domain") && names.includes("nodes") && !names.includes("slug");
};

if (isLegacyProjectsTable()) {
  const legacyAlready = tableExists("projects_legacy");
  if (!legacyAlready) {
    try {
      db.exec("ALTER TABLE projects RENAME TO projects_legacy");
    } catch {
      // ignore if rename not possible (e.g., table exists)
    }
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    settings TEXT NOT NULL DEFAULT '{}',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS domains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projectId INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    hostname TEXT NOT NULL,
    isPrimary INTEGER DEFAULT 0,
    createdAt TEXT NOT NULL,
    UNIQUE(projectId, hostname)
  );
  CREATE TABLE IF NOT EXISTS project_features (
    projectId INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    feature TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    config TEXT NOT NULL DEFAULT '{}',
    PRIMARY KEY (projectId, feature)
  );
  CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projectId INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    domainId INTEGER REFERENCES domains(id),
    source TEXT NOT NULL,
    schemaVersion INTEGER NOT NULL DEFAULT 1,
    meta TEXT NOT NULL DEFAULT '{}',
    createdAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS snapshot_blobs (
    snapshotId INTEGER PRIMARY KEY REFERENCES snapshots(id) ON DELETE CASCADE,
    payload TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projectId INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    domainId INTEGER REFERENCES domains(id),
    path TEXT NOT NULL,
    latestSnapshotId INTEGER REFERENCES snapshots(id),
    title TEXT,
    depth INTEGER,
    statusCode INTEGER,
    unreachable INTEGER DEFAULT 0,
    meta TEXT NOT NULL DEFAULT '{}',
    UNIQUE(projectId, domainId, path)
  );
  CREATE TABLE IF NOT EXISTS metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projectId INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    domainId INTEGER REFERENCES domains(id),
    snapshotId INTEGER REFERENCES snapshots(id),
    targetType TEXT NOT NULL,
    targetRef TEXT NOT NULL,
    metricType TEXT NOT NULL,
    value REAL NOT NULL,
    unit TEXT,
    period TEXT,
    meta TEXT NOT NULL DEFAULT '{}',
    createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_metrics_target ON metrics(projectId, targetType, targetRef);
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projectId INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    domainId INTEGER REFERENCES domains(id),
    snapshotId INTEGER REFERENCES snapshots(id),
    targetType TEXT NOT NULL,
    targetRef TEXT NOT NULL,
    eventType TEXT NOT NULL,
    payload TEXT NOT NULL DEFAULT '{}',
    createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_events_target ON events(projectId, targetType, targetRef);
  CREATE TABLE IF NOT EXISTS keyword_imports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projectId INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    domainId INTEGER REFERENCES domains(id),
    source TEXT NOT NULL,
    fileName TEXT,
    meta TEXT NOT NULL DEFAULT '{}',
    createdAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projectId INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    importId INTEGER NOT NULL REFERENCES keyword_imports(id) ON DELETE CASCADE,
    domainId INTEGER NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
    term TEXT NOT NULL,
    url TEXT,
    path TEXT NOT NULL,
    volume INTEGER,
    difficulty REAL,
    position INTEGER,
    meta TEXT NOT NULL DEFAULT '{}',
    createdAt TEXT NOT NULL,
    UNIQUE(projectId, domainId, term, path)
  );
  CREATE INDEX IF NOT EXISTS idx_keywords_project ON keywords(projectId);
  CREATE INDEX IF NOT EXISTS idx_keywords_path ON keywords(projectId, path);
  CREATE TABLE IF NOT EXISTS node_suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projectId INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    domainId INTEGER REFERENCES domains(id),
    path TEXT NOT NULL,
    field TEXT NOT NULL,
    value TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_node_suggestions_project ON node_suggestions(projectId);
  CREATE INDEX IF NOT EXISTS idx_node_suggestions_path ON node_suggestions(projectId, path);
  CREATE TABLE IF NOT EXISTS ghost_pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projectId INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    domainId INTEGER REFERENCES domains(id),
    path TEXT NOT NULL,
    label TEXT NOT NULL,
    x REAL NOT NULL DEFAULT 0,
    y REAL NOT NULL DEFAULT 0,
    meta TEXT NOT NULL DEFAULT '{}',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_ghost_pages_project ON ghost_pages(projectId);
  CREATE INDEX IF NOT EXISTS idx_ghost_pages_path ON ghost_pages(projectId, path);
`);

type LegacyProjectRow = {
  id: number;
  domain: string;
  nodes: string;
  edges: string;
  createdAt: string;
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "projekt";

const safeParse = (value: string) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const now = () => new Date().toISOString();

function migrateLegacyProjectsIfNeeded() {
  const countRow = db.prepare("SELECT COUNT(*) as count FROM projects").get() as
    | { count?: number }
    | undefined;
  const newProjectsCount = countRow?.count ? Number(countRow.count) : 0;
  const legacyExists = tableExists("projects_legacy");

  if (newProjectsCount > 0 || !legacyExists) return;

  const legacyRows = db
    .prepare("SELECT * FROM projects_legacy ORDER BY createdAt DESC")
    .all() as LegacyProjectRow[];
  if (!legacyRows.length) return;

  const latest = legacyRows[0];
  const slug = slugify(latest.domain || "default");
  const createdAt = latest.createdAt || now();
  const projectStmt = db.prepare(
    "INSERT INTO projects (name, slug, settings, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)"
  );
  const projectInfo = projectStmt.run(
    latest.domain || "Legacy Projekt",
    slug,
    JSON.stringify({ migrated: true }),
    createdAt,
    createdAt
  );
  const projectId = Number(projectInfo.lastInsertRowid);

  const domainStmt = db.prepare(
    "INSERT INTO domains (projectId, hostname, isPrimary, createdAt) VALUES (?, ?, ?, ?)"
  );
  const domainInfo = domainStmt.run(projectId, latest.domain, 1, createdAt);
  const domainId = Number(domainInfo.lastInsertRowid);

  db.prepare(
    "INSERT OR IGNORE INTO project_features (projectId, feature, enabled, config) VALUES (?, ?, 1, ?)"
  ).run(projectId, "crawler", JSON.stringify({}));

  const snapshotStmt = db.prepare(
    "INSERT INTO snapshots (projectId, domainId, source, schemaVersion, meta, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const snapshotInfo = snapshotStmt.run(
    projectId,
    domainId,
    "crawler",
    1,
    JSON.stringify({ migrated: true }),
    createdAt
  );
  const snapshotId = Number(snapshotInfo.lastInsertRowid);

  db.prepare("INSERT INTO snapshot_blobs (snapshotId, payload) VALUES (?, ?)").run(
    snapshotId,
    JSON.stringify({
      domain: latest.domain,
      nodes: safeParse(latest.nodes),
      edges: safeParse(latest.edges),
    })
  );
}

migrateLegacyProjectsIfNeeded();

export function createProject(
  name: string,
  domain: string,
  customSlug?: string,
  settings: Record<string, unknown> = {}
): { project: Project; domain: Domain } {
  const baseSlug = slugify(customSlug || name || domain);
  let uniqueSlug = baseSlug;
  let counter = 1;
  while (
    db.prepare("SELECT 1 FROM projects WHERE slug = ?").get(uniqueSlug)
  ) {
    uniqueSlug = `${baseSlug}-${counter++}`;
  }

  const timestamp = now();
  const projectStmt = db.prepare(
    "INSERT INTO projects (name, slug, settings, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)"
  );
  const projectInfo = projectStmt.run(name, uniqueSlug, JSON.stringify(settings), timestamp, timestamp);
  const projectId = Number(projectInfo.lastInsertRowid);

  const domainStmt = db.prepare(
    "INSERT INTO domains (projectId, hostname, isPrimary, createdAt) VALUES (?, ?, 1, ?)"
  );
  const domainInfo = domainStmt.run(projectId, domain, timestamp);
  const domainId = Number(domainInfo.lastInsertRowid);

  db.prepare(
    "INSERT OR IGNORE INTO project_features (projectId, feature, enabled, config) VALUES (?, 'crawler', 1, '{}')"
  ).run(projectId);

  return {
    project: {
      id: projectId,
      name,
      slug: uniqueSlug,
      settings,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    domain: {
      id: domainId,
      projectId,
      hostname: domain,
      isPrimary: true,
      createdAt: timestamp,
    },
  };
}

export function listProjects(): Array<{
  project: Project;
  primaryDomain?: string;
  latestSnapshot?: { id: number; source: string; createdAt: string };
}> {
  const projects = db.prepare("SELECT * FROM projects ORDER BY createdAt DESC").all() as Array<{
    id: number;
    name: string;
    slug: string;
    settings: string;
    createdAt: string;
    updatedAt: string;
  }>;

  return projects.map((row) => {
    const domainRow = db
      .prepare("SELECT hostname FROM domains WHERE projectId = ? AND isPrimary = 1 LIMIT 1")
      .get(row.id) as { hostname: string } | undefined;
    const snapshotRow = db
      .prepare("SELECT id, source, createdAt FROM snapshots WHERE projectId = ? ORDER BY createdAt DESC LIMIT 1")
      .get(row.id) as { id: number; source: string; createdAt: string } | undefined;

    return {
      project: {
        id: row.id,
        name: row.name,
        slug: row.slug,
        settings: safeParse(row.settings) || {},
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      primaryDomain: domainRow?.hostname,
      latestSnapshot: snapshotRow || undefined,
    };
  });
}

export function getProjectBySlug(slug: string): {
  project: Project;
  domains: Domain[];
  features: ProjectFeature[];
} | null {
  const projectRow = db
    .prepare("SELECT * FROM projects WHERE slug = ? LIMIT 1")
    .get(slug) as
    | { id: number; name: string; slug: string; settings: string; createdAt: string; updatedAt: string }
    | undefined;

  if (!projectRow) return null;

  const domainRows = db
    .prepare("SELECT * FROM domains WHERE projectId = ? ORDER BY isPrimary DESC, hostname ASC")
    .all(projectRow.id) as Array<{
      id: number;
      projectId: number;
      hostname: string;
      isPrimary: number;
      createdAt: string;
    }>;

  const featureRows = db
    .prepare("SELECT * FROM project_features WHERE projectId = ?")
    .all(projectRow.id) as Array<{
      projectId: number;
      feature: string;
      enabled: number;
      config: string;
    }>;

  const domainsTyped: Domain[] = domainRows.map((d) => ({
    id: d.id,
    projectId: d.projectId,
    hostname: d.hostname,
    isPrimary: Boolean(d.isPrimary),
    createdAt: d.createdAt,
  }));

  const featuresTyped: ProjectFeature[] = featureRows.map((f) => ({
    projectId: f.projectId,
    feature: f.feature,
    enabled: Boolean(f.enabled),
    config: safeParse(f.config) || {},
  }));

  return {
    project: {
      id: projectRow.id,
      name: projectRow.name,
      slug: projectRow.slug,
      settings: safeParse(projectRow.settings) || {},
      createdAt: projectRow.createdAt,
      updatedAt: projectRow.updatedAt,
    },
    domains: domainsTyped,
    features: featuresTyped,
  };
}

export function ensureDomain(projectId: number, hostname: string, makePrimary = false): Domain {
  const existing = db
    .prepare("SELECT * FROM domains WHERE projectId = ? AND hostname = ? LIMIT 1")
    .get(projectId, hostname) as Domain | undefined;
  if (existing) {
    if (makePrimary && !existing.isPrimary) {
      db.prepare("UPDATE domains SET isPrimary = 1 WHERE id = ?").run(existing.id);
    }
    return { ...existing, isPrimary: Boolean(existing.isPrimary) };
  }

  const timestamp = now();
  const insert = db.prepare(
    "INSERT INTO domains (projectId, hostname, isPrimary, createdAt) VALUES (?, ?, ?, ?)"
  );
  const info = insert.run(projectId, hostname, makePrimary ? 1 : 0, timestamp);
  return {
    id: Number(info.lastInsertRowid),
    projectId,
    hostname,
    isPrimary: makePrimary,
    createdAt: timestamp,
  };
}

export function ensureFeature(projectId: number, feature: string, config: Record<string, unknown> = {}) {
  db.prepare(
    "INSERT OR IGNORE INTO project_features (projectId, feature, enabled, config) VALUES (?, ?, 1, ?)"
  ).run(projectId, feature, JSON.stringify(config));
}

export function getPrimaryDomain(projectId: number): Domain | null {
  const row = db
    .prepare("SELECT * FROM domains WHERE projectId = ? AND isPrimary = 1 LIMIT 1")
    .get(projectId) as Domain | undefined;
  return row ? { ...row, isPrimary: Boolean(row.isPrimary) } : null;
}

export function findProjectByHostname(hostname: string): { project: Project; domain: Domain } | null {
  const row = db
    .prepare(
      `SELECT p.*, d.id as domainId, d.projectId, d.isPrimary as isPrimaryDomain, d.createdAt as createdAtDomain
       FROM projects p
       JOIN domains d ON d.projectId = p.id
       WHERE d.hostname = ?
       LIMIT 1`
    )
    .get(hostname) as
    | {
        id: number;
        name: string;
        slug: string;
        settings: string;
        createdAt: string;
        updatedAt: string;
        domainId: number;
        projectId: number;
        isPrimaryDomain: number;
        createdAtDomain: string;
      }
    | undefined;

  if (!row) return null;

  return {
    project: {
      id: row.id,
      name: row.name,
      slug: row.slug,
      settings: safeParse(row.settings) || {},
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    },
    domain: {
      id: row.domainId,
      projectId: row.projectId,
      hostname,
      isPrimary: Boolean(row.isPrimaryDomain),
      createdAt: row.createdAtDomain,
    },
  };
}

export function saveSnapshot(
  projectId: number,
  domainId: number | null,
  source: string,
  schemaVersion: number,
  meta: Record<string, unknown>,
  payload: { nodes: FlowNode[]; edges: FlowEdge[]; domain: string }
): SnapshotWithPayload {
  const createdAt = now();
  const snapshotStmt = db.prepare(
    "INSERT INTO snapshots (projectId, domainId, source, schemaVersion, meta, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const info = snapshotStmt.run(
    projectId,
    domainId,
    source,
    schemaVersion,
    JSON.stringify(meta),
    createdAt
  );
  const snapshotId = Number(info.lastInsertRowid);

  db.prepare("INSERT INTO snapshot_blobs (snapshotId, payload) VALUES (?, ?)").run(
    snapshotId,
    JSON.stringify(payload)
  );

  return {
    snapshot: {
      id: snapshotId,
      projectId,
      domainId,
      source,
      schemaVersion,
      meta,
      createdAt,
    },
    nodes: payload.nodes,
    edges: payload.edges,
    domain: payload.domain,
  };
}

export function getLatestSnapshotWithPayload(
  projectId: number,
  source: string
): SnapshotWithPayload | null {
  const snapshotRow = db
    .prepare(
      "SELECT id, domainId, schemaVersion, meta, createdAt FROM snapshots WHERE projectId = ? AND source = ? ORDER BY createdAt DESC LIMIT 1"
    )
    .get(projectId, source) as
    | { id: number; domainId: number | null; schemaVersion: number; meta: string; createdAt: string }
    | undefined;

  if (!snapshotRow) return null;

  const blobRow = db
    .prepare("SELECT payload FROM snapshot_blobs WHERE snapshotId = ? LIMIT 1")
    .get(snapshotRow.id) as { payload: string } | undefined;
  if (!blobRow) return null;

  const payload = safeParse(blobRow.payload) || {};
  return {
    snapshot: {
      id: snapshotRow.id,
      projectId,
      domainId: snapshotRow.domainId,
      source,
      schemaVersion: snapshotRow.schemaVersion,
      meta: safeParse(snapshotRow.meta) || {},
      createdAt: snapshotRow.createdAt,
    },
    nodes: (payload.nodes as FlowNode[]) || [],
    edges: (payload.edges as FlowEdge[]) || [],
    domain: (payload.domain as string) || "",
  };
}

export function listSnapshots(projectId: number, source?: string) {
  const rowsRaw = source
    ? db
        .prepare("SELECT * FROM snapshots WHERE projectId = ? AND source = ? ORDER BY createdAt DESC")
        .all(projectId, source)
    : db
        .prepare("SELECT * FROM snapshots WHERE projectId = ? ORDER BY createdAt DESC")
        .all(projectId);
  const rows = rowsRaw as Array<
    Snapshot & {
      meta: string;
    }
  >;

  return rows.map((row) => ({
    ...row,
    meta: safeParse(row.meta as unknown as string) || {},
  }));
}

export function upsertPagesFromNodes(
  projectId: number,
  domainId: number | null,
  snapshotId: number,
  nodes: FlowNode[]
) {
  const pageStmt = db.prepare(
    `INSERT INTO pages (projectId, domainId, path, latestSnapshotId, title, depth, statusCode, unreachable, meta)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(projectId, domainId, path) DO UPDATE SET
       latestSnapshotId = excluded.latestSnapshotId,
       title = excluded.title,
       depth = excluded.depth,
       statusCode = excluded.statusCode,
       unreachable = excluded.unreachable`
  );

  const depthFromPath = (pathValue: string) => {
    if (pathValue === "/") return 0;
    return pathValue.replace(/^\//, "").split("/").filter(Boolean).length;
  };

  nodes.forEach((node) => {
    const pathValue = node.data?.path || (node.data?.isRoot ? "/" : "/");
    const depth = depthFromPath(pathValue);
    const title = node.data?.label || pathValue || "Page";
    const statusCode = node.data?.statusCode ?? null;
    const unreachable = node.data?.unreachable ? 1 : 0;

    const meta = {
      metaTitle: node.data?.metaTitle || null,
      metaDescription: node.data?.metaDescription || null,
      h1: node.data?.h1 || null,
    };

    pageStmt.run(
      projectId,
      domainId,
      pathValue,
      snapshotId,
      title,
      depth,
      statusCode,
      unreachable,
      JSON.stringify(meta)
    );
  });
}

const normalizePathValue = (value: string) => {
  const trimmed = (value || "").trim();
  if (!trimmed) return "/";
  let pathValue = trimmed;
  const hashIndex = pathValue.indexOf("#");
  if (hashIndex >= 0) {
    pathValue = pathValue.slice(0, hashIndex);
  }
  const queryIndex = pathValue.indexOf("?");
  if (queryIndex >= 0) {
    pathValue = pathValue.slice(0, queryIndex);
  }
  if (!pathValue.startsWith("/")) {
    pathValue = `/${pathValue}`;
  }
  if (pathValue.length > 1 && pathValue.endsWith("/")) {
    pathValue = pathValue.slice(0, -1);
  }
  return pathValue || "/";
};

export function createKeywordImport(
  projectId: number,
  domainId: number | null,
  source: string,
  fileName: string | null,
  meta: Record<string, unknown> = {}
): KeywordImport {
  const createdAt = now();
  const stmt = db.prepare(
    "INSERT INTO keyword_imports (projectId, domainId, source, fileName, meta, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const info = stmt.run(projectId, domainId, source, fileName, JSON.stringify(meta), createdAt);
  const id = Number(info.lastInsertRowid);
  return { id, projectId, domainId, source, fileName, meta, createdAt };
}

type KeywordInput = {
  term: string;
  url?: string | null;
  path: string;
  volume?: number | null;
  difficulty?: number | null;
  position?: number | null;
  meta?: Record<string, unknown>;
  domainId: number;
};

export function saveKeywords(
  projectId: number,
  importId: number,
  rows: KeywordInput[]
): Keyword[] {
  const stmt = db.prepare(
    `INSERT INTO keywords (projectId, importId, domainId, term, url, path, volume, difficulty, position, meta, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(projectId, domainId, term, path) DO UPDATE SET
       importId = excluded.importId,
       url = excluded.url,
       volume = excluded.volume,
       difficulty = excluded.difficulty,
       position = excluded.position,
       meta = excluded.meta,
       createdAt = excluded.createdAt`
  );
  const selectStmt = db.prepare(
    "SELECT * FROM keywords WHERE projectId = ? AND domainId = ? AND term = ? AND path = ? LIMIT 1"
  );

  const seen = new Set<string>();
  const results: Keyword[] = [];

  rows.forEach((row) => {
    const term = row.term.trim();
    const pathValue = normalizePathValue(row.path);
    const key = `${row.domainId}|${term.toLowerCase()}|${pathValue}`;
    if (seen.has(key)) return;
    seen.add(key);

    const timestamp = now();
    const metaString = JSON.stringify(row.meta || {});
    stmt.run(
      projectId,
      importId,
      row.domainId,
      term,
      row.url || null,
      pathValue,
      row.volume ?? null,
      row.difficulty ?? null,
      row.position ?? null,
      metaString,
      timestamp
    );

    const fetched = selectStmt.get(projectId, row.domainId, term, pathValue) as
      | (Keyword & { meta: string })
      | undefined;
    if (fetched) {
      results.push({
        ...fetched,
        meta: safeParse(fetched.meta) || {},
      });
    }
  });

  return results;
}

export function getKeywords(
  projectId: number,
  options?: { path?: string; domainId?: number | null }
): Keyword[] {
  const clauses = ["projectId = ?"];
  const params: Array<number | string> = [projectId];
  if (options?.path) {
    clauses.push("path = ?");
    params.push(normalizePathValue(options.path));
  }
  if (typeof options?.domainId === "number") {
    clauses.push("domainId = ?");
    params.push(options.domainId);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db
    .prepare(`SELECT * FROM keywords ${where} ORDER BY term COLLATE NOCASE ASC`)
    .all(...params) as Array<
    Keyword & {
      meta: string;
    }
  >;

  return rows.map((row) => ({
    ...row,
    meta: safeParse(row.meta) || {},
  }));
}

export function addNodeSuggestion(
  projectId: number,
  domainId: number | null,
  path: string,
  field: "metaTitle" | "metaDescription" | "h1",
  value: string
): NodeSuggestion {
  const normalizedPath = normalizePathValue(path);
  const createdAt = now();
  const stmt = db.prepare(
    "INSERT INTO node_suggestions (projectId, domainId, path, field, value, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const info = stmt.run(projectId, domainId, normalizedPath, field, value, createdAt);
  return {
    id: Number(info.lastInsertRowid),
    projectId,
    domainId,
    path: normalizedPath,
    field,
    value,
    createdAt,
  };
}

export function listNodeSuggestions(
  projectId: number,
  options?: { path?: string; domainId?: number | null }
): NodeSuggestion[] {
  const clauses = ["projectId = ?"];
  const params: Array<number | string> = [projectId];
  if (options?.path) {
    clauses.push("path = ?");
    params.push(normalizePathValue(options.path));
  }
  if (typeof options?.domainId === "number") {
    clauses.push("domainId = ?");
    params.push(options.domainId);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db
    .prepare(`SELECT * FROM node_suggestions ${where} ORDER BY createdAt DESC`)
    .all(...params) as NodeSuggestion[];
  return rows;
}

export function deleteNodeSuggestion(projectId: number, id: number) {
  db.prepare("DELETE FROM node_suggestions WHERE projectId = ? AND id = ?").run(projectId, id);
}

export function createGhostPage(
  projectId: number,
  domainId: number | null,
  path: string,
  label: string,
  position: { x?: number; y?: number } = {},
  meta: Record<string, unknown> = {}
): GhostPage {
  const normalizedPath = normalizePathValue(path);
  const createdAt = now();
  const updatedAt = createdAt;
  const stmt = db.prepare(
    "INSERT INTO ghost_pages (projectId, domainId, path, label, x, y, meta, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const info = stmt.run(
    projectId,
    domainId,
    normalizedPath,
    label || "Ghost Page",
    position.x ?? 0,
    position.y ?? 0,
    JSON.stringify(meta),
    createdAt,
    updatedAt
  );
  const id = Number(info.lastInsertRowid);
  return {
    id,
    projectId,
    domainId,
    path: normalizedPath,
    label: label || "Ghost Page",
    x: position.x ?? 0,
    y: position.y ?? 0,
    meta,
    createdAt,
    updatedAt,
  };
}

export function listGhostPages(projectId: number, domainId?: number | null): GhostPage[] {
  const clauses = ["projectId = ?"];
  const params: Array<number> = [projectId];
  if (typeof domainId === "number") {
    clauses.push("domainId = ?");
    params.push(domainId);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db
    .prepare(`SELECT * FROM ghost_pages ${where} ORDER BY createdAt ASC`)
    .all(...params) as Array<
    GhostPage & {
      meta: string;
    }
  >;
  return rows.map((row) => ({
    ...row,
    meta: safeParse(row.meta) || {},
  }));
}

export function updateGhostPagePosition(
  projectId: number,
  id: number,
  position: { x: number; y: number }
): GhostPage | null {
  const updatedAt = now();
  db.prepare("UPDATE ghost_pages SET x = ?, y = ?, updatedAt = ? WHERE projectId = ? AND id = ?").run(
    position.x,
    position.y,
    updatedAt,
    projectId,
    id
  );
  const row = db
    .prepare("SELECT * FROM ghost_pages WHERE projectId = ? AND id = ? LIMIT 1")
    .get(projectId, id) as
    | (GhostPage & {
        meta: string;
      })
    | undefined;
  if (!row) return null;
  return {
    ...row,
    meta: safeParse(row.meta) || {},
  };
}

export function deleteGhostPage(projectId: number, id: number) {
  db.prepare("DELETE FROM ghost_pages WHERE projectId = ? AND id = ?").run(projectId, id);
}
