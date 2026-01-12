import { NextResponse } from "next/server";
import { getLatestProject } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const project = getLatestProject();

  if (!project) {
    return NextResponse.json({ project: null });
  }

  return NextResponse.json({ project });
}
