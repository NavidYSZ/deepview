"use client";

import dagre from "dagre";
import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Edge,
  Handle,
  Node,
  NodeProps,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";

type FlowNode = Node<{ label: string; path?: string; isRoot?: boolean; depth?: number }>;
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

  return (
    <div
      className="group flex h-24 w-48 flex-col rounded-2xl bg-white px-4 py-3 shadow-[0_8px_24px_rgba(47,107,255,0.08)]"
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lastLevelRows, setLastLevelRows] = useState(1);

  const nodeTypes = useMemo(() => ({ card: CardNode }), []);
  const hasGraph = nodes.length > 0;
  const depthOptions = useMemo(() => [1, 2, 3, 4, 5], []);
  const lastLevelRowsOptions = useMemo(() => [1, 2, 3], []);
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

      // Wrap deepest level into rows if requested
      const maxDepth =
        layoutedNodes.reduce(
          (acc, node) => Math.max(acc, node.data?.depth ?? 0),
          0
        ) || 0;
      const deepest = layoutedNodes.filter((node) => (node.data?.depth ?? 0) === maxDepth);
      const shouldWrap = lastLevelRows > 1 && deepest.length >= 4;

      if (shouldWrap) {
        const sorted = [...deepest].sort((a, b) => a.position.x - b.position.x);
        const rows = Math.min(lastLevelRows, Math.ceil(deepest.length / 4));
        const perRow = Math.ceil(sorted.length / rows);
        const baseY = Math.max(...layoutedNodes.map((n) => n.position.y));
        const minX = Math.min(...sorted.map((n) => n.position.x));
        const maxX = Math.max(...sorted.map((n) => n.position.x));
        const centerX = (minX + maxX) / 2;
        const xGap = 240;
        const yGap = 160;

        const wrappedIds = new Set<string>();

        for (let row = 0; row < rows; row++) {
          const start = row * perRow;
          const slice = sorted.slice(start, start + perRow);
          const rowCount = slice.length;
          const rowStartX = centerX - ((rowCount - 1) * xGap) / 2;
          slice.forEach((node, idx) => {
            const targetIndex = layoutedNodes.findIndex((n) => n.id === node.id);
            if (targetIndex >= 0) {
              layoutedNodes[targetIndex] = {
                ...layoutedNodes[targetIndex],
                position: {
                  x: rowStartX + idx * xGap,
                  y: baseY + row * yGap,
                },
              };
              if (row > 0) {
                wrappedIds.add(node.id);
              }
            }
          });
        }

        const wrappedEdgeStyle = { stroke: "rgba(0,0,0,0.35)", strokeWidth: 2 };
        layoutedEdges.forEach((edge, index) => {
          if (wrappedIds.has(edge.target)) {
            layoutedEdges[index] = { ...edge, style: wrappedEdgeStyle };
          }
        });
      }

      return { nodes: layoutedNodes, edges: layoutedEdges };
    },
    [lastLevelRows]
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

      const layout = applyLayout(
        (project.nodes as FlowNode[]) || [],
        (project.edges as FlowEdge[]) || []
      );
      setNodes(layout.nodes);
      setEdges(layout.edges);
      setActiveDomain(project.domain);
      setDomainInput((current) => current || project.domain);
      showStatus("Letzte gespeicherte Karte geladen.");
    } catch {
      showStatus("Konnte letzte Karte nicht laden.");
    }
  }, [applyLayout, showStatus]);

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

      const layout = applyLayout((data.nodes as FlowNode[]) || [], (data.edges as FlowEdge[]) || []);
      setNodes(layout.nodes);
      setEdges(layout.edges);
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

  const placeholderColors = useMemo(
    () => [
      { label: "Blue", color: "#2f6bff" },
      { label: "Topaz", color: "#2eb397" },
      { label: "Purple", color: "#8f6cff" },
    ],
    []
  );

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

      {settingsOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/10 backdrop-blur-[1px]"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="absolute right-6 top-16 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">Settings</p>
                <p className="text-xs text-slate-500">Zeilen in letzter Ebene</p>
              </div>
              <button
                onClick={() => setSettingsOpen(false)}
                className="rounded-full px-3 py-1 text-sm font-semibold text-slate-500 hover:bg-slate-100"
              >
                ×
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2">
              {lastLevelRowsOptions.map((option) => (
                <button
                  key={option}
                  onClick={() => setLastLevelRows(option)}
                  className={`flex-1 rounded-full border px-3 py-2 text-sm font-semibold transition ${
                    option === lastLevelRows
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {option} Zeile{option > 1 ? "n" : ""}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-snug text-slate-500">
              Ab 4 Karten in der letzten Ebene werden bei mehr als 1 Zeile die Karten
              umgebrochen; Kanten werden dabei schwarz-transparent gezeichnet.
            </p>
          </div>
        </div>
      )}

      <div className="absolute left-6 top-6 flex items-center gap-3">
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

      <div className="absolute right-6 top-6 flex items-center gap-3">
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
          className="rounded-full bg-white px-3 py-2 text-lg shadow-sm ring-1 ring-slate-100"
          onClick={() => setSettingsOpen(true)}
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
        {placeholderColors.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span>{item.label}</span>
          </div>
        ))}
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
