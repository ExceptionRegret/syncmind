import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { v4 as uuid } from "uuid";

// POST /api/memories/auto — auto-capture from many sources
// Body: { text, source_type, project?, tags? }
//
// source_type values:
//   git-hook     — commit messages (conventional commits, etc.)
//   git-diff     — diff output (extracts files changed + patterns)
//   ci           — CI/CD logs (test failures, build errors, timings)
//   pr-review    — PR descriptions or review comments
//   terminal     — shell session output (errors, stack traces)
//   lint         — linter/formatter output (eslint, tsc, etc.)
//   test         — test runner output (jest, vitest, pytest, etc.)
//   deploy       — deployment logs (Vercel, Netlify, etc.)
//   chat         — Slack/Discord messages or threads
//   doc          — documentation snippets or README excerpts
//   browser      — browser console errors or network failures
//   deps         — dependency audit output (npm audit, etc.)
//   custom       — freeform text, best-effort extraction

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text, source_type, project, tags } = body;

    if (!text || !source_type) {
      return NextResponse.json(
        { error: "text and source_type are required" },
        { status: 400 }
      );
    }

    const extracted = extractLearnings(text, source_type);

    if (extracted.length === 0) {
      return NextResponse.json({ extracted: 0, message: "No learnings extracted" });
    }

    const savedIds: string[] = [];
    const dedupedIds: string[] = [];
    const now = new Date().toISOString();
    const tagStr = Array.isArray(tags) ? tags.join(",") : (tags || "");

    for (const mem of extracted) {
      // Check for dedup
      const similar = await query(
        `SELECT id FROM memories WHERE project = $1 AND similarity(content, $2) > 0.8 LIMIT 1`,
        [project || "", mem.content]
      );

      if (similar.length > 0) {
        dedupedIds.push(similar[0].id as string);
        await query(
          `UPDATE memories SET used_count = used_count + 1, last_accessed = NOW() WHERE id = $1`,
          [similar[0].id]
        );
        continue;
      }

      const id = uuid();
      savedIds.push(id);

      await query(
        `INSERT INTO memories (id, content, memory_type, source, project, tags, created_at, confidence, scope, version, used_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, 'auto', 'project', '', 0)`,
        [id, mem.content, mem.type, source_type, project || "", tagStr, now]
      );
    }

    await query(
      `INSERT INTO activity_log (id, source, action, details, created_at)
       VALUES ($1, $2, 'auto_capture', $3, $4::timestamptz)`,
      [
        uuid(),
        source_type,
        `Auto-captured ${savedIds.length} new + ${dedupedIds.length} deduped from ${source_type}`,
        now,
      ]
    );

    return NextResponse.json({
      extracted: extracted.length,
      saved: savedIds.length,
      deduped: dedupedIds.length,
      ids: savedIds,
    });
  } catch (error) {
    console.error("POST /api/memories/auto error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

interface ExtractedMemory {
  content: string;
  type: string;
}

function extractLearnings(text: string, sourceType: string): ExtractedMemory[] {
  const lines = text.split("\n").filter((l) => l.trim());

  switch (sourceType) {
    case "git-hook":
      return extractFromGit(lines);
    case "git-diff":
      return extractFromDiff(text);
    case "ci":
      return extractFromCI(lines);
    case "pr-review":
      return extractFromPR(text);
    case "terminal":
      return extractFromTerminal(lines);
    case "lint":
      return extractFromLint(lines);
    case "test":
      return extractFromTest(lines, text);
    case "deploy":
      return extractFromDeploy(lines);
    case "chat":
      return extractFromChat(text);
    case "doc":
      return extractFromDoc(text);
    case "browser":
      return extractFromBrowser(lines);
    case "deps":
      return extractFromDeps(lines);
    case "custom":
    default:
      return extractFreeform(text, lines);
  }
}

// --- Git commit messages ---
function extractFromGit(lines: string[]): ExtractedMemory[] {
  const memories: ExtractedMemory[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (t.length < 10) continue;

    // Conventional commits
    if (/^fix[\s(:/]/i.test(t)) {
      memories.push({ content: t, type: "bug" });
    } else if (/^feat[\s(:/]/i.test(t)) {
      memories.push({ content: t, type: "decision" });
    } else if (/^refactor[\s(:/]/i.test(t)) {
      memories.push({ content: t, type: "pattern" });
    } else if (/^perf[\s(:/]/i.test(t)) {
      memories.push({ content: t, type: "pattern" });
    } else if (/^(learn|note|til|docs?)[\s(:/]/i.test(t)) {
      memories.push({ content: t, type: "learning" });
    } else if (/^(break|deprecat|remov|migrat)/i.test(t)) {
      memories.push({ content: t, type: "decision" });
    } else if (/^(ci|build|chore)[\s(:/]/i.test(t)) {
      // Skip mundane chores unless long
      if (t.length > 60) memories.push({ content: t, type: "context" });
    } else if (t.length > 30) {
      memories.push({ content: t, type: "context" });
    }
  }
  return memories;
}

// --- Git diffs ---
function extractFromDiff(text: string): ExtractedMemory[] {
  const memories: ExtractedMemory[] = [];

  // Extract changed files
  const files = [...text.matchAll(/^diff --git a\/(.+?) b\//gm)].map((m) => m[1]);
  if (files.length > 0) {
    memories.push({
      content: `Files changed: ${files.slice(0, 20).join(", ")}${files.length > 20 ? ` (+${files.length - 20} more)` : ""}`,
      type: "context",
    });
  }

  // Extract added TODO/FIXME/HACK comments
  const todoLines = [...text.matchAll(/^\+.*(?:TODO|FIXME|HACK|XXX|WORKAROUND):?\s*(.+)/gm)];
  for (const match of todoLines) {
    memories.push({ content: `TODO found: ${match[1].trim()}`, type: "bug" });
  }

  // Extract new function/class definitions (patterns of what was built)
  const defs = [...text.matchAll(/^\+\s*(?:export\s+)?(?:async\s+)?(?:function|class|const\s+\w+\s*=\s*(?:async\s*)?\()\s*(\w+)/gm)];
  if (defs.length > 0) {
    const names = defs.map((m) => m[1]).slice(0, 10);
    memories.push({
      content: `New definitions added: ${names.join(", ")}`,
      type: "context",
    });
  }

  return memories;
}

// --- CI/CD logs ---
function extractFromCI(lines: string[]): ExtractedMemory[] {
  const memories: ExtractedMemory[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const line of lines) {
    const t = line.trim();

    // Test failures
    if (/(?:FAIL|FAILED|ERROR|✕|✗|×)\s/i.test(t) && t.length > 15) {
      errors.push(t);
    }
    // Warnings
    else if (/(?:WARN|WARNING|⚠)/i.test(t) && t.length > 15) {
      warnings.push(t);
    }
    // Build timing info
    else if (/(?:built in|completed in|took|duration|elapsed).*\d+/i.test(t)) {
      memories.push({ content: t, type: "context" });
    }
    // Deprecation notices
    else if (/deprecat/i.test(t)) {
      memories.push({ content: t, type: "learning" });
    }
  }

  // Batch errors into one memory if many
  if (errors.length > 0) {
    if (errors.length <= 3) {
      errors.forEach((e) => memories.push({ content: e, type: "bug" }));
    } else {
      memories.push({
        content: `${errors.length} failures:\n${errors.slice(0, 5).join("\n")}${errors.length > 5 ? `\n...and ${errors.length - 5} more` : ""}`,
        type: "bug",
      });
    }
  }

  if (warnings.length > 3) {
    memories.push({
      content: `${warnings.length} warnings in CI:\n${warnings.slice(0, 3).join("\n")}`,
      type: "learning",
    });
  }

  return memories;
}

// --- PR review ---
function extractFromPR(text: string): ExtractedMemory[] {
  const memories: ExtractedMemory[] = [];

  // Split into sections if there are headers
  const sections = text.split(/^#{1,3}\s+/m).filter((s) => s.trim());

  if (sections.length > 1) {
    // Structured PR — extract each section
    for (const section of sections) {
      const firstLine = section.split("\n")[0].trim();
      const body = section.slice(firstLine.length).trim();
      if (body.length < 20) continue;

      if (/(?:break|migration|deprecat)/i.test(firstLine)) {
        memories.push({ content: `${firstLine}: ${body.slice(0, 300)}`, type: "decision" });
      } else if (/(?:fix|bug|issue)/i.test(firstLine)) {
        memories.push({ content: `${firstLine}: ${body.slice(0, 300)}`, type: "bug" });
      } else {
        memories.push({ content: `${firstLine}: ${body.slice(0, 300)}`, type: "context" });
      }
    }
  } else if (text.length > 20) {
    // Unstructured — take as decision/context
    memories.push({ content: text.slice(0, 500), type: "decision" });
  }

  return memories;
}

// --- Terminal / shell output ---
function extractFromTerminal(lines: string[]): ExtractedMemory[] {
  const memories: ExtractedMemory[] = [];

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();

    // Stack traces
    if (/^(?:Error|TypeError|ReferenceError|SyntaxError|Uncaught)/i.test(t)) {
      // Grab error + next few lines of stack
      const stack = lines.slice(i, i + 5).map((l) => l.trim()).join("\n");
      memories.push({ content: stack, type: "bug" });
      i += 4;
    }
    // Command not found / permission denied
    else if (/(?:command not found|permission denied|EACCES|ENOENT|EPERM)/i.test(t)) {
      memories.push({ content: t, type: "bug" });
    }
    // Port already in use
    else if (/(?:EADDRINUSE|address already in use)/i.test(t)) {
      memories.push({ content: t, type: "bug" });
    }
    // OOM
    else if (/(?:out of memory|heap|ENOMEM|JavaScript heap)/i.test(t)) {
      memories.push({ content: t, type: "bug" });
    }
  }

  return memories;
}

// --- Linter output ---
function extractFromLint(lines: string[]): ExtractedMemory[] {
  const memories: ExtractedMemory[] = [];
  const errorCounts: Record<string, number> = {};

  for (const line of lines) {
    const t = line.trim();

    // ESLint-style: "rule-name" at end
    const ruleMatch = t.match(/(?:error|warning)\s+.+\s+([\w\-@/]+)\s*$/);
    if (ruleMatch) {
      const rule = ruleMatch[1];
      errorCounts[rule] = (errorCounts[rule] || 0) + 1;
    }

    // TypeScript errors: TS####
    const tsMatch = t.match(/(TS\d{4,5})/);
    if (tsMatch) {
      errorCounts[tsMatch[1]] = (errorCounts[tsMatch[1]] || 0) + 1;
    }
  }

  // Summarize by rule
  const sorted = Object.entries(errorCounts).sort((a, b) => b[1] - a[1]);
  if (sorted.length > 0) {
    const summary = sorted
      .slice(0, 10)
      .map(([rule, count]) => `${rule}: ${count}x`)
      .join(", ");
    memories.push({
      content: `Lint issues: ${summary}`,
      type: "bug",
    });
  }

  // Individual high-impact errors
  for (const [rule, count] of sorted) {
    if (count >= 5) {
      memories.push({
        content: `Recurring lint rule "${rule}" triggered ${count} times — consider a codemod or config update`,
        type: "pattern",
      });
    }
  }

  return memories;
}

// --- Test runner output ---
function extractFromTest(lines: string[], fullText: string): ExtractedMemory[] {
  const memories: ExtractedMemory[] = [];

  // Summary line: "Tests: X failed, Y passed"
  const summaryMatch = fullText.match(/(?:Tests?|Suites?):\s*(\d+)\s*failed/i);
  if (summaryMatch) {
    memories.push({
      content: `Test run: ${summaryMatch[0]}`,
      type: "bug",
    });
  }

  // Individual failing test names
  const failPatterns = [
    /(?:FAIL|✕|✗|×)\s+(.+)/,
    /●\s+(.+)/,          // Jest
    /FAILED\s+(.+)/i,    // pytest
  ];

  const failedTests: string[] = [];
  for (const line of lines) {
    for (const pat of failPatterns) {
      const m = line.trim().match(pat);
      if (m && m[1].length > 5) {
        failedTests.push(m[1].trim());
        break;
      }
    }
  }

  if (failedTests.length > 0) {
    memories.push({
      content: `Failed tests:\n${failedTests.slice(0, 10).join("\n")}`,
      type: "bug",
    });
  }

  // Coverage drops
  const covMatch = fullText.match(/coverage.*?(\d+\.?\d*)%/i);
  if (covMatch && parseFloat(covMatch[1]) < 80) {
    memories.push({
      content: `Test coverage at ${covMatch[1]}% — below 80% threshold`,
      type: "learning",
    });
  }

  // Slow tests
  const slowTests = lines
    .filter((l) => /\(\d{4,}ms\)/.test(l) || /slow/i.test(l))
    .map((l) => l.trim());
  if (slowTests.length > 0) {
    memories.push({
      content: `Slow tests detected:\n${slowTests.slice(0, 5).join("\n")}`,
      type: "pattern",
    });
  }

  return memories;
}

// --- Deploy logs ---
function extractFromDeploy(lines: string[]): ExtractedMemory[] {
  const memories: ExtractedMemory[] = [];

  for (const line of lines) {
    const t = line.trim();

    // Build errors
    if (/(?:Error|BUILD_FAILED|deploy.*fail)/i.test(t) && t.length > 15) {
      memories.push({ content: t, type: "bug" });
    }
    // Function size warnings
    else if (/(?:function size|bundle size|exceeds|limit)/i.test(t)) {
      memories.push({ content: t, type: "learning" });
    }
    // Env var issues
    else if (/(?:missing.*(?:env|variable|secret)|undefined.*(?:env|key))/i.test(t)) {
      memories.push({ content: t, type: "bug" });
    }
    // Successful deploy with URL
    else if (/(?:deployed? to|ready|live at|preview:?)\s*(https?:\/\/\S+)/i.test(t)) {
      memories.push({ content: t, type: "context" });
    }
    // Build timing
    else if (/(?:built in|compiled in|build.*\d+\s*(?:s|ms|sec))/i.test(t)) {
      memories.push({ content: t, type: "context" });
    }
  }

  return memories;
}

// --- Chat messages (Slack/Discord threads) ---
function extractFromChat(text: string): ExtractedMemory[] {
  const memories: ExtractedMemory[] = [];

  // Look for decisions, action items, key info
  const lines = text.split("\n").filter((l) => l.trim());

  for (const line of lines) {
    const t = line.trim();

    // Action items
    if (/(?:TODO|action item|follow[ -]?up|needs to|should|must|let'?s)\s*[:—-]?\s*/i.test(t) && t.length > 20) {
      memories.push({ content: t, type: "decision" });
    }
    // Decisions
    else if (/(?:decided|agreed|going with|we'?ll|plan is|approach:)/i.test(t) && t.length > 20) {
      memories.push({ content: t, type: "decision" });
    }
    // Links with context
    else if (/https?:\/\/\S+/.test(t) && t.length > 30) {
      memories.push({ content: t, type: "context" });
    }
    // Warnings/blockers
    else if (/(?:blocked|blocker|heads[ -]?up|warning|careful|watch out|don'?t)/i.test(t) && t.length > 20) {
      memories.push({ content: t, type: "learning" });
    }
  }

  // If no specific patterns matched but text is substantial, capture as context
  if (memories.length === 0 && text.length > 50) {
    memories.push({ content: text.slice(0, 500), type: "context" });
  }

  return memories;
}

// --- Documentation snippets ---
function extractFromDoc(text: string): ExtractedMemory[] {
  const memories: ExtractedMemory[] = [];

  // Code blocks are often key patterns
  const codeBlocks = [...text.matchAll(/```[\s\S]*?```/g)];
  for (const block of codeBlocks.slice(0, 3)) {
    memories.push({ content: block[0].slice(0, 400), type: "pattern" });
  }

  // Headers + their content
  const sections = text.split(/^#{1,3}\s+/m).filter((s) => s.trim().length > 20);
  for (const section of sections.slice(0, 5)) {
    if (!section.includes("```")) {
      memories.push({ content: section.trim().slice(0, 300), type: "learning" });
    }
  }

  if (memories.length === 0 && text.length > 30) {
    memories.push({ content: text.slice(0, 500), type: "learning" });
  }

  return memories;
}

// --- Browser console / network errors ---
function extractFromBrowser(lines: string[]): ExtractedMemory[] {
  const memories: ExtractedMemory[] = [];

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();

    // Console errors
    if (/(?:Uncaught|TypeError|ReferenceError|SyntaxError|ChunkLoadError)/i.test(t)) {
      const context = lines.slice(i, i + 3).map((l) => l.trim()).join("\n");
      memories.push({ content: context, type: "bug" });
      i += 2;
    }
    // Network failures
    else if (/(?:Failed to fetch|NetworkError|ERR_|CORS|403|404|500|502|503)\b/.test(t) && t.length > 10) {
      memories.push({ content: t, type: "bug" });
    }
    // React errors
    else if (/(?:Hydration|useEffect|setState.*unmounted|Maximum update depth)/i.test(t)) {
      memories.push({ content: t, type: "bug" });
    }
    // Deprecation warnings
    else if (/deprecat/i.test(t)) {
      memories.push({ content: t, type: "learning" });
    }
  }

  return memories;
}

// --- Dependency audit ---
function extractFromDeps(lines: string[]): ExtractedMemory[] {
  const memories: ExtractedMemory[] = [];
  const vulns: string[] = [];

  for (const line of lines) {
    const t = line.trim();

    // npm audit style
    if (/(?:high|critical)\s/i.test(t) && /(?:vulnerabilit|severity)/i.test(t)) {
      vulns.push(t);
    }
    // Package name + vulnerability
    else if (/(?:CVE-\d|GHSA-|prototype pollution|arbitrary code|path traversal|ReDoS)/i.test(t)) {
      vulns.push(t);
    }
    // Outdated packages
    else if (/(?:outdated|update available|new version)/i.test(t) && t.length > 15) {
      memories.push({ content: t, type: "learning" });
    }
  }

  if (vulns.length > 0) {
    memories.push({
      content: `Security vulnerabilities:\n${vulns.slice(0, 10).join("\n")}`,
      type: "bug",
    });
  }

  return memories;
}

// --- Freeform / custom text ---
function extractFreeform(text: string, lines: string[]): ExtractedMemory[] {
  const memories: ExtractedMemory[] = [];

  for (const line of lines) {
    const t = line.trim();
    if (t.length < 15) continue;

    // Try to classify by keywords
    if (/(?:bug|error|fail|broke|crash|fix)/i.test(t)) {
      memories.push({ content: t, type: "bug" });
    } else if (/(?:pattern|always|never|convention|standard|rule)/i.test(t)) {
      memories.push({ content: t, type: "pattern" });
    } else if (/(?:decided|chose|going with|switched|migrated)/i.test(t)) {
      memories.push({ content: t, type: "decision" });
    } else if (/(?:learned|til|note|remember|gotcha|trick)/i.test(t)) {
      memories.push({ content: t, type: "learning" });
    } else if (t.length > 30) {
      memories.push({ content: t, type: "context" });
    }
  }

  // Fallback: if nothing matched, capture whole text
  if (memories.length === 0 && text.length > 30) {
    memories.push({ content: text.slice(0, 500), type: "context" });
  }

  return memories;
}
