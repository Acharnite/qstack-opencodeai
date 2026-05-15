# qstack-opencodeai

> **⚠️ WIP — Work in progress.** This is a fork of [garrytan/gstack](https://github.com/garrytan/gstack) with experimental opencode support. Things may break. Use at your own risk.

qstack-opencodeai is a fork of [gstack](https://github.com/garrytan/gstack) that adds native support for [opencode](https://opencode.ai). It turns AI coding agents into a virtual engineering team — a CEO who rethinks the product, an eng manager who locks architecture, a designer who catches AI slop, a reviewer who finds production bugs, a QA lead who opens a real browser, and more.

**Who this is for:**
- **opencode users** — use gstack skills without running Claude Code
- **Anyone who wants structured AI workflows** — not a blank prompt, but a full engineering sprint

## Quick start

1. Install qstack (30 seconds — see below)
2. Run `/office-hours` — describe what you're building
3. Run `/plan-ceo-review` on any feature idea
4. Run `/review` on any branch with changes
5. Run `/qa` on your staging URL
6. Stop there. You'll know if this is for you.

## Install — 30 seconds

**Requirements:** [opencode](https://opencode.ai) (or [Claude Code](https://docs.anthropic.com/en/docs/claude-code)), [Git](https://git-scm.com/), [Bun](https://bun.sh/) v1.0+, [Node.js](https://nodejs.org/) (Windows only)

### OpenCode

```bash
git clone --single-branch --depth 1 https://github.com/Acharnite/qstack-opencodeai.git ~/.config/opencode/skills/gstack && cd ~/.config/opencode/skills/gstack && ./setup --host opencode
```

Copy `opencode.json.example` to `opencode.json` and adjust paths to match your environment:

```bash
cp opencode.json.example opencode.json
```

### Claude Code

```bash
git clone --single-branch --depth 1 https://github.com/Acharnite/qstack-opencodeai.git ~/.claude/skills/gstack && cd ~/.claude/skills/gstack && ./setup
```

Then add a gstack section to your project's CLAUDE.md that says to use the `/browse` skill for all web browsing and lists the available skills.

### Team mode — auto-update for shared repos (recommended)

From inside your repo:

```bash
(cd ~/.config/opencode/skills/gstack && ./setup --team --host opencode) && ~/.config/opencode/skills/gstack/bin/gstack-team-init optional && git add .claude/ CLAUDE.md && git commit -m "require gstack for AI-assisted work"
```

Swap `required` for `optional` if you'd rather nudge teammates than block them.

### Other AI Agents

qstack works on 10 AI coding agents. Target a specific agent with `./setup --host <name>`:

| Agent | Flag | Skills install to |
|-------|------|-------------------|
| OpenAI Codex CLI | `--host codex` | `~/.codex/skills/gstack-*/` |
| OpenCode | `--host opencode` | `~/.config/opencode/skills/gstack-*/` |
| Cursor | `--host cursor` | `~/.cursor/skills/gstack-*/` |
| Factory Droid | `--host factory` | `~/.factory/skills/gstack-*/` |
| Slate | `--host slate` | `~/.slate/skills/gstack-*/` |
| Kiro | `--host kiro` | `~/.kiro/skills/gstack-*/` |
| Hermes | `--host hermes` | `~/.hermes/skills/gstack-*/` |
| Claude Code | `--host claude` | `~/.claude/skills/gstack-*/` |
| GBrain (mod) | `--host gbrain` | `~/.gbrain/skills/gstack-*/` |

**Want to add support for another agent?** See [docs/ADDING_A_HOST.md](docs/ADDING_A_HOST.md).
It's one TypeScript config file, zero code changes.

## What's different from gstack

This fork adds:

- **opencode host support** — gbrain MCP detection via `opencode.json`/`opencode.jsonc` fallback chain
- **opencode session discovery** — `gstack-global-discover` now scans `~/.config/opencode/projects/`
- **opencode uninstall** — `gstack-uninstall` cleans up `~/.config/opencode/skills/` and `.opencode/skills/`
- **Vendoring detection** — preamble checks `.opencode/skills/gstack` alongside `.claude/skills/gstack`
- **All golden tests pass** — tested against opencode, codex, factory, claude, and 6 other hosts

The upstream original at `garrytan/gstack` is maintained separately. To merge upstream changes:

```bash
git fetch upstream
git merge upstream/main
# resolve conflicts in .tmpl templates, NOT generated SKILL.md
bun run gen:skill-docs
bun test
git push
```

## The sprint

qstack is a process, not a collection of tools. The skills run in the order a sprint runs:

**Think → Plan → Build → Review → Test → Ship → Reflect**

Each skill feeds into the next. `/office-hours` writes a design doc that `/plan-ceo-review` reads. `/plan-eng-review` writes a test plan that `/qa` picks up. `/review` catches bugs that `/ship` verifies are fixed.

| Skill | Your specialist | What they do |
|-------|----------------|--------------|
| `/office-hours` | **YC Office Hours** | Start here. Six forcing questions that reframe your product before you write code. |
| `/plan-ceo-review` | **CEO / Founder** | Rethink the problem. Find the 10-star product hiding inside the request. |
| `/plan-eng-review` | **Eng Manager** | Lock in architecture, data flow, diagrams, edge cases, and tests. |
| `/plan-design-review` | **Senior Designer** | Rates each design dimension 0-10, explains what a 10 looks like. |
| `/plan-devex-review` | **Developer Experience Lead** | Interactive DX review: explores developer personas, benchmarks competitors. |
| `/design-consultation` | **Design Partner** | Build a complete design system from scratch. |
| `/review` | **Staff Engineer** | Find the bugs that pass CI but blow up in production. |
| `/investigate` | **Debugger** | Systematic root-cause debugging. |
| `/design-review` | **Designer Who Codes** | Visual audit with atomic commits and before/after screenshots. |
| `/devex-review` | **DX Tester** | Live developer experience audit with real timing. |
| `/design-shotgun` | **Design Explorer** | Generate 4-6 AI mockup variants, compare, iterate. |
| `/design-html` | **Design Engineer** | Turn a mockup into production HTML. |
| `/qa` | **QA Lead** | Test your app, find bugs, fix them with atomic commits. |
| `/qa-only` | **QA Reporter** | Report-only QA. Pure bug report without code changes. |
| `/pair-agent` | **Multi-Agent Coordinator** | Share your browser with any AI agent. |
| `/cso` | **Chief Security Officer** | OWASP Top 10 + STRIDE threat model. |
| `/ship` | **Release Engineer** | Sync main, run tests, audit coverage, push, open PR. |
| `/land-and-deploy` | **Release Engineer** | Merge the PR, wait for CI and deploy, verify production health. |
| `/canary` | **SRE** | Post-deploy monitoring loop. |
| `/benchmark` | **Performance Engineer** | Baseline page load times and Core Web Vitals. |
| `/document-release` | **Technical Writer** | Update all project docs to match what you shipped. |
| `/retro` | **Eng Manager** | Team-aware weekly retro with per-person breakdowns. |
| `/browse` | **QA Engineer** | Real Chromium browser, real clicks, real screenshots. |
| `/setup-browser-cookies` | **Session Manager** | Import cookies from your real browser into headless sessions. |
| `/autoplan` | **Review Pipeline** | Runs CEO → design → eng review automatically. |
| `/setup-deploy` | **Deploy Configurator** | One-time setup for `/land-and-deploy`. |
| `/setup-gbrain` | **GBrain Onboarding** | Set up gbrain in under 5 minutes. |
| `/sync-gbrain` | **Keep Brain Current** | Re-index code into gbrain. |
| `/gstack-upgrade` | **Self-Updater** | Upgrade to the latest version. |

### Power tools

| Skill | What it does |
|-------|-------------|
| `/codex` | **Second Opinion** — independent code review from OpenAI Codex CLI. |
| `/careful` | **Safety Guardrails** — warns before destructive commands. |
| `/freeze` | **Edit Lock** — restrict file edits to one directory. |
| `/guard` | **Full Safety** — `/careful` + `/freeze` in one command. |
| `/unfreeze` | **Unlock** — remove the `/freeze` boundary. |
| `/open-gstack-browser` | **GStack Browser** — launch GStack Browser with sidebar. |
| `/learn` | **Memory** — manage what gstack learned across sessions. |

## Differences from upstream

This fork is based on gstack [v1.34.1.0](https://github.com/garrytan/gstack/releases/tag/v1.34.1.0) with the following additions:

- opencode host support in all skill preambles
- `bin/gstack-gbrain-detect` Tier 4: opencode.json/opencode.jsonc fallback
- `bin/gstack-global-discover.ts` `scanOpenCode()` function
- `bin/gstack-uninstall` opencode cleanup sections
- `bin/gstack-team-init` opencode install instructions
- `bin/gstack-extension` opencode extension path fallback
- `bin/gstack-paths` OPENCODE_PLANS_DIR support
- All golden files regenerated for all 10 hosts
- `opencode.json.example` template file

## Uninstall

### Option 1: Run the uninstall script

```bash
~/.config/opencode/skills/gstack/bin/gstack-uninstall
```

This handles skills, symlinks, global state (`~/.gstack/`), project-local state, browse daemons, and temp files. Use `--keep-state` to preserve config and analytics. Use `--force` to skip confirmation.

### Option 2: Manual removal

```bash
# Stop browse daemons
pkill -f "gstack.*browse" 2>/dev/null || true

# Remove gstack installations
rm -rf ~/.config/opencode/skills/gstack
rm -rf ~/.claude/skills/gstack
rm -rf ~/.codex/skills/gstack*
rm -rf ~/.factory/skills/gstack*
rm -rf ~/.kiro/skills/gstack*
rm -rf ~/.openclaw/skills/gstack*

# Remove global state
rm -rf ~/.gstack

# Remove temp files
rm -f /tmp/gstack-* 2>/dev/null

# Per-project cleanup (run from each project root)
rm -rf .gstack .gstack-worktrees .claude/skills/gstack .opencode/skills/gstack
rm -rf .agents/skills/gstack* .factory/skills/gstack*
```

## License

MIT. Free forever. Go build something.
