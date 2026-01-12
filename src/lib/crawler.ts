import { load } from "cheerio";
import type { Edge, Node } from "reactflow";

type FlowNode = Node<{ label: string; path?: string; isRoot?: boolean }>;
type FlowEdge = Edge;

export type CrawlResult = {
  domain: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
};

export function normalizeDomain(input: string) {
  const trimmed = input.trim();
  const prefixed = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
  const url = new URL(prefixed);
  url.hash = "";
  url.search = "";
  url.pathname = "/";
  return url.toString().replace(/\/$/, "");
}

function normalizeHref(base: URL, href?: string | null) {
  if (!href) return null;
  if (href.startsWith("#")) return null;
  if (href.startsWith("mailto:") || href.startsWith("tel:")) return null;

  try {
    const url = new URL(href, base);
    url.hash = "";
    url.search = "";
    url.protocol = base.protocol;
    return url;
  } catch {
    return null;
  }
}

export async function crawlDomain(domain: string): Promise<CrawlResult> {
  const normalized = normalizeDomain(domain);
  const rootUrl = new URL(normalized);

  const response = await fetch(rootUrl.toString(), {
    headers: { "User-Agent": "DeepviewCrawler/0.1 (+https://example.com)" },
  });

  if (!response.ok) {
    throw new Error(`Fehler beim Laden der Seite (${response.status})`);
  }

  const html = await response.text();
  const $ = load(html);

  const seenPaths = new Set<string>();
  const children: { id: string; label: string; path: string }[] = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    const url = normalizeHref(rootUrl, href);
    if (!url) return;
    if (url.hostname !== rootUrl.hostname) return;

    const normalizedPath = url.pathname.replace(/\/$/, "") || "/";
    if (normalizedPath === "/") return; // skip root link

    if (seenPaths.has(normalizedPath)) return;
    seenPaths.add(normalizedPath);

    const text = $(el).text().trim() || normalizedPath.split("/").pop() || "Page";
    const label = text.length > 28 ? `${text.slice(0, 28)}…` : text || "Page";

    children.push({
      id: `node-${normalizedPath}`,
      label,
      path: normalizedPath,
    });
  });

  if (!children.length) {
    children.push({
      id: "node-empty",
      label: "Keine Links gefunden",
      path: "/",
    });
  }

  const rootNode: FlowNode = {
    id: "root",
    data: { label: rootUrl.hostname, path: "/", isRoot: true },
    position: { x: 0, y: 0 },
    type: "card",
  };

  const spacingX = 240;
  const y = 200;
  const startX = -((children.length - 1) * spacingX) / 2;

  const childNodes: FlowNode[] = children.map((child, index) => ({
    id: child.id,
    data: { label: child.label, path: child.path },
    position: { x: startX + index * spacingX, y },
    type: "card",
  }));

  const edges: FlowEdge[] = children.map((child, index) => ({
    id: `e-root-${index}`,
    source: "root",
    target: child.id,
    animated: false,
    style: { stroke: "#b7c7ff", strokeWidth: 2 },
  }));

  return {
    domain: rootUrl.hostname,
    nodes: [rootNode, ...childNodes],
    edges,
  };
}
