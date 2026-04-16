/**
 * Vercel Serverless Function entry point.
 *
 * Imports from ../dist/ (pre-compiled by `npm run build:api`), NOT from ../src/.
 * This is intentional: Vercel's @vercel/node runtime transpiles TypeScript files
 * individually without bundling — it does NOT resolve .js extension imports to
 * .tsx source files at runtime. Importing from dist/ ensures all files are plain
 * .js with no .tsx resolution needed.
 *
 * Build order guaranteed by Vercel:
 *   1. npm run build  →  src/ compiled to dist/ (including .tsx → .js)
 *   2. Vercel processes api/index.ts as the serverless entry
 */
import type { IncomingMessage, ServerResponse } from 'http'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — dist/ is generated at build time; not present in source tree
import { fastify } from '../dist/app.js'

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  fastify.server.emit('request', req, res)
}
