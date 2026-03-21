import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const TIMESTAMP_COLUMNS = new Set(["created_at", "last_accessed"]);

function castPlaceholder(col: string, idx: number): string {
  return TIMESTAMP_COLUMNS.has(col) ? `$${idx}::timestamptz` : `$${idx}`;
}

export async function POST(request: Request) {
  const { table, op, record } = await request.json();

  const allowedTables = ["memories", "activity_log"];
  if (!allowedTables.includes(table)) {
    return NextResponse.json({ error: "Invalid table" }, { status: 400 });
  }

  try {
    if (op === "PUT") {
      const columns = Object.keys(record);
      const values = Object.values(record);
      const placeholders = columns
        .map((c, i) => castPlaceholder(c, i + 1))
        .join(", ");
      const columnList = columns.map((c) => `"${c}"`).join(", ");
      const updateClause = columns
        .filter((c) => c !== "id")
        .map((c) => `"${c}" = EXCLUDED."${c}"`)
        .join(", ");
      await query(
        `INSERT INTO ${table} (${columnList}) VALUES (${placeholders})
         ON CONFLICT (id) DO UPDATE SET ${updateClause}`,
        values
      );
    } else if (op === "PATCH") {
      const { id, ...updates } = record;
      const entries = Object.entries(updates);
      const setClause = entries
        .map(([col], i) => `"${col}" = ${castPlaceholder(col, i + 2)}`)
        .join(", ");
      await query(
        `UPDATE ${table} SET ${setClause} WHERE id = $1`,
        [id, ...entries.map(([, v]) => v)]
      );
    } else if (op === "DELETE") {
      await query(`DELETE FROM ${table} WHERE id = $1`, [record.id]);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
