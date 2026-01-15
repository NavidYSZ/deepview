import { NextResponse } from "next/server";
import { getLatestSnapshotWithPayload, listProjects } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const projects = listProjects();
  for (const entry of projects) {
    const snapshot = getLatestSnapshotWithPayload(entry.project.id, "crawler");
    if (snapshot) {
      return NextResponse.json({
        project: {
          domain: snapshot.domain,
          nodes: snapshot.nodes,
          edges: snapshot.edges,
          createdAt: snapshot.snapshot.createdAt,
        },
      });
    }
  }

  return NextResponse.json({ project: null });
}
