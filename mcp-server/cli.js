#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { execSync, spawn } = require("child_process");
const http = require("http");
const https = require("https");

// ── Resolve SyncMind root (works from anywhere) ─────────────────────
const SYNCMIND_ROOT = path.resolve(__dirname, "..");
const MCP_DIR = __dirname;
const MCP_ENTRY = path.join(MCP_DIR, "index.js");

// ── Helpers ─────────────────────────────────────────────────────────
const C = { reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m", red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m", cyan: "\x1b[36m", magenta: "\x1b[35m", blue: "\x1b[34m" };
function log(msg) { console.log(`${C.cyan}[syncmind]${C.reset} ${msg}`); }
function ok(msg)  { console.log(`${C.green}  ✓${C.reset} ${msg}`); }
function warn(msg){ console.log(`${C.yellow}  !${C.reset} ${msg}`); }
function err(msg) { console.log(`${C.red}  ✗${C.reset} ${msg}`); }

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question(question, (a) => { rl.close(); r(a.trim()); }));
}

function writeJson(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}

function readJson(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); } catch { return null; }
}

function hasBin(name) {
  try { execSync(`${process.platform === "win32" ? "where" : "which"} ${name}`, { stdio: "ignore" }); return true; } catch { return false; }
}

// ── HTTP fetch helper (works without global fetch) ──────────────────
function httpFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    const method = options.method || "GET";
    const parsed = new URL(url);
    const req = mod.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method,
      headers: { "Content-Type": "application/json", ...options.headers },
      timeout: 5000,
    }, (res) => {
      let body = "";
      res.on("data", (d) => body += d);
      res.on("end", () => {
        try { resolve({ ok: res.statusCode < 400, status: res.statusCode, json: JSON.parse(body) }); }
        catch { resolve({ ok: res.statusCode < 400, status: res.statusCode, text: body }); }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
    if (options.body) req.write(typeof options.body === "string" ? options.body : JSON.stringify(options.body));
    req.end();
  });
}

// ── Auto-detect URL from .env.local or env ──────────────────────────
function detectUrl() {
  if (process.env.SYNCMIND_URL) return process.env.SYNCMIND_URL;
  const envFile = path.join(SYNCMIND_ROOT, ".env.local");
  if (fs.existsSync(envFile)) {
    const content = fs.readFileSync(envFile, "utf8");
    const urlMatch = content.match(/^SYNCMIND_URL=(.+)$/m);
    if (urlMatch) return urlMatch[1].trim();
    const portMatch = content.match(/^PORT=(\d+)$/m);
    if (portMatch) return `http://localhost:${portMatch[1].trim()}`;
  }
  const mcpJson = readJson(path.join(SYNCMIND_ROOT, ".mcp.json"));
  if (mcpJson?.mcpServers?.syncmind?.env?.SYNCMIND_URL) {
    return mcpJson.mcpServers.syncmind.env.SYNCMIND_URL;
  }
  return "http://localhost:3000";
}

// ── Check if SyncMind server is running ─────────────────────────────
async function checkServer(url) {
  try {
    const res = await httpFetch(`${url}/api/memories?limit=1&no_bump=true`);
    return res.ok;
  } catch { return false; }
}

function printServerHelp(url) {
  console.log();
  err(`SyncMind is not running at ${C.bold}${url}${C.reset}`);
  console.log();
  console.log(`  ${C.dim}To start it:${C.reset}`);
  console.log(`    ${C.bold}cd ${SYNCMIND_ROOT}${C.reset}`);
  console.log(`    ${C.bold}npm run dev${C.reset}`);
  console.log();
  console.log(`  ${C.dim}If using a different URL, set it:${C.reset}`);
  console.log(`    ${C.bold}syncmind install --url https://your-syncmind.vercel.app${C.reset}`);
  console.log();
}

// ── MCP config block ────────────────────────────────────────────────
function mcpBlock(url, isLinked) {
  return {
    type: "stdio",
    command: isLinked ? "syncmind-mcp" : "node",
    args: isLinked ? [] : [MCP_ENTRY],
    env: { SYNCMIND_URL: url },
  };
}

