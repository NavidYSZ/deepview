# Deepview Context & Specs (from chat)

What you asked for
- Octopus.do-like clone (Alpha) with React Flow and infinite canvas feel.
- Crawl only click depth = 1: root domain on top, first-level links as children.
- Use SQLite for persistence; data must be saved and reloadable.
- Deploy as a single app in Coolify; keep deployment simple and robust.
- UI touches: floating domain input bar at the bottom, placeholder buttons bottom-left/right, root card + child cards styled like Octopus.do.
- Keep it minimal; no extra features beyond the core crawl + render + save.
- Language used in UI/status: German short strings (e.g., “Bitte eine Domain eingeben.”).

What was built (high-level)
- Next.js (App Router, TypeScript) + Tailwind; React Flow canvas with custom “card” node type.
- Crawler (Cheerio + fetch) for click depth 1, same host only; produces React Flow nodes/edges.
- SQLite via `better-sqlite3` with a `projects` table; latest crawl is saved automatically.
- API routes: `POST /api/crawl` (crawl + save) and `GET /api/projects/latest` (load last).
- UI auto-loads last saved map on page load; crawl button triggers fetch/save and refreshes the graph.
- Placeholder toolbars to mirror Octopus.do layout; only crawl/load are functional in Alpha.

Environment/setup notes I know about
- Project folder: `deepview` (fresh Next.js app scaffolded with npm/Tailwind).
- Runtime target: Node 18+ (Next.js 16).
- SQLite file: `data.sqlite` in project root; persist via volume in Coolify.
- Buildpack guidance: Nixpacks/Node is fine; install `build-essential python3` if `better-sqlite3` needs a toolchain.

Key files (orientation)
- `src/app/page.tsx` — UI + React Flow + crawl/load actions.
- `src/lib/crawler.ts` — depth-1 crawl and graph assembly.
- `src/lib/db.ts` — SQLite setup/helpers.
- `src/app/api/crawl/route.ts`, `src/app/api/projects/latest/route.ts` — API endpoints.
- `DEEPVIEW_OVERVIEW.md`, `DEEPVIEW_IMPLEMENTATION_NOTES.md`, `DEEPVIEW_QUICKSTART.md` — prior handover docs.

Known limitations
- Only first-level links (no deeper tree).
- Placeholder buttons have no behavior yet.
- No auth, no multi-project list; only “latest” is stored/loaded.
