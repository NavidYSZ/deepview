"use client";

import dagre from "dagre";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Edge,
  Handle,
  Node,
  NodeProps,
  PanOnScrollMode,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";

type FlowNode = Node<{
  label: string;
  path?: string;
  isRoot?: boolean;
  isGhost?: boolean;
  isManualPosition?: boolean;
  orderAfter?: string;
  depth?: number;
  hasChildren?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  onAddGhostDown?: () => void;
  onAddGhostRight?: () => void;
  onDeleteGhost?: () => void;
  isNew?: boolean;
  statusCode?: number;
  unreachable?: boolean;
  metaTitle?: string;
  metaDescription?: string;
  h1?: string;
  cardHeight?: number;
  cardWidth?: number;
  seoFlag?: "page1" | "threshold";
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

type NodeSuggestion = {
  id: number;
  projectId: number;
  domainId: number | null;
  path: string;
  field: "metaTitle" | "metaDescription" | "h1";
  value: string;
  createdAt: string;
};

type SuggestionsResponse = {
  suggestions: NodeSuggestion[];
  error?: string;
};

type SuggestionCreateResponse = {
  suggestion: NodeSuggestion;
  error?: string;
};

type GhostPage = {
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

type GhostsResponse = {
  ghosts: GhostPage[];
  error?: string;
};

const stripWww = (host: string) => host.replace(/^www\./i, "");

const CARD_WIDTH = 220;
const CARD_MIN_HEIGHT = 120;

const InfinityIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 12"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M3 6C3 3.79086 4.79086 2 7 2C9.20914 2 11 3.79086 12 6C13 8.20914 14.7909 10 17 10C19.2091 10 21 8.20914 21 6C21 3.79086 19.2091 2 17 2C14.7909 2 13 3.79086 12 6C11 8.20914 9.20914 10 7 10C4.79086 10 3 8.20914 3 6Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const GridIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <rect x="2" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
    <rect x="12" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
    <rect x="2" y="12" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
    <rect x="12" y="12" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

const TreeIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M12 4v4m0 0H7a2 2 0 0 0-2 2v1m7-3h5a2 2 0 0 1 2 2v1m-7 0v6m0-6H7m5 0h5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="18.5" r="1.7" stroke="currentColor" strokeWidth="1.4" />
    <circle cx="4.5" cy="12" r="1.7" stroke="currentColor" strokeWidth="1.4" />
    <circle cx="19.5" cy="12" r="1.7" stroke="currentColor" strokeWidth="1.4" />
    <circle cx="12" cy="4" r="1.7" stroke="currentColor" strokeWidth="1.4" />
  </svg>
);

const ArrowIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M7.5 4.5 13 10l-5.5 5.5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const EyeIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.7" />
  </svg>
);

const SearchIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.6" />
    <path d="m12.5 12.5 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const GhostNode = ({ data, isConnectable }: NodeProps<FlowNode["data"]>) => {
  const cardHeight = Math.max(data?.cardHeight || 0, CARD_MIN_HEIGHT);
  return (
    <div className="relative group">
      <div
        className="flex w-full flex-col rounded-2xl border-2 border-dashed border-slate-500/50 bg-white/80 px-4 py-3 text-slate-700 shadow-[0_8px_24px_rgba(0,0,0,0.05)]"
        style={{ minHeight: cardHeight, width: CARD_WIDTH }}
      >
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
          Ghost Page
        </div>
        <div className="mt-1 text-base font-semibold leading-tight text-slate-800">
          {data?.label || "Ghost Page"}
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
      <button
        onClick={(e) => {
          e.stopPropagation();
          data?.onAddGhostDown?.();
        }}
        className="absolute left-1/4 bottom-[-10px] -translate-x-1/2 rounded-full border border-dashed border-slate-400/70 bg-white/60 px-2 py-1 text-sm font-semibold text-slate-600 opacity-0 shadow-sm transition hover:opacity-100 group-hover:opacity-70"
      >
        +
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          data?.onAddGhostRight?.();
        }}
        className="absolute right-[-10px] top-1/2 -translate-y-1/2 rounded-full border border-dashed border-slate-400/70 bg-white/60 px-2 py-1 text-sm font-semibold text-slate-600 opacity-0 shadow-sm transition hover:opacity-100 group-hover:opacity-70"
      >
        +
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          data?.onDeleteGhost?.();
        }}
        className="absolute right-[-8px] top-[-8px] flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-red-400/70 bg-white/70 text-sm font-semibold text-red-600 opacity-0 shadow-sm transition hover:opacity-100 group-hover:opacity-80"
      >
        −
      </button>
    </div>
  );
};

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

const parentPathOf = (value?: string | null) => {
  const path = normalizePathValue(value);
  if (path === "/") return "/";
  const segments = path.replace(/^\/+/, "").split("/").filter(Boolean);
  if (segments.length <= 1) return "/";
  const parent = `/${segments.slice(0, -1).join("/")}`;
  return parent || "/";
};

const buildGhostEdges = (nodes: FlowNode[]) => {
  const pathToId = new Map<string, string>();
  nodes.forEach((n) => {
    const key = n.data?.isRoot ? "/" : normalizePathValue(n.data?.path || "");
    pathToId.set(key, n.id);
  });
  return nodes
    .filter((n) => n.data?.isGhost)
    .map<FlowEdge>((g) => {
      const parentPath = parentPathOf(g.data?.path);
      const sourceId = pathToId.get(parentPath) || "root";
      return {
        id: `ghost-edge-${sourceId}-${g.id}`,
        source: sourceId,
        target: g.id,
        type: "smoothstep",
        style: { stroke: "rgba(0,0,0,0.4)", strokeWidth: 2, strokeDasharray: "4 4" },
      };
  });
};

