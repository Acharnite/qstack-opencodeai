import type { Plugin, Hooks } from "@opencode-ai/plugin";
import * as fs from "fs";

const pluginDir = new URL("..", import.meta.url).pathname;

interface PermissionInput {
  tool?: string;
  command?: string;
  filePath?: string;
  pattern?: string;
  [key: string]: unknown;
}

export const GStackOpencodePlugin: Plugin = async (ctx) => {
  const hooks: Hooks = {
    "permission.ask": async (input: unknown, output) => {
      const pi = input as PermissionInput;

      // --- Freeze boundary check ---
      const freezeDir = getFreezeDir();
      if (freezeDir && pi.filePath) {
        const resolved = resolvePath(pi.filePath);
        if (!resolved.startsWith(freezeDir + "/") && resolved !== freezeDir) {
          logHook("freeze", "boundary_deny");
          output.status = "deny";
          return;
        }
      }

      // --- Careful: destructive command detection (Bash only) ---
      if (pi.tool === "bash" || pi.command) {
        const cmd = pi.command || "";
        if (isDestructive(cmd)) {
          output.status = "ask";
          return;
        }
      }

      output.status = "ask";
    },

    "command.execute.before": async (_input, output) => {
      const gstackInstalled = await checkGstackInstalled(ctx);
      if (!gstackInstalled) {
        output.parts = [{
          type: "text" as const,
          text: "BLOCKED: gstack is not installed globally. Install it first.",
        }];
      }
    },

    event: async (_input) => {
      await runAutoUpdate(ctx);
    },
  };

  return hooks;
};

// ── Freeze boundary ───────────────────────────────────────────

function getFreezeDir(): string | null {
  const paths = [
    process.env.CLAUDE_PLUGIN_DATA,
    `${process.env.HOME}/.gstack`,
    `${process.env.HOME}/.local/state/opencode`,
  ];
  for (const base of paths) {
    if (!base) continue;
    const freezeFile = `${base}/freeze-dir.txt`;
    try {
      const dir = fs.readFileSync(freezeFile, "utf-8").trim();
      if (dir) return dir;
    } catch {}
  }
  return null;
}

function resolvePath(filePath: string): string {
  let resolved = filePath;
  if (!resolved.startsWith("/")) {
    resolved = `${process.cwd()}/${resolved}`;
  }
  resolved = resolved.replace(/\/+/g, "/").replace(/\/$/, "");
  try {
    resolved = fs.realpathSync(resolved);
  } catch {}
  return resolved;
}

// ── Careful: destructive command detection ────────────────────

const DESTRUCTIVE_PATTERNS: { regex: RegExp; name: string; msg: string }[] = [
  { regex: /rm\s+(-[a-zA-Z]*r|--recursive)/, name: "rm_recursive", msg: "Recursive delete (rm -r). This permanently removes files." },
  { regex: /drop\s+(table|database)/i, name: "drop_table", msg: "SQL DROP detected. Permanently deletes database objects." },
  { regex: /\btruncate\b/i, name: "truncate", msg: "SQL TRUNCATE detected. Deletes all rows from a table." },
  { regex: /git\s+push\s+.*(-f\b|--force)/, name: "git_force_push", msg: "Force-push rewrites remote history. Others may lose work." },
  { regex: /git\s+reset\s+--hard/, name: "git_reset_hard", msg: "git reset --hard discards all uncommitted changes." },
  { regex: /git\s+(checkout|restore)\s+\./, name: "git_discard", msg: "Discards all uncommitted changes in working tree." },
  { regex: /kubectl\s+delete/, name: "kubectl_delete", msg: "kubectl delete removes Kubernetes resources." },
  { regex: /docker\s+(rm\s+-f|system\s+prune)/, name: "docker_destructive", msg: "Docker force-remove or prune. Destructive." },
];

function isDestructive(cmd: string): boolean {
  // Check safe rm exceptions first
  if (/rm\s+(-[a-zA-Z]*r[a-zA-Z]*\s+|--recursive\s+)/.test(cmd)) {
    if (isSafeRm(cmd)) return false;
  }

  for (const p of DESTRUCTIVE_PATTERNS) {
    if (p.regex.test(cmd)) {
      logHook("careful", p.name);
      return true;
    }
  }
  return false;
}

const SAFE_RM_TARGETS = [
  "node_modules", ".next", "dist", "__pycache__",
  ".cache", "build", ".turbo", "coverage",
];

function isSafeRm(cmd: string): boolean {
  const parts = cmd.split(/\s+/);
  for (const part of parts) {
    if (part === "rm" || part.startsWith("-")) continue;
    const basename = part.replace(/.*\//, "");
    if (!SAFE_RM_TARGETS.includes(basename)) return false;
  }
  return true;
}

// ── Team enforcement ──────────────────────────────────────────

async function checkGstackInstalled(ctx: { $: any }): Promise<boolean> {
  const paths = [
    `${process.env.HOME}/.claude/skills/gstack/bin`,
    `${process.env.HOME}/.config/opencode/skills/gstack/bin`,
  ];
  for (const p of paths) {
    const result = await ctx.$.nothrow()`test -d "${p}"`.quiet();
    if (result.exitCode === 0) return true;
  }
  return false;
}

// ── Auto-update ───────────────────────────────────────────────

async function runAutoUpdate(ctx: { $: any }): Promise<void> {
  // Resolve gstack bin dir: if installed beside gstack, use sibling path;
  // otherwise try common install locations.
  const gstackBins = [
    `${pluginDir}/../bin/gstack-session-update`,
    `${process.env.HOME}/.config/opencode/skills/gstack/bin/gstack-session-update`,
    `${process.env.HOME}/.claude/skills/gstack/bin/gstack-session-update`,
  ];
  for (const p of gstackBins) {
    const result = await ctx.$.nothrow()`test -f "${p}"`.quiet();
    if (result.exitCode === 0) {
      ctx.$.nothrow()`"${p}"`.quiet();
      return;
    }
  }
}

// ── Logging ───────────────────────────────────────────────────

function logHook(skill: string, pattern: string): void {
  try {
    const home = process.env.HOME;
    if (!home) return;
    const logDir = `${home}/.gstack/analytics`;
    fs.mkdirSync(logDir, { recursive: true });
    const entry = JSON.stringify({
      event: "hook_fire", skill, pattern,
      ts: new Date().toISOString(),
    });
    fs.appendFileSync(`${logDir}/skill-usage.jsonl`, entry + "\n");
  } catch {}
}

export default GStackOpencodePlugin;