// ── IDE installers ──────────────────────────────────────────────────
function setupClaude(url, linked) {
  log("Claude Code...");
  if (!hasBin("claude")) { err("claude CLI not found — install: npm i -g @anthropic-ai/claude-code"); return false; }
  try { execSync("claude mcp remove syncmind -s user 2>&1", { stdio: "ignore" }); } catch {}
  const cmd = linked
    ? `claude mcp add syncmind -s user -e SYNCMIND_URL=${url} -- syncmind-mcp`
    : `claude mcp add syncmind -s user -e SYNCMIND_URL=${url} -- node "${MCP_ENTRY}"`;
  try { execSync(cmd, { stdio: "inherit" }); ok("Claude Code — added globally"); return true; }
  catch { err("Claude Code — failed"); return false; }
}

function setupCursor(url, linked) {
  log("Cursor...");
  const p = path.join(process.cwd(), ".cursor", "mcp.json");
  const c = readJson(p) || { mcpServers: {} };
  c.mcpServers = c.mcpServers || {};
  c.mcpServers.syncmind = mcpBlock(url, linked);
  writeJson(p, c);
  ok(`Cursor — ${p}`);
  return true;
}

function setupVSCode(url, linked) {
  log("VS Code...");
  const p = path.join(process.cwd(), ".vscode", "mcp.json");
  const c = readJson(p) || { servers: {} };
  c.servers = c.servers || {};
  c.servers.syncmind = mcpBlock(url, linked);
  writeJson(p, c);
  ok(`VS Code — ${p}`);
  return true;
}

function setupWindsurf(url, linked) {
  log("Windsurf...");
  const p = path.join(process.cwd(), ".windsurf", "mcp.json");
  const c = readJson(p) || { mcpServers: {} };
  c.mcpServers = c.mcpServers || {};
  c.mcpServers.syncmind = mcpBlock(url, linked);
  writeJson(p, c);
  ok(`Windsurf — ${p}`);
  return true;
}

function setupProject(url, linked) {
  log("Project .mcp.json...");
  const p = path.join(process.cwd(), ".mcp.json");
  const c = readJson(p) || { mcpServers: {} };
  c.mcpServers = c.mcpServers || {};
  c.mcpServers.syncmind = mcpBlock(url, linked);
  writeJson(p, c);
  ok(`.mcp.json — ${p}`);
  return true;
}

// ── Link globally ───────────────────────────────────────────────────
function linkGlobally() {
  log("Installing dependencies...");
  execSync("npm install", { cwd: MCP_DIR, stdio: "inherit" });
  log("Linking globally...");
  try { execSync("npm link", { cwd: MCP_DIR, stdio: "inherit" }); ok("syncmind & syncmind-mcp commands available globally"); return true; }
  catch { warn("npm link failed — using absolute path"); return false; }
}

// ══════════════════════════════════════════════════════════════════════
// ── Commands ────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════

const TOOLS = { claude: setupClaude, cursor: setupCursor, vscode: setupVSCode, windsurf: setupWindsurf };

// ── install ─────────────────────────────────────────────────────────
async function cmdInstall(args) {
  console.log();
  console.log(`  ${C.bold}${C.magenta}Sync${C.cyan}Mind${C.reset} ${C.dim}MCP Installer${C.reset}`);
  console.log();

  let url = null, tool = null;
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--url" || args[i] === "-u") && args[i + 1]) url = args[++i];
    else if ((args[i] === "--tool" || args[i] === "-t") && args[i + 1]) tool = args[++i].toLowerCase();
  }

  url = url || detectUrl();
  log(`SyncMind URL: ${C.bold}${url}${C.reset}`);

  const running = await checkServer(url);
  if (running) {
    ok("Server is running");
  } else {
    printServerHelp(url);
    const cont = await ask(`  Continue anyway? ${C.dim}(y/N)${C.reset} `);
    if (cont.toLowerCase() !== "y") { process.exit(0); }
  }

  console.log();
  const linked = linkGlobally();
  console.log();

  let selected = [];
  if (tool === "all") {
    selected = Object.keys(TOOLS);
  } else if (tool && TOOLS[tool]) {
    selected = [tool];
  } else {
    const detected = [];
    if (hasBin("claude")) detected.push("claude");
    if (hasBin("cursor")) detected.push("cursor");
    if (hasBin("code")) detected.push("vscode");
    if (hasBin("windsurf")) detected.push("windsurf");

    const entries = Object.entries(TOOLS);
    console.log("  Which IDE?\n");
    entries.forEach(([key], i) => {
      const tag = detected.includes(key) ? ` ${C.green}(detected)${C.reset}` : "";
      console.log(`    ${C.bold}${i + 1}${C.reset}. ${key}${tag}`);
    });
    console.log(`    ${C.bold}${entries.length + 1}${C.reset}. All`);
    console.log(`    ${C.bold}${entries.length + 2}${C.reset}. Just .mcp.json (works with any MCP client)`);
    console.log();

    const choice = parseInt(await ask("  Pick: "));
    if (choice >= 1 && choice <= entries.length) selected = [entries[choice - 1][0]];
    else if (choice === entries.length + 1) selected = Object.keys(TOOLS);
    else if (choice === entries.length + 2) { setupProject(url, linked); printDone(url); return; }
    else { err("Invalid"); process.exit(1); }
  }

  console.log();
  for (const k of selected) TOOLS[k](url, linked);
  setupProject(url, linked);
  printDone(url);
}

