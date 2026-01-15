import { NextResponse } from "next/server";
import { createProject, listProjects } from "@/lib/db";
import { normalizeDomain } from "@/lib/crawler";

export const runtime = "nodejs";

export async function GET() {
  const projects = listProjects();
  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = (body?.name as string | undefined)?.trim();
    const domainInput = (body?.domain as string | undefined)?.trim();
    const slug = (body?.slug as string | undefined)?.trim();
    const settings = (body?.settings as Record<string, unknown>) || {};

    if (!name) {
      return NextResponse.json({ error: "Projektname fehlt." }, { status: 400 });
    }
    if (!domainInput) {
      return NextResponse.json({ error: "Domain fehlt." }, { status: 400 });
    }

    const normalized = normalizeDomain(domainInput);
    const hostname = new URL(normalized).hostname;

    const result = createProject(name, hostname, slug, settings);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Fehler beim Anlegen des Projekts.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
