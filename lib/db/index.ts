import { neon } from "@neondatabase/serverless";

export async function query(
  queryStr: string,
  params: unknown[] = []
): Promise<Record<string, unknown>[]> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL is not set");
  }
  const sql = neon(dbUrl);
  const result = await sql.query(queryStr, params);
  // sql.query() returns the rows array directly (no .rows property)
  return (Array.isArray(result) ? result : []) as Record<string, unknown>[];
}
