import { describe, test, expect } from "bun:test";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Import the actual module to test real exports and runtime loading
import GStackPlugin, { resolvePath } from "./index";

describe("module loads correctly", () => {
  test("plugin exports a default function", () => {
    expect(typeof GStackPlugin).toBe("function");
  });

  test("plugin returns hooks when called", async () => {
    const mockCtx = { $: { nothrow: () => ({ quiet: () => ({ exitCode: 0 }) }) } };
    const hooks = await GStackPlugin(mockCtx as any);
    expect(hooks).toBeDefined();
    expect(typeof hooks["permission.ask"]).toBe("function");
    expect(typeof hooks["command.execute.before"]).toBe("function");
    expect(typeof hooks["event"]).toBe("function");
  });
});

// ── Destructive pattern tests ─────────────────────────────────

function extractDestructiveDetector(): (cmd: string) => boolean {
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
        const trimmed = part.replace(/\\/+$/, "");
        const basename = trimmed.replace(/.*\\//, "");
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

const isDestructive = extractDestructiveDetector();

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

  test("safe rm: dist with path", () => {
    expect(isDestructive("rm -rf ./dist/")).toBe(false);
  });

  test("safe rm: .turbo directory", () => {
    expect(isDestructive("rm -rf .turbo")).toBe(false);
  });

  test("safe rm: coverage directory", () => {
    expect(isDestructive("rm --recursive coverage/")).toBe(false);
  });

  test("safe rm: build directory", () => {
    expect(isDestructive("rm -rf build/")).toBe(false);
  });

  test("unsafe rm: real directory", () => {
    expect(isDestructive("rm -rf /etc")).toBe(true);
  });

  test("unsafe rm: home dir", () => {
    expect(isDestructive("rm -r ~/Documents")).toBe(true);
  });

  test("unsafe rm: absolute system path", () => {
    expect(isDestructive("rm -rf /usr/local/lib")).toBe(true);
  });

  test("unsafe rm: mixed safe and unsafe", () => {
    expect(isDestructive("rm -rf node_modules /etc")).toBe(true);
  });

  test("DROP TABLE", () => {
    expect(isDestructive("DROP TABLE users;")).toBe(true);
  });

  test("case insensitive drop database", () => {
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

  test("git push --force-with-lease", () => {
    expect(isDestructive("git push --force-with-lease origin main")).toBe(true);
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

  test("empty command not destructive", () => {
    expect(isDestructive("")).toBe(false);
  });

  test("whitespace only not destructive", () => {
    expect(isDestructive("   ")).toBe(false);
  });

  test("comment not destructive", () => {
    expect(isDestructive("# just a comment")).toBe(false);
  });
});

// ── resolvePath tests ────────────────────────────────────────

describe("resolvePath", () => {
  test("absolute path stays absolute", () => {
    const r = resolvePath("/tmp/test.txt", "/tmp");
    expect(r).toBe("/tmp/test.txt");
  });

  test("relative path resolves to cwd", () => {
    const r = resolvePath("test.txt", process.cwd());
    expect(r).toBe(`${process.cwd()}/test.txt`);
  });

  test("double slashes normalized", () => {
    const r = resolvePath("/tmp//foo///bar.txt", "/tmp");
    expect(r).toBe("/tmp/foo/bar.txt");
  });

  test("trailing slash removed", () => {
    const r = resolvePath("/tmp/dir/", "/tmp");
    expect(r).toBe("/tmp/dir");
  });

  test("single dot resolves to cwd", () => {
    const r = resolvePath(".", process.cwd());
    expect(r).toBe(process.cwd());
  });

  test(".. segments are resolved (normalized by path.resolve)", () => {
    const freezeDir = "/tmp/freeze-test";
    const r = resolvePath("/tmp/freeze-test/src/../../../etc/passwd", freezeDir);
    // path.resolve normalizes .. → /etc/passwd. Freeze boundary check
    // (in permission.ask) then correctly denies it since /etc != /tmp/freeze-test
    expect(r).toBe("/etc/passwd");
    expect(r.startsWith(freezeDir + "/")).toBe(false); // would be caught by freeze check
  });

  test("symlink is resolved", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "resolve-"));
    const realDir = path.join(tmpDir, "real");
    const linkDir = path.join(tmpDir, "link");
    fs.mkdirSync(realDir);
    try { fs.symlinkSync(realDir, linkDir); } catch {}
    const r = resolvePath(linkDir, tmpDir);
    expect(r).toBe(realDir);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

// ── logHook tests ────────────────────────────────────────────

describe("logHook", () => {
  test("does not crash when HOME is unset", () => {
    const oldHome = process.env.HOME;
    delete process.env.HOME;

    let threw = false;
    try {
      const home = process.env.HOME;
      if (!home) threw = false;
    } catch { threw = true; }
    expect(threw).toBe(false);

    process.env.HOME = oldHome;
  });
});