// ── status ──────────────────────────────────────────────────────────
async function cmdStatus() {
  const url = detectUrl();
  console.log();
  log(`URL: ${C.bold}${url}${C.reset}`);
  const running = await checkServer(url);
  if (running) {
    ok("Server is running");
    try {
      const res = await httpFetch(`${url}/api/memories?limit=200&no_bump=true`);
      if (res.ok) {
        const count = res.json.count || 0;
        ok(`${count} memories`);
        // Count stale (rough — just by age since we can't compute freshness server-side here)
        const memories = res.json.memories || [];
        const now = Date.now();
        const stale = memories.filter((m) => {
          const ageDays = (now - new Date(m.created_at).getTime()) / 86400000;
          return ageDays > 30 && (m.used_count || 0) < 2;
        }).length;
        if (stale > 0) warn(`${stale} potentially stale memories`);
      }
    } catch {}
  } else {
    printServerHelp(url);
  }

  if (hasBin("syncmind-mcp")) ok("syncmind-mcp command is installed globally");
  else warn("syncmind-mcp not linked — run: syncmind install");

  if (hasBin("claude")) {
    try {
      const out = execSync("claude mcp list 2>&1", { encoding: "utf8" });
      if (out.includes("syncmind") && out.includes("Connected")) ok("Claude Code MCP: connected");
      else if (out.includes("syncmind")) warn("Claude Code MCP: registered but not connected");
      else warn("Claude Code MCP: not registered — run: syncmind install");
    } catch {}
  }
  console.log();
}

// ── restart ─────────────────────────────────────────────────────────
async function cmdRestart(args) {
  console.log();
  log("Restarting SyncMind...");

  // Re-link to pick up code changes
  log("Re-linking MCP server...");
  try {
    execSync("npm install", { cwd: MCP_DIR, stdio: "pipe" });
    execSync("npm link", { cwd: MCP_DIR, stdio: "pipe" });
    ok("MCP server re-linked");
  } catch {
    warn("npm link failed — MCP will use absolute path");
  }

  // Re-register with Claude Code (picks up new tools, new code)
  if (hasBin("claude")) {
    log("Re-registering with Claude Code...");
    const url = detectUrl();
    try { execSync("claude mcp remove syncmind -s user 2>&1", { stdio: "ignore" }); } catch {}
    const linked = hasBin("syncmind-mcp");
    const cmd = linked
      ? `claude mcp add syncmind -s user -e SYNCMIND_URL=${url} -- syncmind-mcp`
      : `claude mcp add syncmind -s user -e SYNCMIND_URL=${url} -- node "${MCP_ENTRY}"`;
    try {
      execSync(cmd, { stdio: "pipe" });
      ok("Claude Code MCP re-registered");
    } catch {
      warn("Claude Code re-registration failed");
    }
  }

  // Check if Next.js dev server needs restart
  const restartDev = args.includes("--dev") || args.includes("-d");
  if (restartDev) {
    log("Restarting Next.js dev server...");
    // Kill existing dev server
    try {
      if (process.platform === "win32") {
        execSync('taskkill /f /im node.exe /fi "WINDOWTITLE eq next*" 2>nul', { stdio: "ignore" });
      } else {
        execSync("pkill -f 'next dev' 2>/dev/null", { stdio: "ignore" });
      }
    } catch {}
    // Start new dev server in background
    const child = spawn("npm", ["run", "dev"], {
      cwd: SYNCMIND_ROOT,
      detached: true,
      stdio: "ignore",
      shell: true,
    });
    child.unref();
    ok("Dev server restarting in background");
  }

  ok("Restart complete");
  console.log();
  console.log(`  ${C.dim}Note: If you have an active Claude Code session, restart it or${C.reset}`);
  console.log(`  ${C.dim}type /mcp to reconnect to the updated MCP server.${C.reset}`);
  console.log();
}

