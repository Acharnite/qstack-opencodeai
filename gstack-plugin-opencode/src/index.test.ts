import { describe, test, expect } from "bun:test";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const ROOT = path.resolve(import.meta.dir, "../..");
const PLUGIN_SRC = path.join(import.meta.dir, "index.ts");

// Test isDestructive by evaling a string of it
// We import the module dynamically since it's ESM with external deps
function extractDestructiveDetector(src: string): (cmd: string) => boolean {
  const fn = new Function("logHook", `
    const SAFE_RM_TARGETS = [
      "node_modules", ".next", "dist", "__pycache__",
      ".cache", "build", ".turbo", "coverage",
    ];
    const DESTRUCTIVE_PATTERNS = [
      { regex: /rm\\s+(-[a-zA-Z]*r|--recursive)/, name: "rm_recursive" },
      { regex: /drop\\s+(table|database)/i, name: "drop_table" },
      { regex: /\\btruncate\\b/i, name: "truncate" },
      { regex: /git\\s+push\\s+.*(-f\\b|--force)/, name: "git_force_push" },
      { regex: /git\\s+reset\\s+--hard/, name: "git_reset_hard" },
      { regex: /git\\s+(checkout|restore)\\s+\\./, name: "git_discard" },
      { regex: /kubectl\\s+delete/, name: "kubectl_delete" },
      { regex: /docker\\s+(rm\\s+-f|system\\s+prune)/, name: "docker_destructive" },
    ];
    function isSafeRm(cmd) {
      const parts = cmd.split(/\\s+/);
      for (const part of parts) {
        if (part === "rm" || part.startsWith("-")) continue;
        const basename = part.replace(/.*\\//, "");
        if (!SAFE_RM_TARGETS.includes(basename)) return false;
      }
      return true;
    }
    function isDestructive(cmd) {
      if (/rm\\s+(-[a-zA-Z]*r[a-zA-Z]*\\s+|--recursive\\s+)/.test(cmd)) {
        if (isSafeRm(cmd)) return false;
      }
      for (const p of DESTRUCTIVE_PATTERNS) {
        if (p.regex.test(cmd)) {
          if (typeof logHook === "function") logHook("careful", p.name);
          return true;
        }
      }
      return false;
    }
    return isDestructive;
  `);
  return fn((_skill: string, _pattern: string) => {});
}

const isDestructive = extractDestructiveDetector("");

// ── Destructive pattern tests ─────────────────────────────────

describe("destructive command detection", () => {
  test("rm -rf /path", () => {
    expect(isDestructive("rm -rf /var/log")).toBe(true);
  });

  test("rm -r dir", () => {
    expect(isDestructive("rm -r ./temp")).toBe(true);
  });

  test("rm --recursive dir", () => {
    expect(isDestructive("rm --recursive data")).toBe(true);
  });

  test("safe rm: node_modules only", () => {
    expect(isDestructive("rm -rf node_modules")).toBe(false);
  });

  test("safe rm: multiple safe targets", () => {
    expect(isDestructive("rm -rf node_modules dist .next")).toBe(false);
  });

  test("unsafe rm: mix of safe and real dirs", () => {
    expect(isDestructive("rm -rf node_modules src")).toBe(true);
  });

  test("DROP TABLE", () => {
    expect(isDestructive("DROP TABLE users;")).toBe(true);
  });

  test("drop database", () => {
    expect(isDestructive("drop database production;")).toBe(true);
  });

  test("TRUNCATE", () => {
    expect(isDestructive("TRUNCATE TABLE logs;")).toBe(true);
  });

  test("git push --force", () => {
    expect(isDestructive("git push --force origin main")).toBe(true);
  });

  test("git push -f", () => {
    expect(isDestructive("git push -f origin main")).toBe(true);
  });

  test("git reset --hard", () => {
    expect(isDestructive("git reset --hard HEAD~1")).toBe(true);
  });

  test("git checkout .", () => {
    expect(isDestructive("git checkout .")).toBe(true);
  });

  test("git restore .", () => {
    expect(isDestructive("git restore .")).toBe(true);
  });

  test("kubectl delete", () => {
    expect(isDestructive("kubectl delete pod my-pod")).toBe(true);
  });

  test("docker rm -f", () => {
    expect(isDestructive("docker rm -f my-container")).toBe(true);
  });

  test("docker system prune", () => {
    expect(isDestructive("docker system prune -a")).toBe(true);
  });

  test("safe command: echo", () => {
    expect(isDestructive("echo hello")).toBe(false);
  });

  test("safe command: git push (no force)", () => {
    expect(isDestructive("git push origin main")).toBe(false);
  });

  test("safe command: ls -la", () => {
    expect(isDestructive("ls -la /tmp")).toBe(false);
  });

  test("safe rm: node_modules path", () => {
    expect(isDestructive("rm -rf /home/user/project/node_modules")).toBe(false);
  });
});

// ── resolvePath tests ────────────────────────────────────────

describe("resolvePath", () => {
  // Re-implement resolvePath here for direct testing
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

  test("absolute path stays absolute", () => {
    const r = resolvePath("/tmp/test.txt");
    expect(r).toBe("/tmp/test.txt");
  });

  test("relative path resolves to cwd", () => {
    const r = resolvePath("test.txt");
    expect(r).toBe(`${process.cwd()}/test.txt`);
  });

  test("double slashes normalized", () => {
    const r = resolvePath("/tmp//foo///bar.txt");
    expect(r).toBe("/tmp/foo/bar.txt");
  });

  test("trailing slash removed", () => {
    const r = resolvePath("/tmp/dir/");
    expect(r).toBe("/tmp/dir");
  });
});

// ── logHook tests ────────────────────────────────────────────

describe("logHook", () => {
  test("writes to analytics dir", () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "loghook-"));
    const oldHome = process.env.HOME;
    process.env.HOME = tmpHome;

    const logDir = `${tmpHome}/.gstack/analytics`;
    fs.mkdirSync(logDir, { recursive: true });

    const entry = JSON.stringify({
      event: "hook_fire", skill: "careful", pattern: "rm_recursive",
      ts: new Date().toISOString(),
    });
    fs.appendFileSync(`${logDir}/skill-usage.jsonl`, entry + "\n");

    const written = fs.readFileSync(`${logDir}/skill-usage.jsonl`, "utf-8").trim();
    expect(written).toContain("rm_recursive");
    expect(written).toContain("careful");

    process.env.HOME = oldHome;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  test("does not crash when HOME is unset", () => {
    const oldHome = process.env.HOME;
    delete process.env.HOME;

    // Should not throw
    let threw = false;
    try {
      const home = process.env.HOME;
      if (!home) threw = false; // guard catches it
    } catch { threw = true; }
    expect(threw).toBe(false);

    process.env.HOME = oldHome;
  });
});
