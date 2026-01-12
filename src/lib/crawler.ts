import { load } from "cheerio";
import type { Edge, Node } from "reactflow";

type FlowNode = Node<{ label: string; path?: string; isRoot?: boolean }>;
type FlowEdge = Edge;

type CrawledNode = {
  id: string;
  label: string;
  path: string;
  depth: number;
  parentId: string | null;
};

export type CrawlResult = {
  domain: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
};

const MAX_DEPTH = 5;

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

function cleanPath(url: URL) {
  return url.pathname.replace(/\/$/, "") || "/";
}

function makeNodeId(path: string) {
  if (path === "/") return "root";
  return `node-${path.replace(/[^a-zA-Z0-9-_]/g, "-") || "root"}`;
}

function layoutNodes(nodes: CrawledNode[]) {
  const grouped = nodes.reduce<Record<number, CrawledNode[]>>((acc, node) => {
    acc[node.depth] = acc[node.depth] || [];
    acc[node.depth].push(node);
    return acc;
  }, {});

  const yGap = 200;
  const xGap = 230;

  const flowNodes: FlowNode[] = [];

  Object.keys(grouped)
    .map((d) => Number(d))
    .sort((a, b) => a - b)
    .forEach((depth) => {
      const list = grouped[depth];
      const startX = -((list.length - 1) * xGap) / 2;
      list.forEach((node, index) => {
        flowNodes.push({
          id: node.id,
          data: {
            label: node.label,
            path: node.path,
            isRoot: depth === 0,
          },
          position: { x: startX + index * xGap, y: depth * yGap },
          type: "card",
        });
      });
    });

  return flowNodes;
}

export async function crawlDomain(
  domain: string,
  maxDepth: number = 1
): Promise<CrawlResult> {
  const normalized = normalizeDomain(domain);
  const rootUrl = new URL(normalized);
  const depthLimit = Math.min(Math.max(1, Math.floor(maxDepth)), MAX_DEPTH);

  const nodes: CrawledNode[] = [
    {
      id: "root",
      label: rootUrl.hostname,
      path: "/",
      depth: 0,
      parentId: null,
    },
  ];
  const edges: FlowEdge[] = [];

  const seenPaths = new Set<string>(["/"]);
  const queue: { url: URL; depth: number; nodeId: string }[] = [
    { url: rootUrl, depth: 0, nodeId: "root" },
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    if (current.depth >= depthLimit) {
      continue;
    }

    let html: string | null = null;
    try {
      const response = await fetch(current.url.toString(), {
        headers: { "User-Agent": "DeepviewCrawler/0.1 (+https://example.com)" },
      });
      if (!response.ok) {
        // Skip this branch but continue crawling others.
        continue;
      }
      html = await response.text();
    } catch {
      continue;
    }

    if (!html) continue;
    const $ = load(html);

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      const url = normalizeHref(rootUrl, href);
      if (!url) return;
      if (url.hostname !== rootUrl.hostname) return;

      const normalizedPath = cleanPath(url);
      if (normalizedPath === "/") return;
      if (seenPaths.has(normalizedPath)) return;

      seenPaths.add(normalizedPath);

      const text = $(el).text().trim() || normalizedPath.split("/").pop() || "Page";
      const label = text.length > 28 ? `${text.slice(0, 28)}…` : text || "Page";

      const id = makeNodeId(normalizedPath);
      const childDepth = current.depth + 1;
      nodes.push({
        id,
        label,
        path: normalizedPath,
        depth: childDepth,
        parentId: current.nodeId,
      });

      edges.push({
        id: `e-${current.nodeId}-${id}`,
        source: current.nodeId,
        target: id,
        type: "smoothstep",
        animated: false,
        style: { stroke: "#b7c7ff", strokeWidth: 2 },
      });

      if (childDepth < depthLimit) {
        queue.push({ url, depth: childDepth, nodeId: id });
      }
    });
  }

  if (nodes.length === 1) {
    const emptyId = "node-empty";
    nodes.push({
      id: emptyId,
      label: "Keine Links gefunden",
      path: "/",
      depth: 1,
      parentId: "root",
    });
    edges.push({
      id: `e-root-${emptyId}`,
      source: "root",
      target: emptyId,
      type: "smoothstep",
      animated: false,
      style: { stroke: "#b7c7ff", strokeWidth: 2 },
    });
  }

  return {
    domain: rootUrl.hostname,
    nodes: layoutNodes(nodes),
    edges,
  };
}
