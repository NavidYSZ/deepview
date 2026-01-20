# Components & Contracts Cheat Sheet

Goal: Snapshot of the moving parts (UI, crawler, DB, APIs, contracts) for project-aware Deepview.

## UI Components (src/app/page.tsx)
- **HomePage (default export)**
  - Inputs: project list/detail from API (`/api/projects`, `/api/projects/{slug}`, `/api/projects/{slug}/crawl`), local state (domain input, depth, showAll, expanded set via refs).
  - Outputs: React Flow nodes/edges (visible subset), project selection, crawl actions, status pill messages.
  - Behavior: On load fetches project list; auto-selects first project; Project Switcher (top-left) to change/add projects; Crawl posts to project-scoped endpoint; only depth 0–1 visible by default; ▼ toggles deeper nodes; 🖥 shows all; status pill is transient; fade-in animation for newly visible cards. Depth picker (1–5) + Refresh button to reload project.

- **CardNode (React Flow node type `card`)**
  - Props/Data: `{ label, path?, isRoot?, depth?, hasChildren?, expanded?, isNew?, statusCode?, unreachable?, onToggle? }`.
  - Outputs: Card with optional ▼ button (stopPropagation) and error badge on unreachable/4xx+.
  - Styling: Root vs child border color, triple dots header, label/path text, fade-in on `isNew`.

## Layout / State Helpers (src/app/page.tsx)
- **applyLayout**: Dagre layout; wraps children (>4) only for parents at depth ≥2; wrapped-child edges styled black/transparent; root/direct children never wrap.
- **rebuildGraph**: Filters visibility (depth 0–1 always; deeper only if parents expanded unless viewAll); decorates nodes with `hasChildren/expanded/isNew`; triggers layout; uses refs (`expandedRef`, `showAllRef`, `prevVisibleRef`) to avoid flicker and recursive rebuilds.

## Crawler (src/lib/crawler.ts)
- **normalizeDomain(input: string)** → `https://host`
  - Ensures https://, strips hash/search, pathname `/`, trims trailing slash.
- **crawlDomain(domain: string, maxDepth = 1)** → `{ domain, nodes, edges }`
  - Depth clamp 1–5; same-host only; sitemap ingest (`/sitemap.xml` or `/sitemap_index.xml`, MAX_PAGES=80).
  - Titles from `<title>`; fallback last path segment/hostname; truncate 40 chars.
  - Path hierarchy: parent `/a/b` -> `/a`; root `/` not added as child.
  - Nodes include `statusCode` + `unreachable` when fetch fails/4xx+.

## Persistence Layer (src/lib/db.ts)
- DB: `data.sqlite` (WAL).
- Tables: `projects`, `domains`, `project_features`, `snapshots`, `snapshot_blobs`, `pages`, `keyword_imports`, `keywords`, `metrics`, `events`.
  - Snapshots store meta + payload JSON; pages table is normalized (path/depth/title/status).
  - Keywords: per project/domain/path with volume/difficulty/position + meta, linked to imports.
  - Node suggestions: `node_suggestions` per project/path/field with value and timestamps.
  - Legacy migration: old `projects` table is renamed `projects_legacy`; latest row imported as project+snapshot.
- Helpers:
  - `createProject(name, domain, slug?, settings?)`
  - `listProjects()`
  - `getProjectBySlug(slug)`
  - `findProjectByHostname(hostname)`
  - `ensureDomain(projectId, hostname, makePrimary?)`
  - `ensureFeature(projectId, feature, config?)`
  - `saveSnapshot(projectId, domainId, source, schemaVersion, meta, payload)`
  - `getLatestSnapshotWithPayload(projectId, source)`
  - `listSnapshots(projectId, source?)`
  - `upsertPagesFromNodes(projectId, domainId, snapshotId, nodes)`
  - `createKeywordImport(projectId, domainId, source, fileName, meta)`
  - `saveKeywords(projectId, importId, rows)`
  - `getKeywords(projectId, { path?, domainId? })`
  - `addNodeSuggestion(projectId, domainId, path, field, value)`
  - `listNodeSuggestions(projectId, { path?, domainId? })`
  - `deleteNodeSuggestion(projectId, id)`

## API Routes
- **GET /api/projects** — Projektliste mit Primärdomain + letztem Snapshot-Stempel.
- **POST /api/projects** — Body `{ name, domain, slug?, settings? }` → `{ project, domain }`.
- **GET /api/projects/{slug}** — `{ project, domains, features, latestSnapshot? }` (Crawler payload inkl. nodes/edges).
- **POST /api/projects/{slug}/crawl** — Body `{ domain?, depth? }` → `{ project, domain, snapshot, nodes, edges }` + pages upsert.
- **GET /api/projects/{slug}/snapshots?source=crawler** — Snapshot-Metadaten.
- **GET /api/projects/{slug}/keywords** — Optional `domain`, `path` Filter; liefert gespeicherte Keywords.
- **POST /api/projects/{slug}/keywords** — FormData-Upload (CSV/TSV/XLSX) oder JSON; speichert Keywords pro Pfad/Domain.
- **GET /api/projects/{slug}/suggestions** — Optional `path`, `domain`; liefert Vorschläge zu Meta/H1.
- **POST /api/projects/{slug}/suggestions** — Body `{ path, field: "metaTitle"|"metaDescription"|"h1", value, domain? }`.
- **DELETE /api/projects/{slug}/suggestions** — Body `{ id }` zum Entfernen eines Vorschlags.
- **Compat:** `POST /api/crawl` auto-creates/finds project by domain and stores snapshot; `GET /api/projects/latest` returns first available crawler snapshot if any.

## Data Contracts
- **FlowNode.data**: `{ label: string; path?: string; isRoot?: boolean; depth?: number; hasChildren?: boolean; expanded?: boolean; isNew?: boolean; statusCode?: number; unreachable?: boolean; onToggle?: () => void }`
- **FlowEdge**: `{ id: string; source: string; target: string; type?: "step"; style?: {...} }`
- **Project**: `{ id, name, slug, settings, createdAt, updatedAt }`
- **Domain**: `{ id, projectId, hostname, isPrimary, createdAt }`
- **Snapshot**: `{ id, projectId, domainId, source, schemaVersion, meta, createdAt }`
- **Snapshot payload (crawler)**: `{ domain: string; nodes: FlowNode[]; edges: FlowEdge[] }`
- **Keyword**: `{ id, projectId, importId, domainId, term, url, path, volume?, difficulty?, position?, meta, createdAt }`

## Behavior Defaults / Flags
- Visible by default: depths 0–1.
- Show All (🖥): sets `showAllRef`, expands all nodes; toggling off collapses to depth 0–1.
- Expand toggle (▼): toggles parent id in `expandedRef`, rebuilds visible graph.
- Wrapping: parents depth ≥2 with >4 visible children wrap into rows of 4; wrapped edges darkened.
- Animation: `fade-in-up` for newly visible nodes.

## Known Fixes
- Flackern auf Expand/Display gelöst durch refs + single rebuild (siehe `KNOWN_BUGS_AND_FIXES.md`).
