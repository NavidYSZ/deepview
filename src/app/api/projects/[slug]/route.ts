import { NextResponse } from "next/server";
import { getLatestSnapshotWithPayload, getProjectBySlug } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  const slug = params?.slug;
  if (!slug) {
    return NextResponse.json({ error: "Slug fehlt." }, { status: 400 });
  }

  const result = getProjectBySlug(slug);
  if (!result) {
    return NextResponse.json({ error: "Projekt nicht gefunden." }, { status: 404 });
  }

  const latestSnapshot = getLatestSnapshotWithPayload(result.project.id, "crawler");
  return NextResponse.json({ ...result, latestSnapshot });
}
