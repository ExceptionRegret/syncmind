import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { v4 as uuid } from "uuid";

// Freshness score: 0-1 based on recency + usage
function computeFreshness(createdAt: string, usedCount: number, lastAccessed: string | null): number {
  const now = Date.now();
  const ageMs = now - new Date(createdAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  // Recency: decays over 90 days
  const recency = Math.max(0, 1 - ageDays / 90);

  // Usage: log scale, caps at ~1 around 20 uses
  const usage = Math.min(1, Math.log(1 + usedCount) / Math.log(21));

  // Last accessed boost: if accessed recently, bump freshness
  let accessBoost = 0;
  if (lastAccessed) {
    const accessAgeDays = (now - new Date(lastAccessed).getTime()) / (1000 * 60 * 60 * 24);
    accessBoost = Math.max(0, 0.2 * (1 - accessAgeDays / 30));
  }

  return Math.min(1, 0.5 * recency + 0.3 * usage + 0.2 + accessBoost);
}

// GET /api/memories — list and search memories
// Query params: search, source, project, type, scope, confidence, limit
export async function GET(request: Request) {
  const url = new URL(request.url);
  const search = url.searchParams.get("search");
  const source = url.searchParams.get("source");
  const project = url.searchParams.get("project");
  const type = url.searchParams.get("type");
  const scope = url.searchParams.get("scope");
  const confidence = url.searchParams.get("confidence");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
  const noBump = url.searchParams.get("no_bump") === "true";

  try {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (search) {
      conditions.push(`to_tsvector('english', content) @@ plainto_tsquery('english', $${paramIdx})`);
      params.push(search);
      paramIdx++;
    }

    if (source) {
      conditions.push(`source = $${paramIdx}`);
      params.push(source);
      paramIdx++;
    }

    if (project) {
      conditions.push(`(project = $${paramIdx} OR scope = 'global')`);
      params.push(project);
      paramIdx++;
    }

    if (type) {
      conditions.push(`memory_type = $${paramIdx}`);
      params.push(type);
      paramIdx++;
    }

    if (scope) {
      conditions.push(`scope = $${paramIdx}`);
      params.push(scope);
      paramIdx++;
    }

    if (confidence) {
      conditions.push(`confidence = $${paramIdx}`);
      params.push(confidence);
      paramIdx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const memories = await query(
      `SELECT * FROM memories ${where} ORDER BY created_at DESC LIMIT $${paramIdx}`,
      [...params, limit]
    );

    // Compute freshness for each memory
    const enriched = memories.map((m: Record<string, unknown>) => ({
      ...m,
      freshness: computeFreshness(
        m.created_at as string,
        (m.used_count as number) || 0,
        m.last_accessed as string | null
      ),
    }));

    // Sort by freshness (highest first)
    enriched.sort((a: { freshness: number }, b: { freshness: number }) => b.freshness - a.freshness);

    // Bump used_count + last_accessed for returned memories (unless no_bump)
    if (!noBump && memories.length > 0) {
      const ids = memories.map((m: Record<string, unknown>) => m.id);
      // Fire-and-forget bump
      query(
        `UPDATE memories SET used_count = used_count + 1, last_accessed = NOW() WHERE id = ANY($1::uuid[])`,
        [ids]
      ).catch(() => {});
    }

    return NextResponse.json({ memories: enriched, count: enriched.length });
  } catch (error) {
    console.error("GET /api/memories error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// POST /api/memories — write a memory (with smart dedup)
// Body: { content, type?, source, project?, tags?, confidence?, scope?, version? }
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { content, type, source, project, tags, confidence, scope, version } = body;

    if (!content || !source) {
      return NextResponse.json(
        { error: "content and source are required" },
        { status: 400 }
      );
    }

    const memoryType = type || "learning";
    const projectName = project || "";
    const tagStr = Array.isArray(tags) ? tags.join(",") : (tags || "");
    const conf = confidence || "speculative";
    const sc = scope || "project";
    const ver = version || "";

    // Smart dedup: check for >80% similar content in same project
    const similar = await query(
      `SELECT id, content, similarity(content, $1) AS sim
       FROM memories
       WHERE project = $2 AND similarity(content, $1) > 0.8
       ORDER BY sim DESC LIMIT 1`,
      [content, projectName]
    );

    if (similar.length > 0) {
      // Update existing memory instead of creating new
      const existingId = similar[0].id;
      await query(
        `UPDATE memories SET content = $1, memory_type = $2, source = $3, tags = $4,
         confidence = $5, scope = $6, version = $7, used_count = used_count + 1,
         last_accessed = NOW()
         WHERE id = $8`,
        [content, memoryType, source, tagStr, conf, sc, ver, existingId]
      );

      await query(
        `INSERT INTO activity_log (id, source, action, details, created_at)
         VALUES ($1, $2, 'memory_dedup', $3, NOW()::timestamptz)`,
        [uuid(), source, `Merged with existing: ${(similar[0].content as string).slice(0, 60)}...`]
      );

      return NextResponse.json({ id: existingId, deduped: true, similarity: similar[0].sim });
    }

    // No duplicate — insert new
    const id = uuid();
    const now = new Date().toISOString();

    await query(
      `INSERT INTO memories (id, content, memory_type, source, project, tags, created_at, confidence, scope, version, used_count, last_accessed)
       VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8, $9, $10, 0, NULL)`,
      [id, content, memoryType, source, projectName, tagStr, now, conf, sc, ver]
    );

    await query(
      `INSERT INTO activity_log (id, source, action, details, created_at)
       VALUES ($1, $2, 'memory_write', $3, $4::timestamptz)`,
      [uuid(), source, `${source} wrote: ${content.slice(0, 80)}...`, now]
    );

    return NextResponse.json({ id, created_at: now, deduped: false });
  } catch (error) {
    console.error("POST /api/memories error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// DELETE /api/memories — delete a memory
// Body: { id }
export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await query("DELETE FROM memories WHERE id = $1", [id]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/memories error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
