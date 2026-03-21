"use client";

import { useState } from "react";

export function ApiDocs() {
  const [tab, setTab] = useState<"mcp" | "cli" | "api">("mcp");

  return (
    <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-xl overflow-hidden">
      {/* Tab Header */}
      <div className="flex border-b border-zinc-800/50">
        <button onClick={() => setTab("mcp")}
          className={`flex-1 px-4 py-2.5 text-xs font-medium uppercase tracking-wider transition-colors ${
            tab === "mcp" ? "text-zinc-200 bg-zinc-800/30" : "text-zinc-600 hover:text-zinc-400"
          }`}>
          MCP Setup
        </button>
        <button onClick={() => setTab("cli")}
          className={`flex-1 px-4 py-2.5 text-xs font-medium uppercase tracking-wider transition-colors ${
            tab === "cli" ? "text-zinc-200 bg-zinc-800/30" : "text-zinc-600 hover:text-zinc-400"
          }`}>
          CLI
        </button>
        <button onClick={() => setTab("api")}
          className={`flex-1 px-4 py-2.5 text-xs font-medium uppercase tracking-wider transition-colors ${
            tab === "api" ? "text-zinc-200 bg-zinc-800/30" : "text-zinc-600 hover:text-zinc-400"
          }`}>
          REST API
        </button>
      </div>

      <div className="p-4 space-y-3">
        {tab === "mcp" && (
          <>
            <div>
              <p className="text-[11px] text-zinc-300 font-medium mb-2">1. One-command install</p>
              <pre className="bg-zinc-950 rounded-lg p-2.5 text-[10px] text-zinc-400 overflow-x-auto font-mono leading-relaxed">{`cd mcp-server && npm install && npm link
syncmind install    # interactive IDE picker`}</pre>
            </div>

            <div>
              <p className="text-[11px] text-zinc-300 font-medium mb-2">2. Or install manually</p>
              <div className="space-y-1.5">
                <div className="bg-zinc-950 rounded-lg p-2">
                  <span className="text-[9px] font-mono bg-violet-500/15 text-violet-400 px-1.5 py-0.5 rounded">Claude Code</span>
                  <pre className="text-[10px] text-zinc-500 mt-1 font-mono">{`syncmind install --tool claude`}</pre>
                </div>
                <div className="bg-zinc-950 rounded-lg p-2">
                  <span className="text-[9px] font-mono bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded">Cursor / VS Code / Windsurf</span>
                  <pre className="text-[10px] text-zinc-500 mt-1 font-mono">{`syncmind install --tool all`}</pre>
                </div>
              </div>
            </div>

            <div>
              <p className="text-[11px] text-zinc-300 font-medium mb-2">3. MCP Tools</p>
              <div className="space-y-1.5">
                <div className="flex items-start gap-2 bg-zinc-950 rounded-lg p-2">
                  <span className="text-[9px] font-mono bg-violet-500/15 text-violet-400 px-1.5 py-0.5 rounded shrink-0">read_memories</span>
                  <span className="text-[10px] text-zinc-500">Search & filter by source, project, type, scope, confidence</span>
                </div>
                <div className="flex items-start gap-2 bg-zinc-950 rounded-lg p-2">
                  <span className="text-[9px] font-mono bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded shrink-0">write_memory</span>
                  <span className="text-[10px] text-zinc-500">Save with auto-dedup, confidence, scope</span>
                </div>
                <div className="flex items-start gap-2 bg-zinc-950 rounded-lg p-2">
                  <span className="text-[9px] font-mono bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded shrink-0">bump_memory</span>
                  <span className="text-[10px] text-zinc-500">Mark as used — boosts freshness</span>
                </div>
                <div className="flex items-start gap-2 bg-zinc-950 rounded-lg p-2">
                  <span className="text-[9px] font-mono bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded shrink-0">delete_memory</span>
                  <span className="text-[10px] text-zinc-500">Remove by ID</span>
                </div>
              </div>
            </div>

            <div>
              <p className="text-[11px] text-zinc-300 font-medium mb-2">4. Auto-capture hooks</p>
              <pre className="bg-zinc-950 rounded-lg p-2.5 text-[10px] text-zinc-400 overflow-x-auto font-mono leading-relaxed">{`syncmind hooks   # sets up git + IDE hooks`}</pre>
              <p className="text-[9px] text-zinc-600 mt-1">Captures on: git commit, git push, IDE session end, terminal exit</p>
            </div>
          </>
        )}

        {tab === "cli" && (
          <>
            <div>
              <p className="text-[11px] text-zinc-300 font-medium mb-2">Setup</p>
              <div className="space-y-1">
                <pre className="bg-zinc-950 rounded-lg p-2 text-[10px] text-zinc-400 font-mono">{`syncmind install              # install MCP into IDEs`}</pre>
                <pre className="bg-zinc-950 rounded-lg p-2 text-[10px] text-zinc-400 font-mono">{`syncmind hooks               # setup auto-capture hooks`}</pre>
                <pre className="bg-zinc-950 rounded-lg p-2 text-[10px] text-zinc-400 font-mono">{`syncmind status              # check server + connections`}</pre>
              </div>
            </div>

            <div>
              <p className="text-[11px] text-zinc-300 font-medium mb-2">Memory</p>
              <div className="space-y-1">
                <pre className="bg-zinc-950 rounded-lg p-2 text-[10px] text-zinc-400 font-mono">{`syncmind write "Always use ISR"  # quick write`}</pre>
                <pre className="bg-zinc-950 rounded-lg p-2 text-[10px] text-zinc-400 font-mono">{`syncmind write -t bug "X fails"  # with type`}</pre>
                <pre className="bg-zinc-950 rounded-lg p-2 text-[10px] text-zinc-400 font-mono">{`syncmind search "auth pattern"   # search`}</pre>
              </div>
            </div>

            <div>
              <p className="text-[11px] text-zinc-300 font-medium mb-2">Auto-Capture</p>
              <div className="space-y-1">
                <pre className="bg-zinc-950 rounded-lg p-2 text-[10px] text-zinc-400 font-mono">{`syncmind capture              # auto from git`}</pre>
                <pre className="bg-zinc-950 rounded-lg p-2 text-[10px] text-zinc-400 font-mono">{`syncmind capture -t test      # run tests + capture`}</pre>
                <pre className="bg-zinc-950 rounded-lg p-2 text-[10px] text-zinc-400 font-mono">{`syncmind capture -t lint      # lint + capture`}</pre>
                <pre className="bg-zinc-950 rounded-lg p-2 text-[10px] text-zinc-400 font-mono">{`syncmind capture -t deps      # npm audit + capture`}</pre>
                <pre className="bg-zinc-950 rounded-lg p-2 text-[10px] text-zinc-400 font-mono">{`npm test | syncmind capture -t test --stdin`}</pre>
              </div>
            </div>

            <div>
              <p className="text-[11px] text-zinc-300 font-medium mb-2">Session Lifecycle</p>
              <div className="space-y-1">
                <pre className="bg-zinc-950 rounded-lg p-2 text-[10px] text-zinc-400 font-mono">{`syncmind session start        # show recent memories`}</pre>
                <pre className="bg-zinc-950 rounded-lg p-2 text-[10px] text-zinc-400 font-mono">{`syncmind session end          # auto-capture + log`}</pre>
              </div>
              <p className="text-[9px] text-zinc-600 mt-1">Session end captures: git commits (last hour), diff stats, uncommitted files</p>
            </div>

            <div>
              <p className="text-[11px] text-zinc-300 font-medium mb-2">Maintenance</p>
              <div className="space-y-1">
                <pre className="bg-zinc-950 rounded-lg p-2 text-[10px] text-zinc-400 font-mono">{`syncmind restart              # re-link + re-register`}</pre>
                <pre className="bg-zinc-950 rounded-lg p-2 text-[10px] text-zinc-400 font-mono">{`syncmind pull --restart       # git pull + restart`}</pre>
              </div>
            </div>
          </>
        )}

        {tab === "api" && (
          <>
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[9px] font-mono bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded">POST</span>
                <span className="text-[11px] text-zinc-300 font-mono">/api/memories</span>
              </div>
              <pre className="bg-zinc-950 rounded-lg p-2.5 text-[10px] text-zinc-500 overflow-x-auto font-mono leading-relaxed">{`{
  "content": "Always batch DB writes",
  "source": "claude-code",
  "type": "pattern",
  "project": "my-app",
  "confidence": "validated",
  "scope": "global"
}`}</pre>
              <p className="text-[9px] text-zinc-600 mt-1">Smart dedup: {'>'}80% similar content auto-merges</p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[9px] font-mono bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded">GET</span>
                <span className="text-[11px] text-zinc-300 font-mono">/api/memories</span>
              </div>
              <pre className="bg-zinc-950 rounded-lg p-2.5 text-[10px] text-zinc-500 overflow-x-auto font-mono leading-relaxed">{`?search=hooks&project=my-app
?scope=global&confidence=validated
?no_bump=true   # don't increment used_count`}</pre>
              <p className="text-[9px] text-zinc-600 mt-1">Returns freshness score (0-1). Bumps used_count on read.</p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[9px] font-mono bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded">POST</span>
                <span className="text-[11px] text-zinc-300 font-mono">/api/memories/bump</span>
              </div>
              <pre className="bg-zinc-950 rounded-lg p-2.5 text-[10px] text-zinc-500 overflow-x-auto font-mono leading-relaxed">{`{ "id": "uuid-here" }`}</pre>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[9px] font-mono bg-cyan-500/15 text-cyan-400 px-1.5 py-0.5 rounded">POST</span>
                <span className="text-[11px] text-zinc-300 font-mono">/api/memories/auto</span>
              </div>
              <pre className="bg-zinc-950 rounded-lg p-2.5 text-[10px] text-zinc-500 overflow-x-auto font-mono leading-relaxed">{`{
  "text": "fix: batch writes",
  "source_type": "git-hook",
  "project": "my-app"
}`}</pre>
              <p className="text-[9px] text-zinc-600 mt-1">
                source_type: git-hook, git-diff, ci, pr-review, terminal, lint, test, deploy, chat, doc, browser, deps, custom
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[9px] font-mono bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded">DELETE</span>
                <span className="text-[11px] text-zinc-300 font-mono">/api/memories</span>
              </div>
              <pre className="bg-zinc-950 rounded-lg p-2.5 text-[10px] text-zinc-500 overflow-x-auto font-mono leading-relaxed">{`{ "id": "uuid-here" }`}</pre>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
