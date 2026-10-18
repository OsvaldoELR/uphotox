// Worker secrets (not in wrangler.jsonc, so `wrangler types` cannot see
// them): set in the Cloudflare dashboard or with `wrangler secret put`.
interface EditorSecrets {
  EDITOR_TOKEN: string;
  GEMINI_API_KEY: string;
  OPENAI_API_KEY: string;
}

interface Env extends EditorSecrets {}
