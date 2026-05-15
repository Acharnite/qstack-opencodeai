import type { Plugin, Hooks } from "@opencode-ai/plugin";

const pluginDir = new URL("..", import.meta.url).pathname;

export const GStackOpencodePlugin: Plugin = async (ctx) => {
  const hooks: Hooks = {
    "permission.ask": async (_input, output) => {
      const freezeDir = getFreezeDir();
      if (freezeDir) {
        output.status = "deny";
        return;
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

function getFreezeDir(): string | null {
  const paths = [
    process.env.CLAUDE_PLUGIN_DATA,
    `${process.env.HOME}/.gstack`,
  ];
  for (const base of paths) {
    if (!base) continue;
    const freezeFile = `${base}/freeze-dir.txt`;
    try {
      const dir = require("fs").readFileSync(freezeFile, "utf-8").trim();
      if (dir) return dir;
    } catch {}
  }
  return null;
}

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

async function runAutoUpdate(ctx: { $: any }): Promise<void> {
  const sessionUpdate = `${pluginDir}/../bin/gstack-session-update`;
  ctx.$.nothrow()`"${sessionUpdate}"`.quiet();
}

export default GStackOpencodePlugin;
