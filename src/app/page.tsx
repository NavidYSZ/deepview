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
}>;
type FlowEdge = Edge;

type LatestProjectResponse = {
  project: {
    domain: string;
    nodes: FlowNode[];
    edges: FlowEdge[];
    createdAt: string;
  } | null;
};

const toolbarPlaceholders = ["↔", "🔍", "⟳", "◇", "⚡", "≡"];

const CardNode = ({ data, isConnectable }: NodeProps<FlowNode["data"]>) => {
  const borderColor = data?.isRoot ? "#8f6cff" : "#2f6bff";
  const showToggle = data?.hasChildren;

  return (
    <div className="relative">
      <div
        className={`group flex h-24 w-48 flex-col rounded-2xl bg-white px-4 py-3 shadow-[0_8px_24px_rgba(47,107,255,0.08)] ${
          data?.isNew ? "animate-[fade-in-up_0.22s_ease]" : ""
        }`}
        style={{ border: `2px solid ${borderColor}` }}
      >
        <div className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[#2f6bff]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#2f6bff]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#2f6bff]" />
        </div>
        <div className="mt-2 text-base font-semibold leading-tight text-[#1b2559]">
          {data?.label || "Page"}
        </div>
        {data?.path && (
          <div className="mt-1 text-[11px] uppercase tracking-[0.22em] text-slate-400">
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
  const [depth, setDepth] = useState(1);
  const [depthOpen, setDepthOpen] = useState(false);
  const [fullNodes, setFullNodes] = useState<FlowNode[]>([]);
  const [fullEdges, setFullEdges] = useState<FlowEdge[]>([]);
  const expandedRef = useRef<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

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
        g.setNode(node.id, { width: 200, height: 120 });
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
            x: pos.x - 100,
            y: pos.y - 60,
          },
          data: { ...node.data, depth: getDepth(node) },
        };
      });

      const layoutedEdges = inputEdges.map((edge) => ({
        ...edge,
        type: edge.type || "step",
      }));

      // Determine children per parent
      const childrenByParent = inputEdges.reduce<Record<string, string[]>>((acc, edge) => {
        acc[edge.source] = acc[edge.source] || [];
        acc[edge.source].push(edge.target);
        return acc;
      }, {});

      const layouted = layoutedNodes.map((n) => ({ ...n }));
      const edgesWithStyle = layoutedEdges.map((e) => ({ ...e }));

      const wrappedTargets = new Set<string>();
      const xGap = 240;
      const yGap = 160;

      Object.entries(childrenByParent).forEach(([parentId, childIds]) => {
        if (childIds.length <= 4) return;
        const parentNode = layouted.find((n) => n.id === parentId);
        if (!parentNode) return;
        const parentDepth = parentNode.data?.depth ?? 0;
        // No wrapping for root or its direct children (depth 0 or 1)
        if (parentDepth <= 1) return;

        const centerX = parentNode.position.x + 100;
        const baseY = parentNode.position.y + 200;
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
    (
      srcNodes: FlowNode[],
      srcEdges: FlowEdge[],
      expandedSet: Set<string>,
      viewAll: boolean,
      prevPositions: Record<string, { x: number; y: number }> = {}
    ) => {
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
          isNew: !prevPositions[node.id],
          onToggle: () => {
            const nextExpanded = new Set(expandedSet);
            if (nextExpanded.has(node.id)) {
              nextExpanded.delete(node.id);
            } else {
              nextExpanded.add(node.id);
            }
            expandedRef.current = nextExpanded;
            setShowAll(false);
            rebuildGraph(
              srcNodes,
              srcEdges,
              nextExpanded,
              false,
              prevPositions && Object.keys(prevPositions).length
                ? prevPositions
                : Object.fromEntries(nodes.map((n) => [n.id, n.position]))
            );
          },
        },
      }));

      const layout = applyLayout(decoratedNodes, visibleEdges);

      const mergedNodes = layout.nodes.map((node) => {
        const prev = prevPositions[node.id];
        return prev
          ? { ...node, position: prev, data: { ...node.data, isNew: false } }
          : node;
      });

      setNodes(mergedNodes);
      setEdges(layout.edges);
    },
    [applyLayout, nodes]
  );

  const loadLatest = useCallback(async () => {
    try {
      const res = await fetch("/api/projects/latest", { cache: "no-store" });
      const data: LatestProjectResponse = await res.json();
      const project = data?.project;
      if (!project) {
        showStatus("Gib eine Domain ein, um zu starten.");
        return;
      }

      const nodes = (project.nodes as FlowNode[]) || [];
      const edges = (project.edges as FlowEdge[]) || [];
      setFullNodes(nodes);
      setFullEdges(edges);
      expandedRef.current = new Set();
      setShowAll(false);
      setActiveDomain(project.domain);
      setDomainInput((current) => current || project.domain);
      rebuildGraph(nodes, edges, expandedRef.current, false);
      showStatus("Letzte gespeicherte Karte geladen.");
    } catch {
      showStatus("Konnte letzte Karte nicht laden.");
    }
  }, [rebuildGraph, showStatus]);

  useEffect(() => {
    loadLatest();
  }, [loadLatest]);

  const handleCrawl = async () => {
    if (!domainInput.trim()) {
      showStatus("Bitte eine Domain eingeben.");
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domainInput.trim(), depth }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Fehler beim Crawlen.");
      }

      const rawNodes = (data.nodes as FlowNode[]) || [];
      const rawEdges = (data.edges as FlowEdge[]) || [];
      setFullNodes(rawNodes);
      setFullEdges(rawEdges);
      const collapsed = new Set<string>();
      expandedRef.current = collapsed;
      setShowAll(false);
      rebuildGraph(rawNodes, rawEdges, collapsed, false);
      setActiveDomain(data.domain);
      showStatus(`Struktur gespeichert (Tiefe ${depth}, SQLite).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fehler beim Crawlen.";
      showStatus(message);
    } finally {
      setLoading(false);
      setDepthOpen(false);
    }
  };

  const toggleShowAll = () => {
    const next = !showAll;
    if (!fullNodes.length) {
      setShowAll(next);
      expandedRef.current = new Set();
      showStatus(next ? "Alle Ebenen sichtbar." : "Nur erste Ebene sichtbar.");
      return;
    }

    if (next) {
      const expandedAll = new Set(fullNodes.map((n) => n.id));
      expandedRef.current = expandedAll;
      setShowAll(true);
      rebuildGraph(fullNodes, fullEdges, expandedAll, true, Object.fromEntries(nodes.map((n) => [n.id, n.position])));
      showStatus("Alle Ebenen sichtbar.");
    } else {
      const collapsed = new Set<string>();
      expandedRef.current = collapsed;
      setShowAll(false);
      rebuildGraph(
        fullNodes,
        fullEdges,
        collapsed,
        false,
        Object.fromEntries(nodes.map((n) => [n.id, n.position]))
      );
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
            {activeDomain || "Alpha Project"}
          </p>
        </div>
      </div>

      <div className="absolute right-6 top-6 z-10 flex items-center gap-3">
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
        >
          <Background gap={26} color="#e7ecfb" />
        </ReactFlow>

        {!hasGraph && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 w-full max-w-xl -translate-x-1/2 -translate-y-1/2 text-center text-sm text-slate-500">
            <p className="text-lg font-semibold text-slate-700">
              Gib eine Domain ein, um die erste Ebene zu sehen.
            </p>
            <p className="mt-2 text-slate-500">
              Wir crawlen die gewählte Klicktiefe (1-5), speichern das Ergebnis in SQLite
              und zeigen es hier als Karte an.
            </p>
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-24 mx-auto flex max-w-2xl items-center justify-center px-4">
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
                {depth}
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
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={loadLatest}
            className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          >
            Load last
          </button>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-14 flex items-center justify-center gap-6 text-xs font-medium text-slate-500">
      </div>

      <div className="absolute left-6 bottom-6 flex items-center gap-3">
        <button className="flex h-10 w-10 items-center justify-center rounded-full bg-[#8f6cff] text-white shadow-lg shadow-[#8f6cff]/30">
          ✦
        </button>
        <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm ring-1 ring-slate-200">
          ⟳
        </button>
        <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm ring-1 ring-slate-200">
          ⌫
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

    </div>
  );
}
