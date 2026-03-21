import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// POST /api/memories/bump — explicitly mark a memory as used
// Body: { id }
export async function POST(request: Request) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const result = await query(
      `UPDATE memories SET used_count = used_count + 1, last_accessed = NOW()
       WHERE id = $1 RETURNING used_count, last_accessed`,
      [id]
    );

    if (result.length === 0) {
      return NextResponse.json({ error: "Memory not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      used_count: result[0].used_count,
      last_accessed: result[0].last_accessed,
    });
  } catch (error) {
    console.error("POST /api/memories/bump error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
