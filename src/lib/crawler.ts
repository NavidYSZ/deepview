import { load } from "cheerio";
import type { Edge, Node } from "reactflow";

type FlowNode = Node<{
  label: string;
  path?: string;
  isRoot?: boolean;
  statusCode?: number;
  unreachable?: boolean;
}>;
type FlowEdge = Edge;

type PageInfo = {
  path: string;
  url: URL;
  title?: string;
  statusCode?: number;
  unreachable?: boolean;
};

export type CrawlResult = {
  domain: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
};

const MAX_DEPTH = 5;
const MAX_PAGES = 80;

export function normalizeDomain(input: string) {
  const trimmed = input.trim();
  const prefixed = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
  const url = new URL(prefixed);
  url.hash = "";
  url.search = "";
  url.pathname = "/";
  return url.toString().replace(/\/$/, "");
}

function cleanPath(url: URL) {
  return url.pathname.replace(/\/$/, "") || "/";
}

function makeNodeId(path: string) {
  if (path === "/") return "root";
  return `node-${path.replace(/[^a-zA-Z0-9-_]/g, "-") || "root"}`;
}

function pathSegments(path: string) {
  const clean = path === "/" ? [] : path.replace(/^\//, "").split("/").filter(Boolean);
  return clean;
}

function parentPath(path: string) {
  const segs = pathSegments(path);
  if (segs.length === 0) return null;
  if (segs.length === 1) return "/";
  return `/${segs.slice(0, -1).join("/")}`;
}

function stripWww(host: string) {
  return host.replace(/^www\./i, "");
}

function matchesHost(host: string, rootHost: string) {
  const a = stripWww(host.toLowerCase());
  const b = stripWww(rootHost.toLowerCase());
  return a === b;
}

async function fetchSitemapUrls(root: URL): Promise<URL[]> {
  const candidates = [new URL("/sitemap.xml", root), new URL("/sitemap_index.xml", root)];
  const urls: URL[] = [];

  for (const candidate of candidates) {
    try {
      const res = await fetch(candidate.toString(), {
        headers: { "User-Agent": "DeepviewCrawler/0.1 (+https://example.com)" },
      });
      if (!res.ok) continue;
      const text = await res.text();
      const $ = load(text, { xmlMode: true });
      $("loc").each((_, el) => {
        const loc = $(el).text().trim();
        if (!loc) return;
        try {
          const u = new URL(loc);
          u.hash = "";
          u.search = "";
          if (matchesHost(u.hostname, root.hostname)) {
            urls.push(u);
          }
        } catch {
          // ignore invalid
        }
      });
      if (urls.length) break; // first successful sitemap wins
    } catch {
      // ignore
    }
  }

  return urls.slice(0, MAX_PAGES);
}

export async function crawlDomain(
  domain: string,
  maxDepth: number = 1
): Promise<CrawlResult> {
  const normalized = normalizeDomain(domain);
  const rootUrl = new URL(normalized);
  let rootHost = rootUrl.hostname;
  const depthLimit = Math.min(Math.max(1, Math.floor(maxDepth)), MAX_DEPTH);

  const pages = new Map<string, PageInfo>();

  const addPage = (url: URL, title?: string) => {
    if (!matchesHost(url.hostname, rootHost)) return;
    const path = cleanPath(url);
    const existing = pages.get(path);
    pages.set(path, {
      path,
      url,
      title: title || existing?.title,
      statusCode: existing?.statusCode,
      unreachable: existing?.unreachable,
    });
  };

  // Always include root
  addPage(rootUrl);

  // Try sitemap
  const sitemapUrls = await fetchSitemapUrls(rootUrl);
  sitemapUrls.forEach((url) => addPage(url));

  // Crawl by fetching pages up to MAX_PAGES and respecting depthLimit by path
  const queue: URL[] = [rootUrl];
  const processed = new Set<string>();

  while (queue.length && pages.size < MAX_PAGES) {
    const current = queue.shift();
    if (!current) break;

    const path = cleanPath(current);
    const depth = pathSegments(path).length;
    if (depth > depthLimit) {
      continue;
    }
    if (processed.has(path)) continue;
    processed.add(path);

    try {
      const res = await fetch(current.toString(), {
        headers: { "User-Agent": "DeepviewCrawler/0.1 (+https://example.com)" },
      });
      if (!res.ok) {
        const info = pages.get(path);
        if (info) {
          pages.set(path, { ...info, statusCode: res.status, unreachable: true });
        }
        continue;
      }

      try {
        const finalHost = new URL(res.url).hostname;
        if (matchesHost(finalHost, rootHost)) {
          rootHost = finalHost;
        }
      } catch {
        // ignore
      }

      const html = await res.text();
      const $ = load(html);
      const title = $("title").first().text().trim() || undefined;
      const links: URL[] = [];
      $("a[href]").each((_, el) => {
        const href = $(el).attr("href");
        try {
          const u = new URL(href || "", current);
          u.hash = "";
          u.search = "";
          links.push(u);
        } catch {
          // ignore
        }
      });

      addPage(current, title);

      for (const link of links) {
        if (!matchesHost(link.hostname, rootHost)) continue;
        const childPath = cleanPath(link);
        const childDepth = pathSegments(childPath).length;
        if (childDepth > depthLimit) continue;
        if (pages.size >= MAX_PAGES) break;
        addPage(link);
        queue.push(link);
      }
    } catch {
      // ignore fetch errors
    }
  }

  // Build edges by path hierarchy
  // Ensure ancestor placeholders exist
  const ensureAncestors = (p: string) => {
    let parent = parentPath(p);
    while (parent) {
      if (!pages.has(parent)) {
        const url = new URL(parent, rootUrl);
        pages.set(parent, {
          path: parent,
          url,
          title: parent === "/" ? rootHost : parent.split("/").pop() || parent,
          statusCode: 404,
          unreachable: true,
        });
      }
      parent = parentPath(parent);
    }
  };

  Array.from(pages.keys()).forEach((p) => ensureAncestors(p));

  const flowNodes: FlowNode[] = [];
  const flowEdges: FlowEdge[] = [];

  const allPaths = Array.from(pages.keys());
  if (allPaths.length === 1) {
    return {
      domain: rootUrl.hostname,
      nodes: [
        {
          id: "root",
          data: { label: rootUrl.hostname, path: "/", isRoot: true },
          position: { x: 0, y: 0 },
          type: "card",
        },
        {
          id: "node-empty",
          data: { label: "Keine Links gefunden", path: "/" },
          position: { x: 0, y: 0 },
          type: "card",
        },
      ],
      edges: [
        {
          id: "e-root-empty",
          source: "root",
          target: "node-empty",
          type: "step",
          style: { stroke: "#b7c7ff", strokeWidth: 2 },
        },
      ],
    };
  }

  allPaths.forEach((path) => {
    const info = pages.get(path)!;
    const segs = pathSegments(path);
    const depth = segs.length;
    const label =
      info.title || (segs.length ? segs[segs.length - 1] : rootUrl.hostname) || "Page";
    const nodeId = makeNodeId(path);

    flowNodes.push({
      id: nodeId,
      data: {
        label: label.length > 40 ? `${label.slice(0, 40)}…` : label,
        path,
        isRoot: depth === 0,
        statusCode: info.statusCode,
        unreachable: info.unreachable,
      },
      position: { x: 0, y: 0 },
      type: "card",
    });

    const parent = parentPath(path);
    if (parent) {
      const parentId = makeNodeId(parent);
      flowEdges.push({
        id: `e-${parentId}-${nodeId}`,
        source: parentId,
        target: nodeId,
        type: "step",
        style: { stroke: "#b7c7ff", strokeWidth: 2 },
      });
    }
  });

  return {
    domain: rootHost,
    nodes: flowNodes,
    edges: flowEdges,
  };
}
