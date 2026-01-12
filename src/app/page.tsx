"use client";

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

type FlowNode = Node<{ label: string; path?: string; isRoot?: boolean }>;
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
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const nodeTypes = useMemo(() => ({ card: CardNode }), []);
  const hasGraph = nodes.length > 0;

  const loadLatest = useCallback(async () => {
    try {
      const res = await fetch("/api/projects/latest", { cache: "no-store" });
      const data: LatestProjectResponse = await res.json();
      const project = data?.project;
      if (!project) {
        setStatus("Gib eine Domain ein, um zu starten.");
        return;
      }

      setNodes((project.nodes as FlowNode[]) || []);
      setEdges((project.edges as FlowEdge[]) || []);
      setActiveDomain(project.domain);
      setDomainInput((current) => current || project.domain);
      setStatus("Letzte gespeicherte Karte geladen.");
    } catch {
      setStatus("Konnte letzte Karte nicht laden.");
    }
  }, []);

  useEffect(() => {
    loadLatest();
  }, [loadLatest]);

  const handleCrawl = async () => {
    if (!domainInput.trim()) {
      setStatus("Bitte eine Domain eingeben.");
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domainInput.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Fehler beim Crawlen.");
      }

      setNodes((data.nodes as FlowNode[]) || []);
      setEdges((data.edges as FlowEdge[]) || []);
      setActiveDomain(data.domain);
      setStatus("Struktur gespeichert (SQLite).");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fehler beim Crawlen.";
      setStatus(message);
    } finally {
      setLoading(false);
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
          onClick={() => setStatus("Bereits automatisch gespeichert.")}
        >
          Save
        </button>
        <button className="rounded-full bg-white px-3 py-2 text-lg shadow-sm ring-1 ring-slate-100">
          🔍
        </button>
        <button className="rounded-full bg-white px-3 py-2 text-lg shadow-sm ring-1 ring-slate-100">
          😊
        </button>
      </div>

      <div className="absolute inset-0 pt-20 pb-28">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
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
              Wir crawlen nur Klicktiefe 1, speichern das Ergebnis in SQLite und zeigen es
              hier als Karte an.
            </p>
          </div>
        )}

        <div className="pointer-events-none absolute left-1/2 top-28 -translate-x-1/2 text-xs uppercase tracking-[0.35em] text-slate-300">
          Section
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-24 mx-auto flex max-w-2xl items-center justify-center px-4">
        <div className="pointer-events-auto flex w-full items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-3 shadow-xl">
          <input
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            placeholder="z. B. example.com"
            className="flex-1 border-none text-base focus:outline-none"
          />
          <button
            onClick={handleCrawl}
            disabled={loading}
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70"
          >
            {loading ? "Crawle..." : "Crawl"}
          </button>
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

      <div className="absolute left-1/2 bottom-32 -translate-x-1/2">
        <button className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-2xl text-slate-700 shadow-lg hover:bg-slate-50">
          +
        </button>
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

      {status && (
        <div className="absolute left-1/2 bottom-36 -translate-x-1/2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-lg ring-1 ring-slate-200">
          {status}
        </div>
      )}
    </div>
  );
}
