# Deepview Implementation Notes

## File Map (key parts)
- `src/app/page.tsx`: UI with React Flow, card node, crawl/load actions, status pill, floating input bar, expand/collapse logic, “show all” toggle.
- `src/lib/crawler.ts`: Domain normalization, sitemap + path-based crawl, link filtering, node/edge assembly.
- `src/lib/db.ts`: `better-sqlite3` setup, table init, `saveProject`, `getLatestProject`.
- `src/app/api/crawl/route.ts`: `POST /api/crawl` — crawls, saves, returns graph.
- `src/app/api/projects/latest/route.ts`: `GET /api/projects/latest` — returns last saved graph.
- `src/app/globals.css`: Font import, theme colors, base styles, fade-in keyframe.
- `src/app/layout.tsx`: Metadata and font setup.

## UI Behavior
- React Flow: `fitView`, minZoom 0.3, maxZoom 2, custom `card` node, `Background` grid, step edges.
- Expand/collapse: only depth 0–1 visible by default; ▼ per node with children; “show all” (🖥) toggles everything. State via refs to avoid flackern.
- Layout: Dagre; parents with >4 visible children (depth ≥2) wrap children into rows of 4; edges to wrapped children become black/transparent. Root/direct children never wrap.
- Status: top pill; “Save” button just shows status; settings placeholder.
- Animation: fade-in for newly shown cards; existing nodes keep their positions on expand.

## Crawling Logic (src/lib/crawler.ts)
- Normalize domain to https; strip hash/search; host matching ignores leading `www.`; follow redirect host; root always included.
- Sitemap ingest: `/sitemap.xml` or `/sitemap_index.xml`, same-host URLs only (MAX_PAGES=80).
- Crawl by path depth (not click graph): fetch pages up to max depth (1–5) and max pages; same-host only. Titles from `<title>` when present.
- Hierarchy from paths: parent path is prefix (`/a/b` -> `/a`); edges reflect path tree. Root `/` is not added as a child.
- Labels: title -> last path segment -> hostname; truncated to 40 chars with ellipsis.

## Data Contracts (Flow)
- `FlowNode` data: `{ label: string; path?: string; isRoot?: boolean; depth?: number; hasChildren?: boolean; expanded?: boolean; isNew?: boolean }`
  - type: `"card"`
  - ids: `"root"` or `"node-{normalizedPath}"`
- `FlowEdge`: ids `e-{parent}-{child}`, type `step`, stroke blue; edges to wrapped children are black/transparent.

## Data Layer (SQLite)
- `projects` table schema: `id INTEGER PK`, `domain TEXT`, `nodes TEXT`, `edges TEXT`, `createdAt TEXT`.
- Uses `db.pragma("journal_mode = WAL")`.
- On import: touches `data.sqlite` if missing, then ensures table exists.
- `saveProject(domain, nodes, edges)`: stringifies nodes/edges, writes with ISO timestamp.
- `getLatestProject()`: returns last by `createdAt` or null.

## Error Handling
- `POST /api/crawl`: 400 on missing domain; 500 with error message on fetch/parse failure.
- `GET /api/projects/latest`: always 200 with `{ project: ... | null }`.
- UI surfaces error/status in the pill; no toast system.

## Styling
- Font: Manrope from Google Fonts, fallback to Geist Sans.
- Palette: background `#f9fbff`, primary `#2f6bff`, accent root border `#8f6cff`.
- Cards: rounded, double border, subtle shadow; fade-in animation for newly shown cards.