// ── capture ─────────────────────────────────────────────────────────
async function cmdCapture(args) {
  const url = detectUrl();
  const running = await checkServer(url);
  if (!running) { printServerHelp(url); process.exit(1); }

  // Parse flags
  let sourceType = null, project = null, inputText = null;
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--type" || args[i] === "-t") && args[i + 1]) sourceType = args[++i];
    else if ((args[i] === "--project" || args[i] === "-p") && args[i + 1]) project = args[++i];
    else if ((args[i] === "--text" || args[i] === "-m") && args[i + 1]) inputText = args[++i];
    else if (args[i] === "--stdin") inputText = "__stdin__";
  }

  // Auto-detect project from git
  if (!project) {
    try {
      const remote = execSync("git remote get-url origin 2>/dev/null", { encoding: "utf8" }).trim();
      project = remote.split("/").pop().replace(/\.git$/, "");
    } catch {
      try { project = path.basename(process.cwd()); } catch {}
    }
  }

  // If no source_type given, try to auto-detect from context
  if (!sourceType) {
    if (inputText === "__stdin__") sourceType = "custom";
    else sourceType = "custom";
  }

  console.log();
  log(`Capturing from ${C.bold}${sourceType}${C.reset} for project ${C.bold}${project || "(none)"}${C.reset}`);

  // Gather text to capture
  let text = "";

  if (inputText === "__stdin__") {
    // Read from stdin (piped input)
    text = fs.readFileSync(0, "utf8");
  } else if (inputText) {
    text = inputText;
  } else {
    // Auto-gather based on source type
    text = autoGatherText(sourceType);
    if (!text) {
      err("No text to capture. Use --text, --stdin, or let auto-detect gather from git/env.");
      console.log();
      return;
    }
  }

  log(`Captured ${text.length} chars, sending to auto-capture API...`);

  try {
    const res = await httpFetch(`${url}/api/memories/auto`, {
      method: "POST",
      body: JSON.stringify({ text, source_type: sourceType, project }),
    });

    if (res.ok && res.json) {
      const { saved, deduped, extracted } = res.json;
      ok(`Extracted ${extracted} memories: ${saved} new, ${deduped} deduped`);
    } else {
      err(`API error: ${res.json?.error || res.status}`);
    }
  } catch (e) {
    err(`Failed: ${e.message}`);
  }
  console.log();
}

function autoGatherText(sourceType) {
  switch (sourceType) {
    case "git-hook":
    case "git": {
      // Last 5 commit messages
      try {
        return execSync('git log -5 --format="%B" 2>/dev/null', { encoding: "utf8" }).trim();
      } catch { return ""; }
    }
    case "git-diff": {
      try {
        return execSync("git diff HEAD~1 --stat 2>/dev/null", { encoding: "utf8" }).trim();
      } catch { return ""; }
    }
    case "lint": {
      try {
        return execSync("npm run lint 2>&1", { encoding: "utf8", cwd: process.cwd(), timeout: 30000 }).trim();
      } catch (e) {
        return e.stdout || e.stderr || "";
      }
    }
    case "test": {
      try {
        return execSync("npm test 2>&1", { encoding: "utf8", cwd: process.cwd(), timeout: 60000 }).trim();
      } catch (e) {
        return e.stdout || e.stderr || "";
      }
    }
    case "deps": {
      try {
        return execSync("npm audit 2>&1", { encoding: "utf8", cwd: process.cwd(), timeout: 30000 }).trim();
      } catch (e) {
        return e.stdout || e.stderr || "";
      }
    }
    default: return "";
  }
}

