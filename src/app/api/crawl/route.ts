import { NextResponse } from "next/server";
import { crawlDomain } from "@/lib/crawler";
import { saveProject } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const domain = (body?.domain as string | undefined)?.trim();
    const depthInput = Number(body?.depth);
    const depth = Number.isFinite(depthInput) ? depthInput : 1;

    if (!domain) {
      return NextResponse.json({ error: "Bitte eine Domain angeben." }, { status: 400 });
    }

    const result = await crawlDomain(domain, depth);
    saveProject(result.domain, result.nodes, result.edges);

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler beim Crawlen.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
