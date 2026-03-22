import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { v4 as uuid } from "uuid";

// POST /api/memories/export — Rich session export from AI agents
// This is the "exit gate" endpoint: agents dump their full session context here before exiting.
// Instead of thin one-liners, this captures the FULL picture of what happened in a session.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      source,        // required: who is exporting (claude-code, cursor, codex, cli, etc.)
      project,       // required: project name
      summary,       // required: what was accomplished this session (free text, as detailed as possible)
      decisions,     // optional: key decisions made and WHY (array of strings)
      bugs,          // optional: bugs found/fixed with root cause (array of strings)
      patterns,      // optional: patterns discovered or applied (array of strings)
      learnings,     // optional: things learned (array of strings)
      files_touched, // optional: files created/modified/deleted (array of strings)
      next_steps,    // optional: what's left to do (array of strings)
      tags,          // optional: tags (array of strings)
      scope,         // optional: project/team/global (default: project)
    } = body;

    if (!source || !summary) {
      return NextResponse.json(
        { error: "source and summary are required" },
        { status: 400 }
      );
    }

    const projectName = project || "";
    const sc = scope || "project";
    const tagStr = Array.isArray(tags) ? tags.join(",") : (tags || "");
    const now = new Date().toISOString();
    const results: { type: string; id: string; deduped: boolean }[] = [];

    // --- 1. Save the main session summary as a "context" memory ---
    // Build a rich composite memory from all the structured fields
    const parts: string[] = [];
    parts.push(`## Session Summary\n${summary}`);

    if (decisions?.length) {
      parts.push(`\n## Decisions\n${decisions.map((d: string) => `- ${d}`).join("\n")}`);
    }
    if (bugs?.length) {
      parts.push(`\n## Bugs\n${bugs.map((b: string) => `- ${b}`).join("\n")}`);
    }
    if (patterns?.length) {
      parts.push(`\n## Patterns\n${patterns.map((p: string) => `- ${p}`).join("\n")}`);
    }
    if (learnings?.length) {
      parts.push(`\n## Learnings\n${learnings.map((l: string) => `- ${l}`).join("\n")}`);
    }
    if (files_touched?.length) {
      parts.push(`\n## Files Touched\n${files_touched.map((f: string) => `- ${f}`).join("\n")}`);
    }
    if (next_steps?.length) {
      parts.push(`\n## Next Steps\n${next_steps.map((n: string) => `- ${n}`).join("\n")}`);
    }

    const compositeContent = parts.join("\n");

    // Check dedup against existing session summaries
    const similar = await query(
      `SELECT id, content, similarity(content, $1) AS sim
       FROM memories
       WHERE project = $2 AND memory_type = 'context' AND similarity(content, $1) > 0.8
       ORDER BY sim DESC LIMIT 1`,
      [compositeContent, projectName]
    );

    let mainId: string;
    let mainDeduped = false;

    if (similar.length > 0) {
      mainId = similar[0].id as string;
      mainDeduped = true;
      await query(
        `UPDATE memories SET content = $1, source = $2, tags = $3,
         confidence = 'auto', scope = $4, used_count = used_count + 1,
         last_accessed = NOW()
         WHERE id = $5`,
        [compositeContent, source, tagStr, sc, mainId]
      );
    } else {
      mainId = uuid();
      await query(
        `INSERT INTO memories (id, content, memory_type, source, project, tags, created_at, confidence, scope, version, used_count, last_accessed)
         VALUES ($1, $2, 'context', $3, $4, $5, $6::timestamptz, 'auto', $7, '', 0, NULL)`,
        [mainId, compositeContent, source, projectName, tagStr, now, sc]
      );
    }
    results.push({ type: "context", id: mainId, deduped: mainDeduped });

    // --- 2. Also save individual high-value items as separate typed memories ---
    // This way they're searchable by type and individually trackable

    const saveIndividual = async (items: string[] | undefined, memType: string) => {
      if (!items?.length) return;
      for (const item of items.slice(0, 10)) { // cap at 10 per type
        if (item.length < 10) continue; // skip trivially short items

        // Dedup check
        const dup = await query(
          `SELECT id, similarity(content, $1) AS sim
           FROM memories
           WHERE project = $2 AND similarity(content, $1) > 0.8
           ORDER BY sim DESC LIMIT 1`,
          [item, projectName]
        );

        if (dup.length > 0) {
          // Update existing
          await query(
            `UPDATE memories SET content = $1, source = $2, confidence = 'auto',
             used_count = used_count + 1, last_accessed = NOW()
             WHERE id = $3`,
            [item, source, dup[0].id]
          );
          results.push({ type: memType, id: dup[0].id as string, deduped: true });
        } else {
          const itemId = uuid();
          await query(
            `INSERT INTO memories (id, content, memory_type, source, project, tags, created_at, confidence, scope, version, used_count, last_accessed)
             VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, 'auto', $8, '', 0, NULL)`,
            [itemId, item, memType, source, projectName, tagStr, now, sc]
          );
          results.push({ type: memType, id: itemId, deduped: false });
        }
      }
    };

    await saveIndividual(decisions, "decision");
    await saveIndividual(bugs, "bug");
    await saveIndividual(patterns, "pattern");
    await saveIndividual(learnings, "learning");

    // --- 3. Log the export event ---
    await query(
      `INSERT INTO activity_log (id, source, action, details, created_at)
       VALUES ($1, $2, 'session_export', $3, $4::timestamptz)`,
      [uuid(), source, `${source} exported session: ${summary.slice(0, 100)}...`, now]
    );

    const saved = results.filter((r) => !r.deduped).length;
    const deduped = results.filter((r) => r.deduped).length;

    return NextResponse.json({
      ok: true,
      main_memory_id: mainId,
      total: results.length,
      saved,
      deduped,
      memories: results,
    });
  } catch (error) {
    console.error("POST /api/memories/export error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