// ── pull ─────────────────────────────────────────────────────────────
async function cmdPull(args) {
  console.log();
  log("Pulling latest SyncMind...");

  try {
    const output = execSync("git pull 2>&1", { encoding: "utf8", cwd: SYNCMIND_ROOT });
    console.log(`  ${C.dim}${output.trim()}${C.reset}`);
    if (output.includes("Already up to date")) {
      ok("Already up to date");
    } else {
      ok("Pulled latest changes");
      // Reinstall deps if package.json changed
      if (output.includes("package.json") || output.includes("package-lock.json")) {
        log("package.json changed — reinstalling...");
        execSync("npm install", { cwd: SYNCMIND_ROOT, stdio: "inherit" });
        ok("Dependencies updated");
      }
      // Re-link MCP
      log("Re-linking MCP server...");
      execSync("npm install", { cwd: MCP_DIR, stdio: "pipe" });
      try { execSync("npm link", { cwd: MCP_DIR, stdio: "pipe" }); } catch {}
      ok("MCP server re-linked");

      // Auto-restart if --restart flag
      if (args.includes("--restart") || args.includes("-r")) {
        await cmdRestart([]);
      }
    }
  } catch (e) {
    err(`Git pull failed: ${e.message}`);
  }
  console.log();
}

// ── session (auto-capture on session start/end) ─────────────────────
async function cmdSession(args) {
  const action = args[0]; // "start" or "end"
  const url = detectUrl();
  const running = await checkServer(url);
  if (!running) return; // silently skip if server is down

  let project = null;
  for (let i = 1; i < args.length; i++) {
    if ((args[i] === "--project" || args[i] === "-p") && args[i + 1]) project = args[++i];
  }

  // Auto-detect project
  if (!project) {
    try {
      const remote = execSync("git remote get-url origin 2>/dev/null", { encoding: "utf8" }).trim();
      project = remote.split("/").pop().replace(/\.git$/, "");
    } catch {
      try { project = path.basename(process.cwd()); } catch {}
    }
  }

  // Detect IDE/tool
  const source =
    process.env.SYNCMIND_SOURCE ||
    (process.env.CURSOR_TRACE_ID ? "cursor" : null) ||
    (process.env.CODEX_ENV ? "codex" : null) ||
    (process.env.TERM_PROGRAM === "vscode" ? "vscode" : null) ||
    (process.env.CLAUDE_CODE ? "claude-code" : null) ||
    "cli";

  if (action === "start") {
    // On session start: read recent memories to prime the agent
    console.log();
    log(`Session started — ${C.bold}${source}${C.reset} @ ${C.bold}${project || "?"}${C.reset}`);
    try {
      const res = await httpFetch(`${url}/api/memories?project=${encodeURIComponent(project || "")}&limit=5&no_bump=true`);
      if (res.ok && res.json.memories?.length > 0) {
        ok(`${res.json.memories.length} recent memories available`);
        for (const m of res.json.memories.slice(0, 3)) {
          console.log(`  ${C.dim}[${m.memory_type}]${C.reset} ${(m.content || "").slice(0, 80)}`);
        }
      } else {
        ok("No memories yet for this project");
      }
    } catch {}
    console.log();
  } else if (action === "end") {
    // On session end: auto-capture recent git commits made during this session
    console.log();
    log(`Session ending — auto-capturing from ${C.bold}${source}${C.reset}...`);

    const captured = [];

    // 1. Recent git commits (last hour)
    try {
      const since = new Date(Date.now() - 3600000).toISOString();
      const commits = execSync(`git log --since="${since}" --format="%B" 2>/dev/null`, { encoding: "utf8" }).trim();
      if (commits && commits.length > 10) {
        const res = await httpFetch(`${url}/api/memories/auto`, {
          method: "POST",
          body: JSON.stringify({ text: commits, source_type: "git-hook", project }),
        });
        if (res.ok) captured.push(`git: ${res.json.saved || 0} new`);
      }
    } catch {}

    // 2. Recent git diff (what changed)
    try {
      const diff = execSync("git diff --stat HEAD~3 2>/dev/null", { encoding: "utf8" }).trim();
      if (diff && diff.length > 10) {
        const res = await httpFetch(`${url}/api/memories/auto`, {
          method: "POST",
          body: JSON.stringify({ text: diff, source_type: "git-diff", project }),
        });
        if (res.ok) captured.push(`diff: ${res.json.saved || 0} new`);
      }
    } catch {}

    // 3. Check for uncommitted changes (context)
    try {
      const status = execSync("git status --short 2>/dev/null", { encoding: "utf8" }).trim();
      if (status && status.split("\n").length > 0) {
        const files = status.split("\n").map((l) => l.trim()).filter(Boolean);
        const text = `Session ended with ${files.length} uncommitted changes:\n${files.slice(0, 15).join("\n")}`;
        const res = await httpFetch(`${url}/api/memories/auto`, {
          method: "POST",
          body: JSON.stringify({ text, source_type: "git-diff", project }),
        });
        if (res.ok) captured.push(`uncommitted: ${res.json.saved || 0} new`);
      }
    } catch {}

    // 4. Log the session end
    try {
      await httpFetch(`${url}/api/memories`, {
        method: "POST",
        body: JSON.stringify({
          content: `Session ended: ${source} worked on ${project || "unknown"} — ${captured.join(", ") || "no new captures"}`,
          source,
          type: "context",
          project: project || "",
          confidence: "auto",
          scope: "project",
        }),
      });
    } catch {}

    if (captured.length > 0) {
      ok(`Captured: ${captured.join(", ")}`);
    } else {
      ok("No new learnings to capture");
    }
    console.log();
  } else {
    err('Usage: syncmind session <start|end> [--project name]');
  }
}

