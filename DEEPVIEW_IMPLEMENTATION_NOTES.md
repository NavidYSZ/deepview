# Deepview Implementation Notes

## File Map (Key Parts)
- `src/app/page.tsx`: Haupt-UI (React Flow, Card/Ghost Nodes, Project Switcher, Crawl/Refresh, ShowAll/Expand, Sidebars für Overview/SEO/Keywords/Ghosts).
- `src/lib/crawler.ts`: Domain-Normalisierung, Sitemap + Pfadtiefen-Crawl (1–5), Host-Filter, Node/Edge-Bau inkl. Status/SEO-Felder.
- `src/lib/db.ts`: SQLite-Init (WAL), Tabellen (projects/domains/features/snapshots/pages/keywords/suggestions/ghosts), Helpers für CRUD + Legacy-Migration.
- `src/lib/keywords.ts`: Parser für CSV/TSV/XLSX-Keyword-Uploads (normalisiert URL/Path/Host).
- API-Routes: `src/app/api/**` (Projects, Crawl, Snapshots, Keywords, Suggestions, Ghosts, Compat latest).
- Styling/Layout: `src/app/globals.css`, `src/app/layout.tsx`.

## UI Behavior
- React Flow: `fitView`, minZoom 0.3, maxZoom 2, `Background` Grid; NodeTypes `card` und `ghost`; Edges smoothstep.
- Sichtbarkeit: Tiefe 0–1 standard; ▼ toggelt Kinder; 🖥 zeigt alle (setzt `expandedRef` auf alle IDs). Refs statt State, um Flackern zu vermeiden.
- Layout: Dagre-Basis, Wrap bei Eltern-Tiefe ≥2 mit >4 sichtbaren Kindern; Wrapped-Kanten gedunkelt; Root + direkte Kinder nie Wrap. Ghost-Nodes behalten manuelle Position, sonst werden sie mitgelayoutet.
- Status/UX: Pill oben; Save/Settings Dekor; Floating Input Bar unten (Domain + Depth-Picker ∞=5); Toolbar rechts unten als Placeholder. Links Sidebar (Projekt/Uploads/Ghosts), rechts Sidebar (Page Details, SEO-Felder editierbar via Suggestions, Keywords sortierbar).
- Ghosts: Buttons an Nodes (+ unten/rechts) erzeugen Ghost unter/auf gleicher Ebene (orderAfter). Drag speichert Position (manual flag). Deletion-Knopf am Ghost.
- Keywords/Suggestions: Keywords per Upload geladen und per Pfad angezeigt; Suggestions CRUD je Feld für ausgewählten Node/Pfad.

## Crawling Logic (`src/lib/crawler.ts`)
- Normalisiert Domain → `https://host/`, strip Query/Hash, Host-Match ohne `www.`, Redirect-Host wird angenommen.
- Sitemaps (`/sitemap.xml`/`/sitemap_index.xml`) same-host, max 80.
- Crawl nach Pfadtiefe (1–5), Queue BFS, same-host only, max 80 Seiten. Liest `<title>`, Meta Title/Description (og/twitter/description), erstes `<h1>`.
- Pfadbaum: Elternpräfixe erzwungen, fehlende Ahnen als unreachable 404. Root-only Fall generiert Dummy “Keine Links gefunden”.

## Data Contracts (Graph)
- `FlowNode.data` (card): `{ label, path?, isRoot?, depth?, hasChildren?, expanded?, isNew?, statusCode?, unreachable?, metaTitle?, metaDescription?, h1?, orderAfter?, isManualPosition? }`
- `FlowNode.data` (ghost): `{ label, path, isGhost: true, isManualPosition?, orderAfter? }`
- IDs: `root`, `node-{normalizedPath}`, `ghost-{id}`; Edges: `e-{parent}-{child}`, Typ smoothstep, Wrapped-Kanten dunkel.

## Data Layer (SQLite)
- Core Tabellen: `projects`, `domains`, `project_features`, `snapshots` + `snapshot_blobs`, `pages` (title/depth/status/unreachable + meta JSON).
- SEO/Content: `keyword_imports`, `keywords`, `node_suggestions`, `ghost_pages`.
- Prepared: `metrics`, `events`.
- Legacy: erkennt altes `projects`-Schema, verschiebt zu `projects_legacy`, importiert letzte Zeile als neues Projekt+Snapshot.

## Error Handling
- APIs geben 400 bei fehlenden Pflichtfeldern, 404 bei fehlenden Projekten, 500 bei generischen Fehlern; UI zeigt Status-Pill.

## Styling
- Fonts: Manrope + Geist; Palette bg `#f9fbff`, Primär `#2f6bff`, Root-Rand `#8f6cff`; Card-Fade-In für neue Nodes.
