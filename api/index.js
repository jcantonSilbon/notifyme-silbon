/**
 * Vercel Serverless Function entry point (plain JS — avoids tsc/esbuild type conflicts).
 *
 * Loads from ../dist/ which is pre-built by `npm run build:api` (prisma generate + tsc).
 * All .tsx files are compiled to .js by tsc before this runs, so Node's ESM resolver
 * finds every import as a real .js file — no .tsx lookup needed.
 *
 * vercel.json `includeFiles: "dist/**"` ensures the built output is bundled with the function.
 */

let appPromise = null

function getApp() {
  if (!appPromise) {
    appPromise = import('../dist/app.js').then((m) => m.buildApp())
  }
  return appPromise
}

export default async function handler(req, res) {
  const app = await getApp()
  app.server.emit('request', req, res)
}