// ── hooks (setup auto-capture hooks in IDE configs) ─────────────────
async function cmdHooks(args) {
  const url = detectUrl();
  console.log();
  console.log(`  ${C.bold}${C.magenta}Sync${C.cyan}Mind${C.reset} ${C.dim}Auto-Capture Hooks${C.reset}`);
  console.log();

  // 1. Claude Code hooks (settings.json)
  if (hasBin("claude")) {
    log("Setting up Claude Code hooks...");

    const claudeDir = path.join(process.env.HOME || process.env.USERPROFILE || "~", ".claude");
    const settingsPath = path.join(claudeDir, "settings.json");
    const settings = readJson(settingsPath) || {};

    settings.hooks = settings.hooks || {};

    // Stop hook — fires when Claude Code session ends
    settings.hooks.Stop = settings.hooks.Stop || [];
    const stopHook = {
      matcher: "",
      hooks: [{
        type: "command",
        command: `syncmind session end --project "$(basename $(git rev-parse --show-toplevel 2>/dev/null || echo unknown))"`,
      }],
    };

    // Check if we already added our hook
    const hasStop = settings.hooks.Stop.some((h) =>
      h.hooks?.some((hh) => hh.command?.includes("syncmind session end"))
    );
    if (!hasStop) {
      settings.hooks.Stop.push(stopHook);
      ok("Added Stop hook (auto-capture on session end)");
    } else {
      ok("Stop hook already configured");
    }

    // PreToolUse hook — capture after git commits
    settings.hooks.PreToolUse = settings.hooks.PreToolUse || [];
    const commitHook = {
      matcher: "Bash",
      hooks: [{
        type: "command",
        command: `node -e "const c=process.env.TOOL_INPUT||'';if(c.includes('git commit')){const{execSync}=require('child_process');try{execSync('syncmind capture --type git-hook',{stdio:'ignore',timeout:5000})}catch{}}"`,
      }],
    };
    const hasCommit = settings.hooks.PreToolUse.some((h) =>
      h.hooks?.some((hh) => hh.command?.includes("syncmind capture"))
    );
    if (!hasCommit) {
      settings.hooks.PreToolUse.push(commitHook);
      ok("Added PreToolUse hook (capture after git commits)");
    } else {
      ok("PreToolUse commit hook already configured");
    }

    writeJson(settingsPath, settings);
    ok(`Updated ${settingsPath}`);
  }

  // 2. Git hooks
  log("Setting up git hooks...");
  const gitDir = path.join(process.cwd(), ".git");
  if (fs.existsSync(gitDir)) {
    const hooksDir = path.join(gitDir, "hooks");
    if (!fs.existsSync(hooksDir)) fs.mkdirSync(hooksDir, { recursive: true });

    // post-commit hook
    const postCommitPath = path.join(hooksDir, "post-commit");
    const postCommitContent = `#!/bin/sh
# SyncMind auto-capture: extract learnings from commits
syncmind capture --type git-hook 2>/dev/null &
`;
    // Only write if not already present
    const existing = fs.existsSync(postCommitPath) ? fs.readFileSync(postCommitPath, "utf8") : "";
    if (!existing.includes("syncmind")) {
      if (existing) {
        // Append to existing hook
        fs.appendFileSync(postCommitPath, "\n" + postCommitContent);
      } else {
        fs.writeFileSync(postCommitPath, postCommitContent);
      }
      try { fs.chmodSync(postCommitPath, "755"); } catch {}
      ok("Added post-commit git hook");
    } else {
      ok("post-commit hook already has syncmind");
    }

    // pre-push hook — capture test/lint results before pushing
    const prePushPath = path.join(hooksDir, "pre-push");
    const prePushContent = `#!/bin/sh
# SyncMind auto-capture: snapshot state before push
syncmind session end 2>/dev/null &
`;
    const existingPush = fs.existsSync(prePushPath) ? fs.readFileSync(prePushPath, "utf8") : "";
    if (!existingPush.includes("syncmind")) {
      if (existingPush) {
        fs.appendFileSync(prePushPath, "\n" + prePushContent);
      } else {
        fs.writeFileSync(prePushPath, prePushContent);
      }
      try { fs.chmodSync(prePushPath, "755"); } catch {}
      ok("Added pre-push git hook");
    } else {
      ok("pre-push hook already has syncmind");
    }
  } else {
    warn("Not a git repo — skipping git hooks");
  }

  // 3. Show manual setup for other IDEs
  console.log();
  log(`${C.bold}Manual setup for other IDEs:${C.reset}`);
  console.log();
  console.log(`  ${C.dim}Cursor — add to .cursor/rules:${C.reset}`);
  console.log(`    ${C.cyan}On session end, run: syncmind session end${C.reset}`);
  console.log();
  console.log(`  ${C.dim}VS Code — tasks.json:${C.reset}`);
  console.log(`    ${C.cyan}{ "label": "syncmind-capture", "type": "shell",${C.reset}`);
  console.log(`    ${C.cyan}  "command": "syncmind session end",${C.reset}`);
  console.log(`    ${C.cyan}  "runOptions": { "runOn": "folderClose" } }${C.reset}`);
  console.log();
  console.log(`  ${C.dim}Any terminal — add to .bashrc / .zshrc:${C.reset}`);
  console.log(`    ${C.cyan}trap 'syncmind session end 2>/dev/null' EXIT${C.reset}`);
  console.log();

  ok("Hooks setup complete");
  console.log();
}

