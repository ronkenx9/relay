/** Server env accessor that works on Vercel/Node (process.env).
 * Replaces `import { env } from "cloudflare:workers"`, which cannot resolve
 * in a standard Next.js build. All RELAY secrets stay server-side. */
export const platformEnv: Record<string, string | undefined> = { ...process.env };
