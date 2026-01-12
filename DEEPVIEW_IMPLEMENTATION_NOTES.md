# Deepview Implementation Notes

## File Map (key parts)
- `src/app/page.tsx`: Client UI with React Flow, card node type, crawl/load actions, status pill, floating input bar.
- `src/lib/crawler.ts`: Domain normalization, depth-1 crawl, link filtering, node/edge assembly.
- `src/lib/db.ts`: `better-sqlite3` setup, table init, `saveProject`, `getLatestProject`.
- `src/app/api/crawl/route.ts`: `POST /api/crawl` — crawls, saves, returns graph.
- `src/app/api/projects/latest/route.ts`: `GET /api/projects/latest` — returns last saved graph.
- `src/app/globals.css`: Font import, theme colors, base styles.
- `src/app/layout.tsx`: Metadata and font setup.

## UI Behavior
- React Flow options: `fitView`, minZoom 0.3, maxZoom 2, custom `card` node for Octopus-like boxes, `Background` grid.
- Status messages: status pill near bottom; “Save” button just sets a status (persistence already happens on crawl).
- Load-on-start: `useEffect` calls `GET /api/projects/latest`; domain input is set if empty.
- Crawl button: posts domain, updates graph, sets active domain and status. Loading state on button text.
- Placeholders: toolbar buttons left/right and color dots are visual only.

## Crawling Logic (src/lib/crawler.ts)
- `normalizeDomain`: ensures protocol, strips hash/search, enforces trailing slash removal and returns hostname-root URL without trailing slash in storage (domain saved as hostname).
- Fetch root HTML with `User-Agent: DeepviewCrawler/0.1`.
- Parse `<a href>`:
  - Skip `mailto:`, `tel:`, hashes, cross-domain links.
  - Normalize URL with root as base; force same protocol/host; drop hash/search; strip trailing slash; `/` is not added as child.
  - Deduplicate by normalized path.
  - Label from anchor text -> fallback to last path segment -> “Page”; truncate >28 chars with ellipsis.
- Graph layout: root at (0,0), children in a horizontal line at y=200, spacing 240px, centered around 0. If no children, add one “Keine Links gefunden” node.

## Data Contracts (Flow)
- `FlowNode` data: `{ label: string; path?: string; isRoot?: boolean }`
  - type: `"card"`
  - ids: `"root"` or `"node-{normalizedPath}"` (normalizedPath can be empty string for `/`; but `/` is skipped as child)
- `FlowEdge`: standard React Flow edge; ids `e-root-{index}`, `source: "root"`, `target: child.id`, stroke style light blue.

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
- Cards: rounded, double border, subtle shadow to match Octopus-like design.