// ── write (quick memory from CLI) ───────────────────────────────────
async function cmdWrite(args) {
  const url = detectUrl();
  const running = await checkServer(url);
  if (!running) { printServerHelp(url); process.exit(1); }

  let content = null, type = "learning", project = null, confidence = "validated", scope = "project";
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--type" || args[i] === "-t") && args[i + 1]) type = args[++i];
    else if ((args[i] === "--project" || args[i] === "-p") && args[i + 1]) project = args[++i];
    else if ((args[i] === "--confidence" || args[i] === "-c") && args[i + 1]) confidence = args[++i];
    else if ((args[i] === "--scope" || args[i] === "-s") && args[i + 1]) scope = args[++i];
    else if (!content) content = args.slice(i).join(" ");
  }

  // Auto-detect project
  if (!project) {
    try {
      const remote = execSync("git remote get-url origin 2>/dev/null", { encoding: "utf8" }).trim();
      project = remote.split("/").pop().replace(/\.git$/, "");
    } catch {
      try { project = path.basename(process.cwd()); } catch {}
    }
  }

  if (!content) {
    content = await ask(`  ${C.cyan}Memory:${C.reset} `);
    if (!content.trim()) { err("No content"); return; }
  }

  console.log();
  try {
    const res = await httpFetch(`${url}/api/memories`, {
      method: "POST",
      body: JSON.stringify({
        content,
        source: "cli",
        type,
        project: project || "",
        confidence,
        scope,
      }),
    });
    if (res.ok) {
      ok(`Saved: ${res.json.deduped ? "merged with existing" : `new memory (${res.json.id})`}`);
    } else {
      err(`Failed: ${res.json?.error || res.status}`);
    }
  } catch (e) {
    err(e.message);
  }
  console.log();
}

