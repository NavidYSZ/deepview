"use client";

import dagre from "dagre";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Edge,
  Handle,
  Node,
  NodeProps,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";

type FlowNode = Node<{
  label: string;
  path?: string;
  isRoot?: boolean;
  depth?: number;
  hasChildren?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  isNew?: boolean;
  statusCode?: number;
  unreachable?: boolean;
  metaTitle?: string;
  metaDescription?: string;
  h1?: string;
  cardHeight?: number;
  cardWidth?: number;
}>;
type FlowEdge = Edge;

type Project = {
  id: number;
  name: string;
  slug: string;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

type Domain = {
  id: number;
  projectId: number;
  hostname: string;
  isPrimary: boolean;
  createdAt: string;
};

type ProjectFeature = {
  projectId: number;
  feature: string;
  enabled: boolean;
  config: Record<string, unknown>;
};

type Snapshot = {
  id: number;
  projectId: number;
  domainId: number | null;
  source: string;
  schemaVersion: number;
  meta: Record<string, unknown>;
  createdAt: string;
};

type SnapshotPayload = {
  snapshot: Snapshot;
  nodes: FlowNode[];
  edges: FlowEdge[];
  domain: string;
};

type ProjectSummary = {
  project: Project;
  primaryDomain?: string;
  latestSnapshot?: { id: number; source: string; createdAt: string };
};

type ProjectsResponse = {
  projects: ProjectSummary[];
  error?: string;
};

type ProjectDetailResponse = {
  project: Project;
  domains: Domain[];
  features: ProjectFeature[];
  latestSnapshot?: SnapshotPayload | null;
  error?: string;
};

type CrawlResponse = {
  project: Project;
  domain: Domain;
  snapshot: Snapshot;
  nodes: FlowNode[];
  edges: FlowEdge[];
  error?: string;
};

type Keyword = {
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

type KeywordsResponse = {
  keywords: Keyword[];
  error?: string;
};

type KeywordImportResponse = {
  import: { id: number };
  created: number;
  keywords: Keyword[];
  error?: string;
};

const stripWww = (host: string) => host.replace(/^www\./i, "");

const CARD_WIDTH = 220;
const CARD_MIN_HEIGHT = 120;

const normalizePathValue = (value?: string | null) => {
  const trimmed = (value || "").trim();
  if (!trimmed) return "/";
  let path = trimmed;
  const hashIndex = path.indexOf("#");
  if (hashIndex >= 0) {
    path = path.slice(0, hashIndex);
  }
  const queryIndex = path.indexOf("?");
  if (queryIndex >= 0) {
    path = path.slice(0, queryIndex);
  }
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }
  return path || "/";
};

const toolbarPlaceholders = ["↔", "🔍", "⟳", "◇", "⚡", "≡"];

const CardNode = ({ data, isConnectable }: NodeProps<FlowNode["data"]>) => {
  const isError = data?.unreachable || (data?.statusCode ?? 200) >= 400;
  const borderColor = isError ? "#ef4444" : data?.isRoot ? "#8f6cff" : "#2f6bff";
  const showToggle = data?.hasChildren;
  const cardHeight = Math.max(data?.cardHeight || 0, CARD_MIN_HEIGHT);

  return (
    <div className="relative">
      <div
        className={`group flex w-full flex-col rounded-2xl bg-white px-4 py-3 shadow-[0_8px_24px_rgba(47,107,255,0.08)] ${
          data?.isNew ? "animate-[fade-in-up_0.24s_ease]" : ""
        }`}
        style={{
          border: `2px solid ${borderColor}`,
          minHeight: cardHeight,
          width: CARD_WIDTH,
        }}
      >
        <div className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[#2f6bff]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#2f6bff]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#2f6bff]" />
          {isError && (
            <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-[#ef4444] text-[10px] font-bold text-white">
              !
            </span>
          )}
        </div>
        <div className="mt-2 text-base font-semibold leading-tight text-[#1b2559]">
          {data?.label || "Page"}
        </div>
        {data?.path && (
          <div className="mt-1 max-w-full break-all text-[10px] uppercase leading-tight tracking-[0.18em] text-slate-400">
            {data.path}
          </div>
        )}
        <Handle
          type="target"
          position={Position.Top}
          className="!h-2 !w-2 !bg-transparent"
          isConnectable={isConnectable}
        />
        <Handle
          type="source"
          position={Position.Bottom}
          className="!h-2 !w-2 !bg-transparent"
          isConnectable={isConnectable}
        />
      </div>
      {showToggle && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            data?.onToggle?.();
          }}
          className="absolute left-1/2 top-full -mt-2 -translate-x-1/2 rounded-full bg-white px-2 py-1 text-sm leading-none text-slate-700 shadow-md ring-1 ring-slate-200 transition hover:bg-slate-50"
        >
          <span
            className={`inline-block transition-transform ${
              data?.expanded ? "rotate-180" : "rotate-0"
            }`}
          >
            ▼
          </span>
        </button>
      )}
    </div>
  );
};

