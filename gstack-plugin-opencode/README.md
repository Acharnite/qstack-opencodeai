# gstack-plugin-opencode

gstack safety hooks for opencode. Provides `permission.ask`, `command.execute.before`, and `event` hooks via the [@opencode-ai/plugin](https://opencode.ai) API.

## Installation

Add to your `opencode.json`:

```json
{
  "plugin": ["./path/to/gstack-plugin-opencode"]
}
```

## Hooks

| Hook | Purpose | Equivalent Claude Code hook |
|---|---|---|
| `permission.ask` | Destructive command detection (rm -rf, DROP TABLE, git force-push, etc.) + freeze boundary check | `PreToolUse` (Bash, Edit, Write) |
| `command.execute.before` | Blocks skills if gstack is not installed | `PreToolUse` (Skill matcher) |
| `event` | Auto-update gstack on session start | `SessionStart` |

## Development

```bash
bun build src/index.ts --outdir dist --target bun
bun test src/index.test.ts
```

## License

MIT
