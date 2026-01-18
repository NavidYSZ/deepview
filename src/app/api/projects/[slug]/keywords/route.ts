import { NextRequest, NextResponse } from "next/server";
import { normalizeDomain } from "@/lib/crawler";
import {
  createKeywordImport,
  ensureDomain,
  ensureFeature,
  getKeywords,
  getProjectBySlug,
  saveKeywords,
} from "@/lib/db";
import { parseKeywordBuffer } from "@/lib/keywords";

export const runtime = "nodejs";

const stripWww = (host: string | undefined | null) => (host ? host.replace(/^www\./i, "") : "");

const matchDomain = (domains: Array<{ hostname: string; id: number }>, host: string | undefined | null) =>
  domains.find((d) => stripWww(d.hostname) === stripWww(host));

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
  const path = url.searchParams.get("path") || undefined;
  const domainParam = url.searchParams.get("domain") || undefined;

  let domainId: number | undefined;
  if (domainParam) {
    try {
      const host = new URL(normalizeDomain(domainParam)).hostname;
      const found = matchDomain(projectData.domains, host);
      if (found) {
        domainId = found.id;
      }
    } catch {
      // ignore invalid domain param
    }
  }

  const keywords = getKeywords(projectData.project.id, {
    path: path || undefined,
    domainId,
  });

  return NextResponse.json({ keywords });
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

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Datei fehlt." }, { status: 400 });
    }
    const source = (formData.get("source") as string) || "upload";
    const domainInput = (formData.get("domain") as string | null)?.trim();
    const baseDomain = domainInput || projectData.domains.find((d) => d.isPrimary)?.hostname;
    if (!baseDomain) {
      return NextResponse.json({ error: "Keine Domain für Mapping hinterlegt." }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseKeywordBuffer(fileBuffer, (file as File).name || null, { fallbackDomain: baseDomain });
    if (!parsed.length) {
      return NextResponse.json({ error: "Keine Keywords gefunden." }, { status: 400 });
    }

    const domainCache = new Map<string, { id: number; hostname: string }>();
    projectData.domains.forEach((d) => domainCache.set(stripWww(d.hostname), { id: d.id, hostname: d.hostname }));

    const ensureDomainForHost = (host: string | undefined | null) => {
      const normalizedHost = host ? new URL(normalizeDomain(host)).hostname : new URL(normalizeDomain(baseDomain)).hostname;
      const key = stripWww(normalizedHost);
      const cached = domainCache.get(key);
      if (cached) return cached;
      const created = ensureDomain(projectData.project.id, normalizedHost, false);
      domainCache.set(key, { id: created.id, hostname: created.hostname });
      return { id: created.id, hostname: created.hostname };
    };

    ensureFeature(projectData.project.id, "keywords");

    const rowsForSave = parsed.map((row) => {
      const domain = ensureDomainForHost(row.host || baseDomain);
      return {
        term: row.term,
        url: row.url || null,
        path: row.path,
        volume: row.volume ?? null,
        difficulty: row.difficulty ?? null,
        position: row.position ?? null,
        meta: row.meta,
        domainId: domain.id,
      };
    });

    const importRow = createKeywordImport(
      projectData.project.id,
      rowsForSave[0]?.domainId ?? null,
      source,
      (file as File).name || null,
      { totalRows: parsed.length }
    );

    const saved = saveKeywords(projectData.project.id, importRow.id, rowsForSave);

    return NextResponse.json({
      import: importRow,
      created: saved.length,
      keywords: saved,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler beim Keyword-Upload.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