export default function HomePage() {
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [domainInput, setDomainInput] = useState("");
  const [activeDomain, setActiveDomain] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusVisible, setStatusVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingProject, setLoadingProject] = useState(false);
  const [depth, setDepth] = useState(5);
  const [depthOpen, setDepthOpen] = useState(false);
  const [fullNodes, setFullNodes] = useState<FlowNode[]>([]);
  const [fullEdges, setFullEdges] = useState<FlowEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [features, setFeatures] = useState<ProjectFeature[]>([]);
  const [activeSnapshot, setActiveSnapshot] = useState<Snapshot | null>(null);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [keywordsByPath, setKeywordsByPath] = useState<Record<string, Keyword[]>>({});
  const [loadingKeywords, setLoadingKeywords] = useState(false);
  const [uploadingKeywords, setUploadingKeywords] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDomain, setNewProjectDomain] = useState("");
  const expandedRef = useRef<Set<string>>(new Set());
  const showAllRef = useRef(false);
  const [showAll, setShowAll] = useState(false);
  const prevVisibleRef = useRef<Set<string>>(new Set());
  const keywordFileInputRef = useRef<HTMLInputElement | null>(null);

  const nodeTypes = useMemo(() => ({ card: CardNode }), []);
  const hasGraph = nodes.length > 0;
  const depthOptions = useMemo(() => [1, 2, 3, 4, 5], []);
  const defaultEdgeOptions = useMemo(
    () => ({
      type: "step" as const,
      style: { stroke: "#b7c7ff", strokeWidth: 2 },
      interactionWidth: 20,
      pathOptions: { borderRadius: 14 },
    }),
    []
  );
  const keywordSummaries = useMemo(
    () =>
      Object.entries(keywordsByPath)
        .map(([path, list]) => ({
          path,
          count: list.length,
          sample: list.slice(0, 3),
        }))
        .sort((a, b) => b.count - a.count),
    [keywordsByPath]
  );
  const keywordsForSelected = useMemo(() => {
    if (!selectedNode) return [];
    const key = normalizePathValue(selectedNode.data?.path || "/");
    return keywordsByPath[key] || [];
  }, [keywordsByPath, selectedNode]);

  const showStatus = useCallback((message: string) => {
    setStatusMessage(message);
  }, []);

  useEffect(() => {
    if (!statusMessage) return;
    setStatusVisible(true);
    const hide = setTimeout(() => setStatusVisible(false), 2200);
    const clear = setTimeout(() => setStatusMessage(null), 3000);
    return () => {
      clearTimeout(hide);
      clearTimeout(clear);
    };
  }, [statusMessage]);

  const applyLayout = useCallback(
    (inputNodes: FlowNode[], inputEdges: FlowEdge[]) => {
      const estimateHeight = (node: FlowNode) => {
        const labelLen = node.data?.label?.length || 0;
        const pathLen = node.data?.path?.length || 0;
        const labelLines = Math.max(1, Math.ceil(labelLen / 22));
        const pathLines = pathLen ? Math.max(1, Math.ceil(pathLen / 26)) : 0;
        const base = 70;
        return Math.max(CARD_MIN_HEIGHT, base + labelLines * 18 + pathLines * 14);
      };

      const maxHeight =
        inputNodes.length > 0
          ? Math.max(CARD_MIN_HEIGHT, ...inputNodes.map((n) => estimateHeight(n)))
          : CARD_MIN_HEIGHT;

      const g = new dagre.graphlib.Graph();
      g.setDefaultEdgeLabel(() => ({}));
      g.setGraph({
        rankdir: "TB",
        nodesep: 40,
        ranksep: 140,
        marginx: 60,
        marginy: 40,
      });

      inputNodes.forEach((node) => {
        g.setNode(node.id, { width: CARD_WIDTH, height: maxHeight });
      });
      inputEdges.forEach((edge) => {
        g.setEdge(edge.source, edge.target);
      });

      dagre.layout(g);

      const getDepth = (node: FlowNode) => {
        if (node.data?.isRoot) return 0;
        const path = node.data?.path || "/";
        const segs = path === "/" ? [] : path.replace(/^\//, "").split("/").filter(Boolean);
        return segs.length;
      };

      const layoutedNodes = inputNodes.map((node) => {
        const pos = g.node(node.id);
        return {
          ...node,
          position: {
            x: pos.x - CARD_WIDTH / 2,
            y: pos.y - maxHeight / 2,
          },
          data: { ...node.data, depth: getDepth(node), cardHeight: maxHeight, cardWidth: CARD_WIDTH },
          className: [node.className, "flow-card"].filter(Boolean).join(" "),
        };
      });

      const layoutedEdges = inputEdges.map((edge) => ({
        ...edge,
        type: edge.type || "step",
      }));

      const childrenByParent = inputEdges.reduce<Record<string, string[]>>((acc, edge) => {
        acc[edge.source] = acc[edge.source] || [];
        acc[edge.source].push(edge.target);
        return acc;
      }, {});

      const layouted = layoutedNodes.map((n) => ({ ...n }));
      const edgesWithStyle = layoutedEdges.map((e) => ({ ...e }));

      const wrappedTargets = new Set<string>();
      const xGap = 240;
      const yGap = maxHeight + 80;

      Object.entries(childrenByParent).forEach(([parentId, childIds]) => {
        if (childIds.length <= 4) return;
        const parentNode = layouted.find((n) => n.id === parentId);
        if (!parentNode) return;
        const parentDepth = parentNode.data?.depth ?? 0;
        if (parentDepth <= 1) return;

        const centerX = parentNode.position.x + 100;
        const baseY = parentNode.position.y + maxHeight + 80;
        const rows = Math.ceil(childIds.length / 4);

        childIds.forEach((childId, idx) => {
          const row = Math.floor(idx / 4);
          const col = idx % 4;
          const rowCount =
            row === rows - 1 && childIds.length % 4 !== 0 ? childIds.length % 4 : 4;
          const startX = centerX - ((rowCount - 1) * xGap) / 2;

          const targetIndex = layouted.findIndex((n) => n.id === childId);
          if (targetIndex >= 0) {
            layouted[targetIndex] = {
              ...layouted[targetIndex],
              position: {
                x: startX + col * xGap - 100,
                y: baseY + row * yGap - 60,
              },
            };
            wrappedTargets.add(childId);
          }
        });
      });

      edgesWithStyle.forEach((edge, index) => {
        if (wrappedTargets.has(edge.target)) {
          edgesWithStyle[index] = {
            ...edge,
            style: { stroke: "rgba(0,0,0,0.35)", strokeWidth: 2 },
          };
        }
      });

      return { nodes: layouted, edges: edgesWithStyle };
    },
    []
  );

  const depthFromNode = (node: FlowNode) => {
    if (node.data?.isRoot) return 0;
    const path = node.data?.path || "/";
    if (path === "/") return 0;
    return path.replace(/^\//, "").split("/").filter(Boolean).length;
  };

  const rebuildGraph = useCallback(
    (srcNodes: FlowNode[], srcEdges: FlowEdge[], expandedSet: Set<string>, viewAll: boolean) => {
      const parentMap: Record<string, string | undefined> = {};
      const childrenMapFull: Record<string, string[]> = {};

      srcEdges.forEach((edge) => {
        parentMap[edge.target] = edge.source;
        childrenMapFull[edge.source] = childrenMapFull[edge.source] || [];
        childrenMapFull[edge.source].push(edge.target);
      });

      const isVisible = (nodeId: string) => {
        if (viewAll) return true;
        const node = srcNodes.find((n) => n.id === nodeId);
        if (!node) return false;
        const depth = depthFromNode(node);
        if (depth <= 1) return true;

        let currentParent = parentMap[nodeId];
        while (currentParent) {
          if (!expandedSet.has(currentParent)) return false;
          const parentNode = srcNodes.find((n) => n.id === currentParent);
          const parentDepth = parentNode ? depthFromNode(parentNode) : 0;
          if (parentDepth <= 1) return true;
          currentParent = parentMap[currentParent];
        }
        return false;
      };

      const visibleNodes = srcNodes.filter((node) => isVisible(node.id));
      const visibleIds = new Set(visibleNodes.map((n) => n.id));
      const visibleEdges = srcEdges.filter(
        (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)
      );

        const decoratedNodes = visibleNodes.map((node) => ({
          ...node,
          data: {
            ...node.data,
            depth: depthFromNode(node),
            hasChildren: (childrenMapFull[node.id] || []).length > 0,
            expanded: expandedSet.has(node.id),
            isNew: !prevVisibleRef.current.has(node.id),
            onToggle: () => {
              const nextExpanded = new Set(expandedRef.current);
              if (nextExpanded.has(node.id)) {
                nextExpanded.delete(node.id);
              } else {
                nextExpanded.add(node.id);
              }
              expandedRef.current = nextExpanded;
              showAllRef.current = false;
              setShowAll(false);
              setSelectedNode((prev) => {
                if (prev && prev.id === node.id) {
                  return { ...node };
                }
                return prev;
              });
              rebuildGraph(srcNodes, srcEdges, nextExpanded, false);
            },
          },
        }));

      const layout = applyLayout(decoratedNodes, visibleEdges);
      setNodes(layout.nodes);
      setEdges(layout.edges);
      prevVisibleRef.current = visibleIds;
    },
    [applyLayout]
  );

  const loadKeywords = useCallback(
    async (slug: string) => {
      setLoadingKeywords(true);
      try {
        const res = await fetch(`/api/projects/${slug}/keywords`, { cache: "no-store" });
        const data: KeywordsResponse = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || "Konnte Keywords nicht laden.");
        }
        const byPath: Record<string, Keyword[]> = {};
        (data.keywords || []).forEach((kw) => {
          const key = normalizePathValue(kw.path);
          byPath[key] = byPath[key] || [];
          byPath[key].push(kw);
        });
        setKeywordsByPath(byPath);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Konnte Keywords nicht laden.";
        showStatus(message);
      } finally {
        setLoadingKeywords(false);
      }
    },
    [showStatus]
  );

  const loadProject = useCallback(
    async (slug: string) => {
      setLoadingProject(true);
      setProjectMenuOpen(false);
      try {
        setKeywordsByPath({});
        const res = await fetch(`/api/projects/${slug}`, { cache: "no-store" });
        const data: ProjectDetailResponse = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || "Konnte Projekt nicht laden.");
        }

        setActiveProject(data.project);
        setDomains(data.domains || []);
        setFeatures(data.features || []);

        const primaryDomain = (data.domains || []).find((d) => d.isPrimary) || data.domains?.[0];
        setDomainInput(primaryDomain?.hostname || "");
        setActiveDomain(primaryDomain?.hostname || null);

        expandedRef.current = new Set();
        prevVisibleRef.current = new Set();
        showAllRef.current = false;
        setShowAll(false);
        setSelectedNode(null);

        if (data.latestSnapshot) {
          const { nodes: latestNodes, edges: latestEdges, domain, snapshot } = data.latestSnapshot;
          setFullNodes(latestNodes || []);
          setFullEdges(latestEdges || []);
          setActiveSnapshot(snapshot);
          setActiveDomain(domain || primaryDomain?.hostname || null);
          rebuildGraph(latestNodes || [], latestEdges || [], new Set(), false);
          showStatus("Letzte Karte geladen.");
        } else {
          setFullNodes([]);
          setFullEdges([]);
          setNodes([]);
          setEdges([]);
          setActiveSnapshot(null);
          setSelectedNode(null);
          showStatus("Noch keine Karte gespeichert.");
        }

        await loadKeywords(data.project.slug);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Konnte Projekt nicht laden.";
        showStatus(message);
      } finally {
        setLoadingProject(false);
      }
    },
    [loadKeywords, rebuildGraph, showStatus]
  );

  const loadProjects = useCallback(
    async (autoSelect = true) => {
      setLoadingProjects(true);
      try {
        const res = await fetch("/api/projects", { cache: "no-store" });
        const data: ProjectsResponse = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || "Konnte Projekte nicht laden.");
        }

        setProjects(data.projects || []);
        if (!data.projects?.length) {
          setActiveProject(null);
          setDomains([]);
          setFeatures([]);
          setActiveSnapshot(null);
          setFullNodes([]);
          setFullEdges([]);
          setNodes([]);
          setEdges([]);
          setActiveDomain(null);
          setDomainInput("");
          setSelectedNode(null);
          setKeywordsByPath({});
          showStatus("Lege ein Projekt an, um zu starten.");
        } else if (autoSelect && !activeProject) {
          await loadProject(data.projects[0].project.slug);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Konnte Projekte nicht laden.";
        showStatus(message);
      } finally {
        setLoadingProjects(false);
      }
    },
    [activeProject, loadProject, showStatus]
  );

  useEffect(() => {
    loadProjects(true);
  }, [loadProjects]);

  const handleCreateProject = async (name: string, domain: string) => {
    const trimmedName = name.trim();
    const trimmedDomain = domain.trim();
    if (!trimmedName) {
      showStatus("Projektname wird benötigt.");
      return;
    }
    if (!trimmedDomain) {
      showStatus("Bitte Domain angeben.");
      return;
    }

    setLoadingProjects(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, domain: trimmedDomain }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Konnte Projekt nicht anlegen.");
      }
      showStatus("Projekt angelegt.");
      setNewProjectOpen(false);
      setNewProjectName("");
      setNewProjectDomain("");
      await loadProjects(false);
      await loadProject(data.project.slug);
      setDomainInput(data.domain.hostname);
      setOverviewOpen(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Konnte Projekt nicht anlegen.";
      showStatus(message);
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleCrawl = async () => {
    const domainToUse =
      domainInput.trim() ||
      domains.find((d) => d.isPrimary)?.hostname ||
      domains[0]?.hostname ||
      "";

    if (!domainToUse) {
      showStatus("Bitte eine Domain eingeben.");
      return;
    }

    const deriveHostname = (input: string) => {
      try {
        const prefixed = input.startsWith("http") ? input : `https://${input}`;
        return new URL(prefixed).hostname;
      } catch {
        return input;
      }
    };

    const host = deriveHostname(domainToUse);
    const hasProjectForHost = projects.some(
      (p) => p.primaryDomain && stripWww(p.primaryDomain) === stripWww(host)
    );

    if (!activeProject || !hasProjectForHost) {
      setNewProjectDomain(domainToUse);
      setNewProjectName(host);
      setOverviewOpen(true);
      setNewProjectOpen(true);
      showStatus("Projekt anlegen, um die Domain zu crawlen.");
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    try {
      const res = await fetch(`/api/projects/${activeProject.slug}/crawl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domainToUse, depth }),
      });

      const data: CrawlResponse = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Fehler beim Crawlen.");
      }

      setFullNodes(data.nodes || []);
      setFullEdges(data.edges || []);
      const collapsed = new Set<string>();
      expandedRef.current = collapsed;
      prevVisibleRef.current = new Set();
      showAllRef.current = false;
      setShowAll(false);
      rebuildGraph(data.nodes || [], data.edges || [], collapsed, false);
      setActiveSnapshot(data.snapshot);
      setActiveDomain(data.domain.hostname);
      setDomainInput(data.domain.hostname);
      setSelectedNode(null);
      showStatus(`Struktur gespeichert (Tiefe ${depth}).`);

      const nextDomains = [...domains];
      const exists = nextDomains.find((d) => d.id === data.domain.id);
      if (!exists) {
        nextDomains.push(data.domain);
      }
      setDomains(
        nextDomains.map((d) =>
          d.id === data.domain.id ? { ...d, isPrimary: true } : { ...d, isPrimary: false }
        )
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fehler beim Crawlen.";
      showStatus(message);
    } finally {
      setLoading(false);
      setDepthOpen(false);
    }
  };

  const handleKeywordUpload = async (file: File | null) => {
    if (!file) return;
    if (!activeProject) {
      showStatus("Bitte zuerst ein Projekt auswählen.");
      return;
    }
    setUploadingKeywords(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("source", "upload");
      if (activeDomain) {
        formData.append("domain", activeDomain);
      }
      const res = await fetch(`/api/projects/${activeProject.slug}/keywords`, {
        method: "POST",
        body: formData,
      });
      const data: KeywordImportResponse = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Fehler beim Keyword-Upload.");
      }
      await loadKeywords(activeProject.slug);
      showStatus(`${data.created || 0} Keywords gespeichert.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Fehler beim Keyword-Upload.";
      showStatus(message);
    } finally {
      setUploadingKeywords(false);
      if (keywordFileInputRef.current) {
        keywordFileInputRef.current.value = "";
      }
    }
  };

  const toggleShowAll = () => {
    const next = !showAll;
    if (!fullNodes.length) {
      setShowAll(next);
      expandedRef.current = new Set();
      showAllRef.current = next;
      showStatus(next ? "Alle Ebenen sichtbar." : "Nur erste Ebene sichtbar.");
      return;
    }

    if (next) {
      const expandedAll = new Set(fullNodes.map((n) => n.id));
      expandedRef.current = expandedAll;
      showAllRef.current = true;
      setShowAll(true);
      rebuildGraph(fullNodes, fullEdges, expandedAll, true);
      showStatus("Alle Ebenen sichtbar.");
    } else {
      const collapsed = new Set<string>();
      expandedRef.current = collapsed;
      showAllRef.current = false;
      setShowAll(false);
      rebuildGraph(fullNodes, fullEdges, collapsed, false);
      showStatus("Nur erste Ebene sichtbar.");
    }
  };

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#f9fbff] text-slate-900">
      {statusMessage && (
        <div
          className={`pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 transition-all duration-500 ${
            statusVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
          }`}
        >
          <div className="pointer-events-auto rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-md ring-1 ring-slate-200">
            {statusMessage}
          </div>
        </div>
      )}

      <div className="absolute left-6 top-6 z-10 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f0e8ff] text-xl">
          🐙
        </div>
        <div className="leading-tight">
          <p className="text-lg font-semibold">Deepview</p>
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
            {activeProject?.name || "Kein Projekt"}
          </p>
        </div>
        <div className="relative">
          <button
            onClick={() => setProjectMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-100 transition hover:bg-slate-50"
          >
            {activeProject ? activeProject.name : "Projekt wählen"}
            <span className={`transition-transform ${projectMenuOpen ? "rotate-180" : "rotate-0"}`}>
              ▼
            </span>
          </button>
          {projectMenuOpen && (
            <div className="absolute z-10 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
              {projects.map((item) => (
                <button
                  key={item.project.id}
                  onClick={() => loadProject(item.project.slug)}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  <div className="flex flex-col">
                    <span>{item.project.name}</span>
                    <span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                      {item.primaryDomain || "ohne Domain"}
                    </span>
                  </div>
                  {item.project.slug === activeProject?.slug && (
                    <span className="text-xs text-[#2f6bff]">Aktiv</span>
                  )}
                </button>
              ))}
              <button
                onClick={() => {
                  setProjectMenuOpen(false);
                  setOverviewOpen(true);
                  setNewProjectOpen(true);
                }}
                className="mt-2 flex w-full items-center justify-center rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                + Neues Projekt
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="absolute right-6 top-6 z-10 flex items-center gap-3">
        {features.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {features.map((f) => (
              <span
                key={f.feature}
                className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                  f.enabled ? "bg-white text-slate-700 ring-1 ring-slate-200" : "bg-slate-100 text-slate-400"
                }`}
              >
                {f.feature}
              </span>
            ))}
          </div>
        )}
        <button
          className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-100"
          onClick={() => showStatus("Bereits automatisch gespeichert.")}
        >
          Save
        </button>
        <button className="rounded-full bg-white px-3 py-2 text-lg shadow-sm ring-1 ring-slate-100">
          🔍
        </button>
        <button
          className={`rounded-full px-3 py-2 text-lg shadow-sm ring-1 ring-slate-100 ${
            showAll ? "bg-slate-900 text-white" : "bg-white text-slate-700"
          }`}
          onClick={toggleShowAll}
          aria-label="Alle Ebenen umschalten"
        >
          🖥
        </button>
        <button
          className="rounded-full bg-white px-3 py-2 text-lg shadow-sm ring-1 ring-slate-100"
          onClick={() => showStatus("Settings folgen bald.")}
          aria-label="Settings"
        >
          ☰
        </button>
      </div>

      <div className="absolute inset-0 pt-20 pb-28">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          minZoom={0.3}
          maxZoom={2}
          fitViewOptions={{ padding: 0.4 }}
          proOptions={{ hideAttribution: true }}
          className="rounded-2xl"
          onNodeClick={(_, node) => setSelectedNode(node as FlowNode)}
          onPaneClick={() => setSelectedNode(null)}
        >
          <Background gap={26} color="#e7ecfb" />
        </ReactFlow>

        {!hasGraph && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 w-full max-w-xl -translate-x-1/2 -translate-y-1/2 text-center text-sm text-slate-500">
            <p className="text-lg font-semibold text-slate-700">
              {activeProject
                ? "Gib eine Domain ein, um die erste Ebene zu sehen."
                : "Lege zuerst ein Projekt mit Domain an."}
            </p>
            <p className="mt-2 text-slate-500">
              Wir crawlen die gewählte Klicktiefe (1-5), speichern das Ergebnis in SQLite
              projektspezifisch und zeigen es hier als Karte an.
            </p>
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-12 mx-auto flex max-w-2xl items-center justify-center px-4">
        <div className="pointer-events-auto flex w-full items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-3 shadow-xl">
          <input
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            placeholder="z. B. example.com"
            className="flex-1 border-none text-base focus:outline-none"
          />
          <div className="relative flex items-center gap-2">
            <button
              onClick={handleCrawl}
              disabled={loading || !activeProject}
              className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70"
            >
              {loading ? "Crawle..." : "Crawl"}
            </button>
            <div className="relative">
              <button
                onClick={() => setDepthOpen((v) => !v)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
                aria-label="Klicktiefe wählen"
              >
                {depth === 5 ? "∞" : depth}
              </button>
              {depthOpen && (
                <div className="absolute bottom-12 left-1/2 z-10 w-16 -translate-x-1/2 rounded-2xl border border-slate-200 bg-white py-1 shadow-lg">
                  {depthOptions.map((option) => (
                    <button
                      key={option}
                      onClick={() => {
                        setDepth(option);
                        setDepthOpen(false);
                      }}
                      className={`flex w-full items-center justify-center px-2 py-1 text-sm font-semibold transition hover:bg-slate-100 ${
                        option === depth ? "text-slate-900" : "text-slate-600"
                      }`}
                    >
                      {option === 5 ? "∞" : option}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => {
              if (activeProject) {
                loadProject(activeProject.slug);
              } else {
                loadProjects(true);
              }
            }}
            className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          >
            {loadingProjects || loadingProject ? "Lade..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="absolute left-6 bottom-6 flex items-center">
        <button
          onClick={() => setOverviewOpen((v) => !v)}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[#8f6cff] text-xl text-white shadow-lg shadow-[#8f6cff]/30 transition hover:brightness-105"
          aria-label="Projektübersicht"
        >
          🗂
        </button>
      </div>

      <div className="absolute right-6 bottom-6 flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-500 shadow-md ring-1 ring-slate-200">
        {toolbarPlaceholders.map((item) => (
          <span
            key={item}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100"
          >
            {item}
          </span>
        ))}
      </div>

      <div
        className={`pointer-events-none fixed left-6 top-20 bottom-6 w-[420px] max-w-full transform rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200 transition-all duration-300 ${
          overviewOpen ? "translate-x-0 opacity-100" : "-translate-x-[110%] opacity-0"
        }`}
        style={{ willChange: "transform, opacity" }}
      >
        <div className="pointer-events-auto flex h-full flex-col gap-4 overflow-y-auto p-6">
          <div className="flex items-start justify-between">
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
              Project Overview
            </div>
            <button
              onClick={() => setOverviewOpen(false)}
              className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
            >
              Schließen
            </button>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/80">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Aktives Projekt
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {activeProject?.name || "—"}
            </p>
            <p className="text-xs text-slate-500">
              Domain: {activeDomain || domains[0]?.hostname || "—"}
            </p>
            {activeSnapshot && (
              <p className="text-[11px] text-slate-500">
                Snapshot: {new Date(activeSnapshot.createdAt).toLocaleString()} •{" "}
                {activeDomain || "—"}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">Neues Projekt</p>
              <p className="text-xs text-slate-500">Lege ein weiteres Projekt mit Domain an.</p>
            </div>
            <button
              onClick={() => {
                setOverviewOpen(true);
                setNewProjectOpen(true);
              }}
              className="rounded-full bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              + Neu
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">Keywords</p>
              <p className="text-xs text-slate-500">
                Upload (CSV/TSV/XLSX), automatische URL-Zuordnung.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {loadingKeywords && <span className="text-xs text-slate-500">Lädt…</span>}
              <input
                ref={keywordFileInputRef}
                type="file"
                accept=".xlsx,.csv,.tsv"
                className="hidden"
                onChange={(e) => handleKeywordUpload(e.target.files?.[0] || null)}
              />
              <button
                onClick={() => keywordFileInputRef.current?.click()}
                disabled={!activeProject || uploadingKeywords}
                className={`rounded-full px-3 py-2 text-sm font-semibold shadow-sm ring-1 ring-slate-200 transition ${
                  uploadingKeywords
                    ? "bg-slate-100 text-slate-500"
                    : "bg-slate-900 text-white hover:bg-slate-800"
                } disabled:opacity-60`}
              >
                {uploadingKeywords ? "Lädt..." : "Upload"}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {keywordSummaries.length ? (
              keywordSummaries.map((item) => (
                <div
                  key={item.path}
                  className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/80"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-800">{item.path}</p>
                    <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                      {item.count} KW
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.sample.map((kw) => (
                      <span
                        key={`${kw.id}-${kw.term}`}
                        className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
                      >
                        {kw.term}
                      </span>
                    ))}
                    {item.count > item.sample.length && (
                      <span className="text-xs text-slate-500">
                        + {item.count - item.sample.length} weitere
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 ring-1 ring-slate-200/80">
                Noch keine Keywords hochgeladen.
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        className={`pointer-events-none fixed right-6 top-20 bottom-6 w-[420px] max-w-full transform rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200 transition-all duration-300 ${
          selectedNode ? "translate-x-0 opacity-100" : "translate-x-[110%] opacity-0"
        }`}
        style={{ willChange: "transform, opacity" }}
      >
        <div className="pointer-events-auto flex h-full flex-col gap-4 overflow-y-auto p-6">
          <div className="flex items-start justify-between">
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
              Page Details
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
            >
              Schließen
            </button>
          </div>
          {selectedNode ? (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                  Label
                </p>
                <p className="text-lg font-semibold text-slate-800">{selectedNode.data?.label}</p>
                {selectedNode.data?.path && (
                  <p className="text-xs text-slate-500">{selectedNode.data.path}</p>
                )}
              </div>
              <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200/80">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Meta Title
                </p>
                <p className="mt-1 text-sm text-slate-800">
                  {selectedNode.data?.metaTitle || "—"}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200/80">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Meta Description
                </p>
                <p className="mt-1 text-sm text-slate-800 leading-relaxed">
                  {selectedNode.data?.metaDescription || "—"}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200/80">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  H1
                </p>
                <p className="mt-1 text-sm text-slate-800">{selectedNode.data?.h1 || "—"}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200/80">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Keywords
                </p>
                {keywordsForSelected.length ? (
                  <div className="mt-2 flex flex-col gap-2">
                    {keywordsForSelected.map((kw) => (
                      <div
                        key={kw.id}
                        className="rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-slate-200"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-800">{kw.term}</span>
                          <span className="text-[11px] text-slate-500">
                            {kw.position ? `Pos ${kw.position}` : ""}
                            {kw.volume
                              ? `${kw.position ? " • " : ""}SV ${kw.volume}`
                              : ""}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">{kw.path}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-slate-500">Keine Keywords für diese Seite.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              Keine Seite ausgewählt.
            </div>
          )}
        </div>
      </div>

      {newProjectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Neues Projekt
                </p>
                <p className="text-base font-semibold text-slate-900">Anlegen</p>
              </div>
              <button
                onClick={() => {
                  setNewProjectOpen(false);
                  setNewProjectName("");
                  setNewProjectDomain("");
                }}
                className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
              >
                Schließen
              </button>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Projektname
                </label>
                <input
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="z. B. Kunde A"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Domain
                </label>
                <input
                  value={newProjectDomain}
                  onChange={(e) => setNewProjectDomain(e.target.value)}
                  placeholder="example.com"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setNewProjectOpen(false);
                  setNewProjectName("");
                  setNewProjectDomain("");
                }}
                className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              >
                Abbrechen
              </button>
              <button
                onClick={() => handleCreateProject(newProjectName, newProjectDomain)}
                disabled={loadingProjects}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
              >
                {loadingProjects ? "Anlegen..." : "Projekt anlegen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