// ── search (quick search from CLI) ──────────────────────────────────
async function cmdSearch(args) {
  const url = detectUrl();
  const running = await checkServer(url);
  if (!running) { printServerHelp(url); process.exit(1); }

  const query = args.filter((a) => !a.startsWith("-")).join(" ");
  if (!query) { err("Usage: syncmind search <query>"); return; }

  console.log();
  try {
    const res = await httpFetch(`${url}/api/memories?search=${encodeURIComponent(query)}&limit=10&no_bump=true`);
    if (res.ok && res.json.memories?.length > 0) {
      log(`${res.json.memories.length} results for "${query}":`);
      console.log();
      for (const m of res.json.memories) {
        const freshness = Math.round((m.freshness || 0) * 100);
        const fColor = freshness > 70 ? C.green : freshness > 40 ? C.yellow : C.red;
        console.log(`  ${C.dim}${m.id.slice(0, 8)}${C.reset} ${fColor}${freshness}%${C.reset} [${C.cyan}${m.memory_type}${C.reset}] (${m.source})`);
        console.log(`    ${m.content.slice(0, 120)}${m.content.length > 120 ? "..." : ""}`);
        console.log();
      }
    } else {
      warn("No memories found");
    }
  } catch (e) {
    err(e.message);
  }
}

// ── help ─────────────────────────────────────────────────────────────
function printDone(url) {
  console.log();
  console.log(`  ${C.bold}${C.green}Done!${C.reset} SyncMind MCP is ready.\n`);
  console.log(`  ${C.dim}Add to your project's CLAUDE.md / AI instructions:${C.reset}`);
  console.log(`    ${C.cyan}"Before starting, check shared memory for patterns."`);
  console.log(`    "After finishing, save what you learned."${C.reset}`);
  console.log();
}

function printHelp() {
  console.log(`
  ${C.bold}${C.magenta}Sync${C.cyan}Mind${C.reset} ${C.dim}CLI v2.0${C.reset}

  ${C.bold}Setup & Config${C.reset}
    syncmind install              Install MCP server into your IDE (interactive)
    syncmind install --tool all   Install for all IDEs at once
    syncmind install --url URL    Use a custom SyncMind URL
    syncmind hooks                Set up auto-capture hooks (git, IDE, terminal)
    syncmind status               Check server & MCP connection status

  ${C.bold}Memory Management${C.reset}
    syncmind write <text>         Write a memory from the command line
    syncmind write -t pattern     Write with type (learning/pattern/decision/bug/context)
    syncmind write -s global      Write with scope (project/team/global)
    syncmind search <query>       Search memories from the command line

  ${C.bold}Auto-Capture${C.reset}
    syncmind capture              Auto-capture from current context (git, etc.)
    syncmind capture -t git-hook  Capture from git commits
    syncmind capture -t lint      Run linter and capture issues
    syncmind capture -t test      Run tests and capture failures
    syncmind capture -t deps      Run npm audit and capture vulnerabilities
    syncmind capture --stdin      Capture from piped input
    echo "text" | syncmind capture -t custom --stdin

  ${C.bold}Session Lifecycle${C.reset}
    syncmind session start        Show recent memories for current project
    syncmind session end          Auto-capture git activity & uncommitted work

  ${C.bold}Maintenance${C.reset}
    syncmind restart              Re-link MCP + re-register with Claude Code
    syncmind restart --dev        Also restart the Next.js dev server
    syncmind pull                 Git pull + reinstall + re-link
    syncmind pull --restart       Also restart after pull

  ${C.dim}URL auto-detected from SYNCMIND_URL env, .env.local, or .mcp.json
  Project auto-detected from git remote or directory name${C.reset}
`);
}

// ── Entry ───────────────────────────────────────────────────────────
const [cmd, ...rest] = process.argv.slice(2);

const commands = {
  install: cmdInstall, i: cmdInstall,
  status: cmdStatus, s: cmdStatus,
  restart: cmdRestart, r: cmdRestart,
  capture: cmdCapture, c: cmdCapture,
  pull: cmdPull,
  session: cmdSession,
  hooks: cmdHooks,
  write: cmdWrite, w: cmdWrite,
  search: cmdSearch, q: cmdSearch,
  help: () => printHelp(), "--help": () => printHelp(), "-h": () => printHelp(),
};

if (!cmd) { printHelp(); }
else if (commands[cmd]) {
  const fn = commands[cmd];
  const result = fn(rest);
  if (result && typeof result.catch === "function") {
    result.catch((e) => { err(e.message); process.exit(1); });
  }
}
else { err(`Unknown command: ${cmd}`); printHelp(); process.exit(1); }
