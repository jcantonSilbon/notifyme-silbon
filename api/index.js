/**
 * Vercel Serverless Function entry point.
 *
 * Loads dist/app.bundle.js — a single ESM file produced by esbuild that inlines
 * all our source code (including BackInStock.tsx, compiled by esbuild natively).
 * npm packages are kept external (--packages=external) and loaded from node_modules/.
 *
 * Why a bundle and not tsc output:
 *   tsc compiles src/email/templates/BackInStock.tsx → dist/.../BackInStock.js but
 *   @vercel/node's file tracer resolves the import chain back to the src/ tree at
 *   runtime, where BackInStock.tsx ≠ BackInStock.js → ERR_MODULE_NOT_FOUND.
 *   esbuild inlines BackInStock at bundle time — no separate file to resolve.
 */

let appPromise = null

function getApp() {
  if (!appPromise) {
    appPromise = import('../dist/app.bundle.js').then((m) => m.buildApp())
  }
  return appPromise
}

export default async function handler(req, res) {
  const app = await getApp()
  app.server.emit('request', req, res)
}
