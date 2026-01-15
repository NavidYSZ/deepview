import { NextRequest, NextResponse } from "next/server";
import { crawlDomain, normalizeDomain } from "@/lib/crawler";
import {
  ensureDomain,
  ensureFeature,
  getProjectBySlug,
  saveSnapshot,
  upsertPagesFromNodes,
} from "@/lib/db";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const resolvedParams = await params;
    const slug = resolvedParams?.slug;
    if (!slug) {
      return NextResponse.json({ error: "Slug fehlt." }, { status: 400 });
    }

    const projectData = getProjectBySlug(slug);
    if (!projectData) {
      return NextResponse.json({ error: "Projekt nicht gefunden." }, { status: 404 });
    }

    const body = await request.json();
    const depthInput = Number(body?.depth);
    const depth = Number.isFinite(depthInput) ? depthInput : 1;
    const domainInput = (body?.domain as string | undefined)?.trim();

    const primaryDomain = projectData.domains.find((d) => d.isPrimary);
    const hostnameInput = domainInput ? new URL(normalizeDomain(domainInput)).hostname : undefined;
    const hostname = hostnameInput || primaryDomain?.hostname;
    if (!hostname) {
      return NextResponse.json({ error: "Keine Domain für das Projekt hinterlegt." }, { status: 400 });
    }

    const domain = ensureDomain(projectData.project.id, hostname, Boolean(domainInput));
    ensureFeature(projectData.project.id, "crawler");

    const crawlResult = await crawlDomain(hostname, depth);
    const payload = {
      nodes: crawlResult.nodes,
      edges: crawlResult.edges,
      domain: crawlResult.domain,
    };

    const saved = saveSnapshot(
      projectData.project.id,
      domain.id,
      "crawler",
      1,
      { depth, rootUrl: normalizeDomain(hostname) },
      payload
    );

    upsertPagesFromNodes(projectData.project.id, domain.id, saved.snapshot.id, payload.nodes);

    return NextResponse.json({
      project: projectData.project,
      domain,
      snapshot: saved.snapshot,
      nodes: saved.nodes,
      edges: saved.edges,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler beim Crawlen.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