const reorderChildrenByOrderAfter = (childIds: string[], nodesById: Map<string, FlowNode>) => {
  const ids = [...childIds];
  let safety = 0;
  while (safety < ids.length * 2) {
    safety += 1;
    let moved = false;
    for (const id of ids) {
      const node = nodesById.get(id);
      const orderAfter = node?.data?.orderAfter;
      if (!orderAfter) continue;
      const targetIndex = ids.indexOf(orderAfter);
      const currentIndex = ids.indexOf(id);
      if (targetIndex >= 0 && currentIndex >= 0 && currentIndex !== targetIndex + 1) {
        ids.splice(currentIndex, 1);
        ids.splice(targetIndex + 1, 0, id);
        moved = true;
        break;
      }
    }
    if (!moved) break;
  }
  return ids;
};

const toolbarPlaceholders = ["↔", "🔍", "⟳", "◇", "⚡", "≡"];

const CardNode = ({ data, isConnectable }: NodeProps<FlowNode["data"]>) => {
  const isError = data?.unreachable || (data?.statusCode ?? 200) >= 400;
  const borderColor = isError ? "#ef4444" : data?.isRoot ? "#8f6cff" : "#2f6bff";
  const seoFlag = data?.seoFlag as "page1" | "threshold" | undefined;
  const seoBorder =
    seoFlag === "page1"
      ? "2px solid #d4a017"
      : seoFlag === "threshold"
      ? "2px dashed #d4a017"
      : null;
  const showToggle = data?.hasChildren && !data?.isRoot;
  const cardHeight = Math.max(data?.cardHeight || 0, CARD_MIN_HEIGHT);

  return (
    <div className="relative group">
      <div
        className={`group flex w-full flex-col rounded-2xl bg-white px-4 py-3 shadow-[0_8px_24px_rgba(47,107,255,0.08)] ${
          data?.isNew ? "animate-[fade-in-up_0.24s_ease]" : ""
        }`}
        style={{
          border: seoBorder || `2px solid ${borderColor}`,
          borderStyle: seoBorder?.includes("dashed") ? "dashed" : undefined,
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
      <button
        onClick={(e) => {
          e.stopPropagation();
          data?.onAddGhostDown?.();
        }}
        className="absolute left-1/4 bottom-[-10px] -translate-x-1/2 rounded-full border border-dashed border-slate-400/70 bg-white/60 px-2 py-1 text-sm font-semibold text-slate-600 opacity-0 shadow-sm transition hover:opacity-100 group-hover:opacity-70"
      >
        +
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          data?.onAddGhostRight?.();
        }}
        className="absolute right-[-10px] top-1/2 -translate-y-1/2 rounded-full border border-dashed border-slate-400/70 bg-white/60 px-2 py-1 text-sm font-semibold text-slate-600 opacity-0 shadow-sm transition hover:opacity-100 group-hover:opacity-70"
      >
        +
      </button>
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
  const [suggestionsByPath, setSuggestionsByPath] = useState<Record<string, NodeSuggestion[]>>({});
  const [editingField, setEditingField] = useState<"metaTitle" | "metaDescription" | "h1" | null>(null);
  const [suggestionInput, setSuggestionInput] = useState("");
  const [keywordSort, setKeywordSort] = useState<"position" | "volume">("position");
  const [autoCrawlPendingDomain, setAutoCrawlPendingDomain] = useState<string | null>(null);
  const [ghostNodes, setGhostNodes] = useState<FlowNode[]>([]);
  const [newGhostLabel, setNewGhostLabel] = useState("");
  const [newGhostPath, setNewGhostPath] = useState("");
  const handleAddGhostRelativeRef = useRef<((node: FlowNode, direction: "down" | "right") => void) | null>(null);
  const rebuildGraphRef = useRef<
    ((srcNodes: FlowNode[], srcEdges: FlowEdge[], expandedSet: Set<string>, viewAll: boolean) => void) | null
  >(null);
  const expandedRef = useRef<Set<string>>(new Set());
  const showAllRef = useRef(false);
  const [showAll, setShowAll] = useState(false);
  const [viewMode, setViewMode] = useState<"tree" | "cards">("tree");
  const [seoMode, setSeoMode] = useState(false);
  const [cardParentId, setCardParentId] = useState<string>("root");
  const [cardHistory, setCardHistory] = useState<string[]>([]);
  const [cardTransitionPhase, setCardTransitionPhase] = useState<"idle" | "out" | "in">("idle");
  const prevVisibleRef = useRef<Set<string>>(new Set());
  const keywordFileInputRef = useRef<HTMLInputElement | null>(null);

  const nodeTypes = useMemo(() => ({ card: CardNode, ghost: GhostNode }), []);
  const hasGraph = fullNodes.length > 0;
  const depthOptions = useMemo(() => [1, 2, 3, 4, 5], []);
  const defaultEdgeOptions = useMemo(
    () => ({
      type: "smoothstep" as const,
      style: { stroke: "#b7c7ff", strokeWidth: 2 },
      interactionWidth: 20,
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
    const list = keywordsByPath[key] || [];
    const sorted = [...list];
    if (keywordSort === "position") {
      sorted.sort((a, b) => {
        const ap = a.position ?? Infinity;
        const bp = b.position ?? Infinity;
        return ap - bp;
      });
    } else {
      sorted.sort((a, b) => {
        const av = a.volume ?? -1;
        const bv = b.volume ?? -1;
        return bv - av;
      });
    }
    return sorted;
  }, [keywordSort, keywordsByPath, selectedNode]);
  const suggestionsForSelected = useMemo(() => {
    if (!selectedNode) return [];
    const key = normalizePathValue(selectedNode.data?.path || "/");
    return suggestionsByPath[key] || [];
  }, [selectedNode, suggestionsByPath]);

  const getSeoFlag = useCallback(
    (path?: string | null): "page1" | "threshold" | undefined => {
      const list = keywordsByPath[normalizePathValue(path || "/")] || [];
      const hasPage1 = list.some((k) => {
        const pos = k.position ?? 9999;
        return pos > 0 && pos <= 10;
      });
      if (hasPage1) return "page1";
      const hasThreshold = list.some((k) => {
        const pos = k.position ?? 9999;
        return pos > 10 && pos <= 20;
      });
      return hasThreshold ? "threshold" : undefined;
    },
    [keywordsByPath]
  );

  const nodesById = useMemo(() => new Map(fullNodes.map((n) => [n.id, n])), [fullNodes]);
  const effectiveEdges = useMemo(() => [...fullEdges, ...buildGhostEdges(fullNodes)], [fullEdges, fullNodes]);
  const childrenByParent = useMemo(() => {
    const map: Record<string, FlowNode[]> = {};
    effectiveEdges.forEach((edge) => {
      const child = nodesById.get(edge.target);
      if (!child) return;
      map[edge.source] = map[edge.source] || [];
      map[edge.source].push(child);
    });
    Object.entries(map).forEach(([parentId, list]) => {
      const orderedIds = reorderChildrenByOrderAfter(
        list.map((n) => n.id),
        nodesById
      );
      map[parentId] = orderedIds
        .map((id) => nodesById.get(id))
        .filter(Boolean) as FlowNode[];
    });
    return map;
  }, [effectiveEdges, nodesById]);

  const currentCardCluster = useMemo(() => childrenByParent[cardParentId] || [], [cardParentId, childrenByParent]);
  const cardParentNode = useMemo(() => nodesById.get(cardParentId) || null, [cardParentId, nodesById]);

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

  useEffect(() => {
    if (!nodesById.has(cardParentId)) {
      const fallback = nodesById.has("root") ? "root" : fullNodes[0]?.id || "root";
      setCardParentId(fallback);
      setCardHistory([]);
      setCardTransitionPhase("idle");
    }
  }, [cardParentId, fullNodes, nodesById]);

  useEffect(() => {
    if (viewMode === "cards") {
      setCardParentId("root");
      setCardHistory([]);
      setCardTransitionPhase("idle");
    }
  }, [viewMode]);

  const animateCardSwap = useCallback(
    (nextParentId: string, pushHistory: boolean) => {
      if (cardTransitionPhase !== "idle") return;
      setCardTransitionPhase("out");
      setTimeout(() => {
        setCardParentId(nextParentId);
        setCardHistory((prev) => {
          if (pushHistory) return [...prev, cardParentId];
          const next = [...prev];
          next.pop();
          return next;
        });
        setCardTransitionPhase("in");
        setTimeout(() => setCardTransitionPhase("idle"), 200);
      }, 140);
    },
    [cardParentId, cardTransitionPhase]
  );

  const handleCardDetails = useCallback(
    (node: FlowNode) => {
      setSelectedNode((prev) => (prev?.id === node.id ? null : node));
    },
    []
  );

  const handleCardDrill = useCallback(
    (node: FlowNode) => {
      const hasKids = (childrenByParent[node.id] || []).length > 0;
      if (!hasKids) return;
      animateCardSwap(node.id, true);
    },
    [animateCardSwap, childrenByParent]
  );

  const handleCardBack = useCallback(() => {
    if (cardParentId === "root" && cardHistory.length === 0) return;
    const previousParent = cardHistory[cardHistory.length - 1] || "root";
    animateCardSwap(previousParent, false);
  }, [animateCardSwap, cardHistory, cardParentId]);

  const handleDeleteGhost = useCallback(
    async (node: FlowNode) => {
      if (!activeProject) return;
      const idMatch = node.id.match(/^ghost-(\d+)/);
      const ghostId = idMatch ? Number(idMatch[1]) : null;
      if (!ghostId) return;
      try {
        const res = await fetch(`/api/projects/${activeProject.slug}/ghosts`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: ghostId }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || "Konnte Ghost Page nicht löschen.");
        }
        setGhostNodes((prev) => prev.filter((g) => g.id !== node.id));
        setFullNodes((prev) => prev.filter((n) => n.id !== node.id));
        const nextNodes = fullNodes.filter((n) => n.id !== node.id);
        rebuildGraphRef.current?.(nextNodes, fullEdges, expandedRef.current, showAllRef.current);
        showStatus("Ghost Page entfernt.");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Konnte Ghost Page nicht löschen.";
        showStatus(message);
      }
    },
    [activeProject, fullEdges, fullNodes, showStatus]
  );

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

      const nodesById = new Map(inputNodes.map((n) => [n.id, n]));
      const reorderedChildren: Record<string, string[]> = {};
      const baseChildren = inputEdges.reduce<Record<string, string[]>>((acc, edge) => {
        acc[edge.source] = acc[edge.source] || [];
        acc[edge.source].push(edge.target);
        return acc;
      }, {});
      Object.entries(baseChildren).forEach(([parent, children]) => {
        reorderedChildren[parent] = reorderChildrenByOrderAfter(children, nodesById);
      });

      const getDepth = (node: FlowNode) => {
        if (node.data?.isRoot) return 0;
        const path = node.data?.path || "/";
        const segs = path === "/" ? [] : path.replace(/^\//, "").split("/").filter(Boolean);
        return segs.length;
      };

      const layoutedNodes = inputNodes.map((node) => {
        const pos = g.node(node.id);
        const hasManualPos = node.data?.isGhost && node.data?.isManualPosition;
        const finalPos = hasManualPos
          ? node.position
          : {
              x: pos.x - CARD_WIDTH / 2,
              y: pos.y - maxHeight / 2,
            };
        return {
          ...node,
          position: finalPos,
          data: { ...node.data, depth: getDepth(node), cardHeight: maxHeight, cardWidth: CARD_WIDTH },
          className: [node.className, "flow-card"].filter(Boolean).join(" "),
        };
      });

      const layoutedEdges = inputEdges.map((edge) => ({
        ...edge,
        type: "smoothstep",
      }));

      const childrenByParent = Object.keys(reorderedChildren).length
        ? reorderedChildren
        : layoutedEdges.reduce<Record<string, string[]>>((acc, edge) => {
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
          if (targetIndex >= 0 && !layouted[targetIndex].data?.isGhost) {
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
      const ghostEdges = buildGhostEdges(srcNodes);
      const combinedEdges = [...srcEdges, ...ghostEdges];
      const nodesById = new Map(srcNodes.map((n) => [n.id, n]));

      const parentMap: Record<string, string | undefined> = {};
      const childrenMapFull: Record<string, string[]> = {};

      combinedEdges.forEach((edge) => {
        parentMap[edge.target] = edge.source;
        childrenMapFull[edge.source] = childrenMapFull[edge.source] || [];
        childrenMapFull[edge.source].push(edge.target);
      });

      Object.entries(childrenMapFull).forEach(([parent, children]) => {
        childrenMapFull[parent] = reorderChildrenByOrderAfter(children, nodesById);
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
      const visibleEdges = combinedEdges.filter(
        (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)
      );

        const decoratedNodes = visibleNodes.map((node) => {
          const seoFlag = seoMode ? getSeoFlag(node.data?.path || (node.data?.isRoot ? "/" : "")) : undefined;
          return {
            ...node,
            data: {
              ...node.data,
              depth: depthFromNode(node),
              hasChildren: (childrenMapFull[node.id] || []).length > 0,
              expanded: expandedSet.has(node.id),
              isNew: !prevVisibleRef.current.has(node.id),
              seoFlag,
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
              onAddGhostDown: () => handleAddGhostRelativeRef.current?.(node, "down"),
              onAddGhostRight: () => handleAddGhostRelativeRef.current?.(node, "right"),
              onDeleteGhost: () => handleDeleteGhost(node),
              orderAfter: node.data?.orderAfter,
            },
          };
        });

      const layout = applyLayout(decoratedNodes, visibleEdges);
      setNodes(layout.nodes);
      setEdges(layout.edges);
      prevVisibleRef.current = visibleIds;
    },
    [applyLayout, handleDeleteGhost, getSeoFlag, seoMode]
  );

  useEffect(() => {
    rebuildGraph(fullNodes, fullEdges, expandedRef.current, showAllRef.current);
  }, [fullEdges, fullNodes, rebuildGraph, seoMode]);

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

  const loadGhosts = useCallback(
    async (slug: string) => {
      try {
        const res = await fetch(`/api/projects/${slug}/ghosts`, { cache: "no-store" });
        const data: GhostsResponse = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || "Konnte Ghost Pages nicht laden.");
    }
        const nodes = (data.ghosts || []).map<FlowNode>((g) => ({
          id: `ghost-${g.id}`,
          data: {
            label: g.label,
            path: g.path,
            isGhost: true,
            isManualPosition: Boolean(g.meta?.manualPosition),
          },
          position: { x: g.x ?? 0, y: g.y ?? 0 },
          type: "ghost",
        }));
        setGhostNodes(nodes);
        return nodes;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Konnte Ghost Pages nicht laden.";
        showStatus(message);
        setGhostNodes([]);
        return [];
      }
    },
    [showStatus]
  );

  const loadSuggestions = useCallback(
    async (slug: string) => {
      try {
        const res = await fetch(`/api/projects/${slug}/suggestions`, { cache: "no-store" });
        const data: SuggestionsResponse = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || "Konnte Vorschläge nicht laden.");
        }
        const byPath: Record<string, NodeSuggestion[]> = {};
        (data.suggestions || []).forEach((s) => {
          const key = normalizePathValue(s.path);
          byPath[key] = byPath[key] || [];
          byPath[key].push(s);
        });
        setSuggestionsByPath(byPath);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Konnte Vorschläge nicht laden.";
        showStatus(message);
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
        setSuggestionsByPath({});
        setGhostNodes([]);
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

        const latestNodes = data.latestSnapshot?.nodes || [];
        const latestEdges = data.latestSnapshot?.edges || [];
        const ghostResp = await loadGhosts(data.project.slug);
        const combinedNodes = [...latestNodes, ...ghostResp];
        if (data.latestSnapshot) {
          setFullNodes(combinedNodes);
          setFullEdges(latestEdges || []);
          setActiveSnapshot(data.latestSnapshot.snapshot);
          setActiveDomain(data.latestSnapshot.domain || primaryDomain?.hostname || null);
          rebuildGraph(combinedNodes, latestEdges || [], new Set(), false);
          showStatus("Letzte Karte geladen.");
        } else {
          setFullNodes(combinedNodes);
          setFullEdges([]);
          setNodes(combinedNodes);
          setEdges([]);
          setActiveSnapshot(null);
          setSelectedNode(null);
          if (combinedNodes.length === 0) {
            showStatus("Noch keine Karte gespeichert.");
          }
        }

        await loadKeywords(data.project.slug);
        await loadSuggestions(data.project.slug);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Konnte Projekt nicht laden.";
        showStatus(message);
      } finally {
        setLoadingProject(false);
      }
    },
    [loadGhosts, loadKeywords, loadSuggestions, rebuildGraph, showStatus]
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // initial load only

  const handleCreateProject = async (name: string, domain: string, autoCrawl = true) => {
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
      const targetDomain = autoCrawlPendingDomain || trimmedDomain;
      setAutoCrawlPendingDomain(null);
      if (autoCrawl) {
        await handleCrawl({ domainOverride: targetDomain, projectOverride: data.project });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Konnte Projekt nicht anlegen.";
      showStatus(message);
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleCrawl = async (options: { domainOverride?: string; projectOverride?: Project | null } = {}) => {
    const { domainOverride, projectOverride } = options;
    const domainToUse =
      domainOverride?.trim() ||
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
    const hasProjectForHost =
      projectOverride != null
        ? true
        : projects.some((p) => p.primaryDomain && stripWww(p.primaryDomain) === stripWww(host));

    const projectToUse = projectOverride ?? activeProject;

    if (!projectToUse || !hasProjectForHost) {
      setNewProjectDomain(domainToUse);
      setNewProjectName(host);
      setAutoCrawlPendingDomain(domainToUse);
      setOverviewOpen(true);
      setNewProjectOpen(true);
      showStatus("Projekt anlegen, um die Domain zu crawlen.");
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    try {
      const res = await fetch(`/api/projects/${projectToUse.slug}/crawl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domainToUse, depth }),
      });

      const data: CrawlResponse = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Fehler beim Crawlen.");
      }

      const combined = [...(data.nodes || []), ...ghostNodes];
      setFullNodes(combined);
      setFullEdges(data.edges || []);
      const collapsed = new Set<string>();
      expandedRef.current = collapsed;
      prevVisibleRef.current = new Set();
      showAllRef.current = false;
      setShowAll(false);
      rebuildGraph(combined, data.edges || [], collapsed, false);
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

  const handleAddSuggestion = async (
    field: "metaTitle" | "metaDescription" | "h1",
    value: string
  ) => {
    if (!activeProject || !selectedNode) {
      showStatus("Bitte zuerst eine Seite auswählen.");
      return;
    }
    const path = selectedNode.data?.path || "/";
    try {
      const res = await fetch(`/api/projects/${activeProject.slug}/suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path,
          field,
          value,
          domain: activeDomain || domains.find((d) => d.isPrimary)?.hostname,
        }),
      });
      const data: SuggestionCreateResponse = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Konnte Vorschlag nicht speichern.");
      }
      const key = normalizePathValue(path);
      setSuggestionsByPath((prev) => {
        const current = prev[key] || [];
        return { ...prev, [key]: [data.suggestion, ...current] };
      });
      setSuggestionInput("");
      setEditingField(null);
      showStatus("Vorschlag gespeichert.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Konnte Vorschlag nicht speichern.";
      showStatus(message);
    }
  };

  const handleDeleteSuggestion = async (id: number, path: string) => {
    if (!activeProject) return;
    try {
      const res = await fetch(`/api/projects/${activeProject.slug}/suggestions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Konnte Vorschlag nicht löschen.");
      }
      const key = normalizePathValue(path);
      setSuggestionsByPath((prev) => {
        const current = prev[key] || [];
        return { ...prev, [key]: current.filter((s) => s.id !== id) };
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Konnte Vorschlag nicht löschen.";
      showStatus(message);
    }
  };

  const addGhostNodeToState = useCallback(
    (node: FlowNode) => {
      setGhostNodes((prevGhosts) => {
        const filtered = prevGhosts.filter((g) => g.id !== node.id);
        const updatedGhosts = [...filtered, node];
        setFullNodes((prevFull) => {
          const base = prevFull.filter((n) => !n.data?.isGhost);
          const combined = [...base, ...updatedGhosts];
          rebuildGraph(combined, fullEdges, expandedRef.current, showAllRef.current);
          return combined;
        });
        return updatedGhosts;
      });
    },
    [fullEdges, rebuildGraph]
  );

  const createGhostAndAdd = useCallback(
    async (payload: {
      label: string;
      path: string;
      x: number;
      y: number;
      domain?: string | null;
      manualPosition?: boolean;
      orderAfter?: string;
    }) => {
      if (!activeProject) {
        showStatus("Bitte zuerst ein Projekt auswählen.");
        return null;
      }
      const label = payload.label || "Ghost Page";
      const path = payload.path || "/";
      const domainToUse =
        payload.domain ||
        activeDomain ||
        domains.find((d) => d.isPrimary)?.hostname ||
        domains[0]?.hostname ||
        null;

      try {
        const res = await fetch(`/api/projects/${activeProject.slug}/ghosts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label,
            path,
            x: payload.x,
            y: payload.y,
            domain: domainToUse,
            manualPosition: payload.manualPosition || false,
          }),
        });
        const data: { ghost: GhostPage; error?: string } = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || "Konnte Ghost Page nicht anlegen.");
        }
        const node: FlowNode = {
          id: `ghost-${data.ghost.id}`,
          data: {
            label: data.ghost.label,
            path: data.ghost.path,
            isGhost: true,
            isManualPosition: payload.manualPosition || Boolean(data.ghost.meta?.manualPosition),
            orderAfter: payload.orderAfter,
          },
          position: { x: data.ghost.x ?? 0, y: data.ghost.y ?? 0 },
          type: "ghost",
        };
        addGhostNodeToState(node);
        setNewGhostLabel("");
        setNewGhostPath("");
        showStatus("Ghost Page hinzugefügt.");
        return node;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Konnte Ghost Page nicht anlegen.";
        showStatus(message);
        return null;
      }
    },
    [activeDomain, activeProject, addGhostNodeToState, domains, showStatus]
  );

  const handleAddGhost = async () => {
    const label = newGhostLabel.trim() || "Ghost Page";
    const path = newGhostPath.trim() || "/";
    await createGhostAndAdd({ label, path, x: 0, y: 0, domain: activeDomain || undefined });
  };

  const handleAddGhostRelative = useCallback(
    (node: FlowNode, direction: "down" | "right") => {
      const basePath = normalizePathValue(node.data?.path || "/");
      const timestamp = Date.now();
      const childPath =
        direction === "down"
          ? normalizePathValue(basePath === "/" ? `/ghost-${timestamp}` : `${basePath}/ghost-${timestamp}`)
          : normalizePathValue(
            `${parentPathOf(basePath) === "/" ? "" : parentPathOf(basePath)}/ghost-${timestamp}`
          );
      createGhostAndAdd({
        label: "Ghost Page",
        path: childPath,
        x: 0,
        y: 0,
        manualPosition: false,
        domain: activeDomain || undefined,
        orderAfter: direction === "right" ? node.id : undefined,
      });
    },
    [activeDomain, createGhostAndAdd]
  );

  useEffect(() => {
    handleAddGhostRelativeRef.current = handleAddGhostRelative;
    rebuildGraphRef.current = rebuildGraph;
  }, [handleAddGhostRelative, rebuildGraph]);

  const handleUpdateGhostPosition = useCallback(
    async (node: FlowNode) => {
      if (!activeProject) return;
      const idMatch = node.id.match(/^ghost-(\d+)/);
      const ghostId = idMatch ? Number(idMatch[1]) : null;
      if (!ghostId) return;
      try {
        await fetch(`/api/projects/${activeProject.slug}/ghosts`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: ghostId, x: node.position.x, y: node.position.y }),
        });
        setFullNodes((prev) =>
          prev.map((n) =>
            n.id === node.id ? { ...n, data: { ...n.data, isManualPosition: true } } : n
          )
        );
        setGhostNodes((prev) =>
          prev.map((n) =>
            n.id === node.id ? { ...n, data: { ...n.data, isManualPosition: true } } : n
          )
        );
      } catch {
        // silent fail
      }
    },
    [activeProject]
  );

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

  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => (prev === "tree" ? "cards" : "tree"));
  }, []);

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
                  setAutoCrawlPendingDomain(null);
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
          onClick={() => setSeoMode((v) => !v)}
          className={`relative flex h-10 w-20 items-center rounded-full transition ${
            seoMode ? "bg-amber-200/70 ring-amber-200" : "bg-slate-200/70 ring-slate-200"
          } ring-1 shadow-sm`}
          aria-label="SEO Modus umschalten"
        >
          <span className="absolute left-3 text-slate-600">
            <EyeIcon className={`h-5 w-5 ${seoMode ? "opacity-60" : "opacity-100"}`} />
          </span>
          <span className="absolute right-3 text-amber-700">
            <SearchIcon className={`h-5 w-5 ${seoMode ? "opacity-100" : "opacity-40"}`} />
          </span>
          <span
            className={`absolute h-8 w-8 rounded-full bg-white shadow-md transition-transform duration-200 ease-out ${
              seoMode ? "translate-x-8" : "translate-x-0"
            }`}
          />
        </button>
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
          } ${viewMode === "cards" ? "opacity-40 cursor-not-allowed" : ""}`}
          onClick={toggleShowAll}
          disabled={viewMode === "cards"}
          aria-label="Alle Ebenen umschalten"
        >
          🖥
        </button>
        <button
          className={`rounded-full px-3 py-2 text-lg shadow-sm ring-1 ring-slate-100 ${
            viewMode === "cards" ? "bg-slate-900 text-white" : "bg-white text-slate-700"
          }`}
          onClick={toggleViewMode}
          aria-label="Ansicht wechseln"
          title={viewMode === "tree" ? "Auf Kartenansicht umschalten" : "Auf Baumansicht umschalten"}
        >
          {viewMode === "tree" ? (
            <GridIcon className="h-5 w-5" />
          ) : (
            <TreeIcon className="h-5 w-5" />
          )}
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
        {viewMode === "tree" ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            fitView
            minZoom={0.3}
            maxZoom={2}
            fitViewOptions={{ padding: 0.4 }}
            panOnScroll
            panOnScrollMode={PanOnScrollMode.Free}
            zoomOnScroll={false}
            zoomOnPinch
            proOptions={{ hideAttribution: true }}
            className="rounded-2xl"
            onNodeClick={(_, node) => setSelectedNode(node as FlowNode)}
            onPaneClick={() => setSelectedNode(null)}
            onNodeDragStop={(_, node) => {
              if (node.type === "ghost") {
                setGhostNodes((prev) =>
                  prev.map((n) => (n.id === node.id ? { ...n, position: node.position } : n))
                );
                setFullNodes((prev) =>
                  prev.map((n) => (n.id === node.id ? { ...n, position: node.position } : n))
                );
                handleUpdateGhostPosition(node as FlowNode);
              }
            }}
          >
            <Background gap={26} color="#e7ecfb" />
          </ReactFlow>
        ) : (
          <div className="flex h-full flex-col overflow-y-auto px-6">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 pb-10">
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="min-w-[200px]">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                    Ebene
                  </div>
                  <div className="text-lg font-semibold text-slate-800">
                    {cardParentNode?.data?.metaTitle ||
                      cardParentNode?.data?.label ||
                      activeDomain ||
                      "Root"}
                  </div>
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                    {cardParentNode?.data?.path || "/"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                    {currentCardCluster.length} Karten
                  </span>
                  <button
                    onClick={handleCardBack}
                    disabled={cardParentId === "root" && cardHistory.length === 0}
                    className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    ← Ebene zurück
                  </button>
                </div>
              </div>

              <div className="relative min-h-[260px]">
                <div
                  className={`grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${
                    cardTransitionPhase === "out"
                      ? "card-anim-out"
                      : cardTransitionPhase === "in"
                      ? "card-anim-in"
                      : ""
                  }`}
                >
                  {currentCardCluster.map((node) => {
                    const hasKids = (childrenByParent[node.id] || []).length > 0;
                    const isSelected = selectedNode?.id === node.id;
                    const status = node.data?.statusCode;
                    const unreachable = node.data?.unreachable;
                    const showStatusBadge = unreachable || (status && status >= 400);
                    const statusLabel =
                      typeof status === "number" ? status.toString() : unreachable ? "—" : "";
                    const seoFlag = seoMode ? getSeoFlag(node.data?.path) : undefined;
                    const title =
                      node.data?.metaTitle || node.data?.label || node.data?.path || "Seite";
                    const desc = node.data?.metaDescription || node.data?.h1 || "Keine Beschreibung";
                    return (
                      <button
                        key={node.id}
                        onClick={() => handleCardDetails(node)}
                        className={`group relative flex h-full flex-col rounded-2xl bg-white/90 px-4 py-3 text-left shadow-[0_10px_30px_rgba(0,0,0,0.05)] transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${
                          isSelected ? "ring-2 ring-[#2f6bff]" : "ring-1 ring-transparent"
                        }`}
                        style={{
                          border:
                            seoFlag === "page1"
                              ? "2px solid #d4a017"
                              : seoFlag === "threshold"
                              ? "2px dashed #d4a017"
                              : "1px solid rgba(226, 232, 240, 1)",
                        }}
                      >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-col">
                              <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                                {node.data?.path || "/"}
                              </span>
                              <span className="mt-1 text-base font-semibold leading-tight text-slate-800">
                                {title.length > 46 ? `${title.slice(0, 46)}…` : title}
                              </span>
                            </div>
                            {showStatusBadge && (
                              <span
                                className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                                  unreachable || (status && status >= 400)
                                    ? "bg-rose-50 text-rose-700 ring-1 ring-rose-100"
                                    : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                                }`}
                              >
                                {statusLabel}
                              </span>
                            )}
                          </div>
                          <div className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600">
                            {desc}
                          </div>
                          <div className="mt-auto pt-3">
                            <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
                              <span>Details öffnen</span>
                              {hasKids ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCardDrill(node);
                                  }}
                                  className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white transition hover:-translate-y-[1px] hover:shadow-md"
                                  aria-label="Ebene tiefer öffnen"
                                >
                                  <ArrowIcon className="h-4 w-4" />
                                </button>
                              ) : (
                                <span className="h-7 w-7" aria-hidden="true" />
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                {currentCardCluster.length === 0 && (
                  <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 text-sm text-slate-500">
                    Keine Unterseiten auf dieser Ebene.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

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
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCrawl();
              }
            }}
            placeholder="z. B. example.com"
            className="flex-1 border-none text-base focus:outline-none"
          />
          <div className="relative flex items-center gap-2">
            <button
              onClick={() => handleCrawl()}
              disabled={loading}
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
                {depth === 5 ? (
                  <InfinityIcon className="h-6 w-6 text-slate-500" />
                ) : (
                  <span>{depth}</span>
                )}
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
                      {option === 5 ? (
                        <InfinityIcon className="h-6 w-6 text-slate-500" />
                      ) : (
                        <span>{option}</span>
                      )}
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
                <div className="flex items-start justify-between gap-3">
                  <p className="max-w-[240px] break-all text-sm font-semibold text-slate-800">
                    {item.path}
                  </p>
                  <span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
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
          <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/80">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">Ghost Pages</p>
                <p className="text-xs text-slate-500">Füge manuell Seiten hinzu (gestrichelt auf der Karte).</p>
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <input
                value={newGhostLabel}
                onChange={(e) => setNewGhostLabel(e.target.value)}
                placeholder="Label (z. B. Landing Ghost)"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              />
              <input
                value={newGhostPath}
                onChange={(e) => setNewGhostPath(e.target.value)}
                placeholder="/ghost-page"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              />
              <button
                onClick={handleAddGhost}
                disabled={!activeProject}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
              >
                Ghost Page hinzufügen
              </button>
            </div>
          </div>
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
              {(selectedNode.data?.unreachable ||
                (selectedNode.data?.statusCode && selectedNode.data.statusCode >= 400)) && (
                <div className="rounded-2xl border border-red-300 bg-red-50 p-3 ring-1 ring-red-200">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                      !
                    </span>
                    <div className="flex flex-col">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-red-700">
                        Fehler
                      </p>
                      <p className="text-sm font-semibold text-red-700">
                        {selectedNode.data?.statusCode
                          ? `Status ${selectedNode.data.statusCode}`
                          : "Seite nicht erreichbar"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200/80">
                <div className="flex items-start justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Meta Title
                  </p>
                  <button
                    onClick={() => {
                      setEditingField("metaTitle");
                      setSuggestionInput(selectedNode.data?.metaTitle || "");
                    }}
                    className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-100"
                  >
                    ✎
                  </button>
                </div>
                <p className="mt-1 text-sm text-slate-800">
                  {selectedNode.data?.metaTitle || "—"}
                </p>
                {editingField === "metaTitle" && (
                  <div className="mt-2 flex flex-col gap-2 rounded-xl bg-white p-2 ring-1 ring-slate-200">
                    <textarea
                      value={suggestionInput}
                      onChange={(e) => setSuggestionInput(e.target.value)}
                      rows={2}
                      className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm focus:border-slate-400 focus:outline-none"
                      placeholder="Vorschlag eingeben"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditingField(null);
                          setSuggestionInput("");
                        }}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                      >
                        Abbrechen
                      </button>
                      <button
                        onClick={() => handleAddSuggestion("metaTitle", suggestionInput)}
                        className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
                      >
                        Speichern
                      </button>
                    </div>
                  </div>
                )}
                {suggestionsForSelected
                  .filter((s) => s.field === "metaTitle")
                  .map((s) => (
                    <div
                      key={s.id}
                      className="mt-2 flex items-start justify-between gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2"
                    >
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                          Vorschlag
                        </p>
                        <p className="text-sm font-semibold text-emerald-800">{s.value}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteSuggestion(s.id, s.path)}
                        className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-100"
                      >
                        ×
                      </button>
                    </div>
                  ))}
              </div>
              <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200/80">
                <div className="flex items-start justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Meta Description
                  </p>
                  <button
                    onClick={() => {
                      setEditingField("metaDescription");
                      setSuggestionInput(selectedNode.data?.metaDescription || "");
                    }}
                    className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-100"
                  >
                    ✎
                  </button>
                </div>
                <p className="mt-1 text-sm text-slate-800 leading-relaxed">
                  {selectedNode.data?.metaDescription || "—"}
                </p>
                {editingField === "metaDescription" && (
                  <div className="mt-2 flex flex-col gap-2 rounded-xl bg-white p-2 ring-1 ring-slate-200">
                    <textarea
                      value={suggestionInput}
                      onChange={(e) => setSuggestionInput(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm focus:border-slate-400 focus:outline-none"
                      placeholder="Vorschlag eingeben"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditingField(null);
                          setSuggestionInput("");
                        }}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                      >
                        Abbrechen
                      </button>
                      <button
                        onClick={() => handleAddSuggestion("metaDescription", suggestionInput)}
                        className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
                      >
                        Speichern
                      </button>
                    </div>
                  </div>
                )}
                {suggestionsForSelected
                  .filter((s) => s.field === "metaDescription")
                  .map((s) => (
                    <div
                      key={s.id}
                      className="mt-2 flex items-start justify-between gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2"
                    >
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                          Vorschlag
                        </p>
                        <p className="text-sm font-semibold text-emerald-800">{s.value}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteSuggestion(s.id, s.path)}
                        className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-100"
                      >
                        ×
                      </button>
                    </div>
                  ))}
              </div>
              <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200/80">
                <div className="flex items-start justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    H1
                  </p>
                  <button
                    onClick={() => {
                      setEditingField("h1");
                      setSuggestionInput(selectedNode.data?.h1 || "");
                    }}
                    className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-100"
                  >
                    ✎
                  </button>
                </div>
                <p className="mt-1 text-sm text-slate-800">{selectedNode.data?.h1 || "—"}</p>
                {editingField === "h1" && (
                  <div className="mt-2 flex flex-col gap-2 rounded-xl bg-white p-2 ring-1 ring-slate-200">
                    <textarea
                      value={suggestionInput}
                      onChange={(e) => setSuggestionInput(e.target.value)}
                      rows={2}
                      className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm focus:border-slate-400 focus:outline-none"
                      placeholder="Vorschlag eingeben"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditingField(null);
                          setSuggestionInput("");
                        }}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                      >
                        Abbrechen
                      </button>
                      <button
                        onClick={() => handleAddSuggestion("h1", suggestionInput)}
                        className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
                      >
                        Speichern
                      </button>
                    </div>
                  </div>
                )}
                {suggestionsForSelected
                  .filter((s) => s.field === "h1")
                  .map((s) => (
                    <div
                      key={s.id}
                      className="mt-2 flex items-start justify-between gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2"
                    >
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                          Vorschlag
                        </p>
                        <p className="text-sm font-semibold text-emerald-800">{s.value}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteSuggestion(s.id, s.path)}
                        className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-100"
                      >
                        ×
                      </button>
                    </div>
                  ))}
              </div>
              <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200/80">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Keywords
                </p>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                  <span>Sortieren:</span>
                  <button
                    onClick={() => setKeywordSort("position")}
                    className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 transition ${
                      keywordSort === "position"
                        ? "bg-slate-900 text-white ring-slate-900"
                        : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    Position
                  </button>
                  <button
                    onClick={() => setKeywordSort("volume")}
                    className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 transition ${
                      keywordSort === "volume"
                        ? "bg-slate-900 text-white ring-slate-900"
                        : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    SV
                  </button>
                </div>
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
                  setAutoCrawlPendingDomain(null);
                }}
                className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              >
                Abbrechen
              </button>
              <button
                onClick={() => handleCreateProject(newProjectName, newProjectDomain, true)}
                disabled={loadingProjects}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
              >
                {loadingProjects ? "Anlegen..." : "Projekt speichern & Crawl starten"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
