/**
 * Vercel Serverless Function entry point.
 *
 * Imports from ../dist/ — NOT ../src/.
 *
 * Why: @vercel/node transpiles each .ts file individually without bundling.
 * At runtime Node's ESM loader resolves imports literally — it cannot find
 * BackInStock.js when only BackInStock.tsx exists in src/.
 *
 * The build step (prisma generate && tsc) compiles all src/**\/*.tsx to
 * dist/**\/*.js before Vercel processes this file.  Every import inside
 * dist/ resolves to a real .js file — no .tsx lookup needed.
 */
import type { IncomingMessage, ServerResponse } from 'http'

// Lazy singleton — initialised once on cold start, reused on warm invocations.
// Using a promise avoids repeated buildApp() calls during concurrent cold starts.
let appPromise: Promise<{ server: { emit: (event: string, ...args: unknown[]) => void } }> | null =
  null

function getApp() {
  if (!appPromise) {
    // Dynamic import keeps this out of esbuild's static analysis so it is NOT
    // followed and bundled — Node loads dist/app.js from disk at runtime.
    appPromise = import('../dist/app.js').then((m: { buildApp: () => Promise<unknown> }) =>
      m.buildApp(),
    ) as typeof appPromise
  }
  return appPromise!
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await getApp()
  app.server.emit('request', req, res)
}
