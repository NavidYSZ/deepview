import { NextRequest, NextResponse } from "next/server";
import { normalizeDomain } from "@/lib/crawler";
import {
  addNodeSuggestion,
  deleteNodeSuggestion,
  ensureDomain,
  getProjectBySlug,
  listNodeSuggestions,
} from "@/lib/db";

export const runtime = "nodejs";

const allowedFields = new Set(["metaTitle", "metaDescription", "h1"]);

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

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug;
  if (!slug) {
    return NextResponse.json({ error: "Slug fehlt." }, { status: 400 });
  }

  const projectData = getProjectBySlug(slug);
  if (!projectData) {
    return NextResponse.json({ error: "Projekt nicht gefunden." }, { status: 404 });
  }

  const url = new URL(request.url);
  const pathParam = url.searchParams.get("path") || undefined;
  const domainParam = url.searchParams.get("domain") || undefined;

  let domainId: number | null | undefined = undefined;
  if (domainParam) {
    try {
      const host = new URL(normalizeDomain(domainParam)).hostname;
      const found = projectData.domains.find((d) => d.hostname === host);
      if (found) domainId = found.id;
    } catch {
      // ignore
    }
  }

  const suggestions = listNodeSuggestions(projectData.project.id, {
    path: pathParam || undefined,
    domainId: domainId === undefined ? undefined : domainId,
  });

  return NextResponse.json({ suggestions });
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
    const field = (body?.field as string) || "";
    const value = (body?.value as string | undefined)?.trim() || "";
    const pathInput = (body?.path as string | undefined) || "/";
    const domainInput = (body?.domain as string | undefined)?.trim() || null;

    if (!allowedFields.has(field)) {
      return NextResponse.json({ error: "Ungültiges Feld." }, { status: 400 });
    }
    if (!value) {
      return NextResponse.json({ error: "Wert fehlt." }, { status: 400 });
    }

    let domainId: number | null = null;
    if (domainInput) {
      try {
        const host = new URL(normalizeDomain(domainInput)).hostname;
        const ensured = ensureDomain(projectData.project.id, host, false);
        domainId = ensured.id;
      } catch {
        // ignore invalid domain
      }
    } else {
      const primary = projectData.domains.find((d) => d.isPrimary);
      if (primary) domainId = primary.id;
    }

    const suggestion = addNodeSuggestion(
      projectData.project.id,
      domainId,
      normalizePathValue(pathInput),
      field as "metaTitle" | "metaDescription" | "h1",
      value
    );

    return NextResponse.json({ suggestion });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler bei Vorschlägen.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
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
    const id = Number(body?.id);
    if (!id) {
      return NextResponse.json({ error: "ID fehlt." }, { status: 400 });
    }

    deleteNodeSuggestion(projectData.project.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler bei Vorschlägen.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
