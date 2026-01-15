import { NextResponse } from "next/server";
import { crawlDomain, normalizeDomain } from "@/lib/crawler";
import {
  createProject,
  ensureDomain,
  ensureFeature,
  findProjectByHostname,
  saveSnapshot,
  upsertPagesFromNodes,
} from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const domainInput = (body?.domain as string | undefined)?.trim();
    const depthInput = Number(body?.depth);
    const depth = Number.isFinite(depthInput) ? depthInput : 1;

    if (!domainInput) {
      return NextResponse.json({ error: "Bitte eine Domain angeben." }, { status: 400 });
    }

    const normalized = normalizeDomain(domainInput);
    const hostname = new URL(normalized).hostname;

    let projectData = findProjectByHostname(hostname);
    if (!projectData) {
      projectData = createProject(hostname, hostname, undefined, { autoCreated: true });
    }

    const domain = ensureDomain(projectData.project.id, hostname, true);
    ensureFeature(projectData.project.id, "crawler");

    const result = await crawlDomain(hostname, depth);
    const saved = saveSnapshot(
      projectData.project.id,
      domain.id,
      "crawler",
      1,
      { depth, rootUrl: normalizeDomain(hostname), source: "api/crawl" },
      { nodes: result.nodes, edges: result.edges, domain: result.domain }
    );

    upsertPagesFromNodes(projectData.project.id, domain.id, saved.snapshot.id, saved.nodes);

    return NextResponse.json({
      ...result,
      project: projectData.project,
      domain,
      snapshot: saved.snapshot,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler beim Crawlen.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
