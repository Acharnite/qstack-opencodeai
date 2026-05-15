/**
 * Auth resolution for OpenAI API access.
 *
 * Resolution order:
 * 1. OPENAI_API_KEY environment variable (highest precedence)
 * 2. ~/.gbrain/config.json → { "openai_api_key": "sk-..." } (or "api_key")
 * 3. ~/.gstack/openai.json → { "api_key": "sk-..." }
 * 4. null (caller handles guided setup or fallback)
 */

import fs from "fs";
import path from "path";

const CONFIG_PATH = path.join(process.env.HOME || "~", ".gstack", "openai.json");

export function resolveApiKey(): string | null {
  // 1. Check environment variable (highest precedence)
  if (process.env.OPENAI_API_KEY) {
    return process.env.OPENAI_API_KEY;
  }

  // 2. Check ~/.gbrain/config.json (gbrain's config stores it as openai_api_key or api_key)
  try {
    const gbrainConfigPath = path.join(process.env.HOME || "~", ".gbrain", "config.json");
    if (fs.existsSync(gbrainConfigPath)) {
      const gbrainConfig = JSON.parse(fs.readFileSync(gbrainConfigPath, "utf-8"));
      const key = gbrainConfig.openai_api_key || gbrainConfig.api_key;
      if (key && typeof key === "string") {
        return key;
      }
    }
  } catch {
    // Fall through
  }

  // 3. Check ~/.gstack/openai.json
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const content = fs.readFileSync(CONFIG_PATH, "utf-8");
      const config = JSON.parse(content);
      if (config.api_key && typeof config.api_key === "string") {
        return config.api_key;
      }
    }
  } catch {
    // Fall through
  }

  return null;
}

/**
 * Save an API key to ~/.gstack/openai.json with 0600 permissions.
 */
export function saveApiKey(key: string): void {
  const dir = path.dirname(CONFIG_PATH);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({ api_key: key }, null, 2));
  fs.chmodSync(CONFIG_PATH, 0o600);
}

/**
 * Get API key or exit with setup instructions.
 */
export function requireApiKey(): string {
  const key = resolveApiKey();
  if (!key) {
    console.error("No OpenAI API key found.");
    console.error("");
    console.error("Run: $D setup");
    console.error("  or set OPENAI_API_KEY environment variable");
    console.error("  or save to ~/.gstack/openai.json: { \"api_key\": \"sk-...\" }");
    console.error("  or add openai_api_key to ~/.gbrain/config.json");
    console.error("");
    console.error("Get a key at: https://platform.openai.com/api-keys");
    process.exit(1);
  }
  return key;
}
