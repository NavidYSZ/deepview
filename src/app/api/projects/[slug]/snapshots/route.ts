import { NextResponse } from "next/server";
import { getProjectBySlug, listSnapshots } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: { slug: string } }) {
  const slug = params?.slug;
  if (!slug) {
    return NextResponse.json({ error: "Slug fehlt." }, { status: 400 });
  }

  const source = new URL(request.url).searchParams.get("source") || undefined;
  const projectData = getProjectBySlug(slug);
  if (!projectData) {
    return NextResponse.json({ error: "Projekt nicht gefunden." }, { status: 404 });
  }

  const snapshots = listSnapshots(projectData.project.id, source || undefined);
  return NextResponse.json({ snapshots });
}
