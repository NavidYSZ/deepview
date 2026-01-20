import { NextRequest, NextResponse } from "next/server";
import { normalizeDomain } from "@/lib/crawler";
import { createGhostPage, deleteGhostPage, ensureDomain, getProjectBySlug, listGhostPages, updateGhostPagePosition } from "@/lib/db";

export const runtime = "nodejs";

function normalizePathValue(value?: string | null) {
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
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug;
  if (!slug) {
    return NextResponse.json({ error: "Slug fehlt." }, { status: 400 });
  }

  const projectData = getProjectBySlug(slug);
  if (!projectData) {
    return NextResponse.json({ error: "Projekt nicht gefunden." }, { status: 404 });
  }

  const ghosts = listGhostPages(projectData.project.id);
  return NextResponse.json({ ghosts });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
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
    const label = (body?.label as string | undefined)?.trim() || "Ghost Page";
    const path = normalizePathValue((body?.path as string | undefined) || "/");
    const x = Number(body?.x ?? 0) || 0;
    const y = Number(body?.y ?? 0) || 0;
    const domainInput = (body?.domain as string | undefined)?.trim();

    let domainId: number | null = null;
    if (domainInput) {
      try {
        const host = new URL(normalizeDomain(domainInput)).hostname;
        const ensured = ensureDomain(projectData.project.id, host, false);
        domainId = ensured.id;
      } catch {
        // ignore
      }
    } else {
      const primary = projectData.domains.find((d) => d.isPrimary);
      if (primary) domainId = primary.id;
    }

    const ghost = createGhostPage(projectData.project.id, domainId, path, label, { x, y });
    return NextResponse.json({ ghost });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler beim Erstellen.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
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
    const id = Number(body?.id);
    const x = Number(body?.x);
    const y = Number(body?.y);
    if (!id || !Number.isFinite(x) || !Number.isFinite(y)) {
      return NextResponse.json({ error: "Ungültige Daten." }, { status: 400 });
    }

    const updated = updateGhostPagePosition(projectData.project.id, id, { x, y });
    if (!updated) {
      return NextResponse.json({ error: "Ghost Page nicht gefunden." }, { status: 404 });
    }
    return NextResponse.json({ ghost: updated });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler beim Aktualisieren.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
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
    const id = Number(body?.id);
    if (!id) {
      return NextResponse.json({ error: "ID fehlt." }, { status: 400 });
    }
    deleteGhostPage(projectData.project.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler beim Löschen.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
