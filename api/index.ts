/**
 * Vercel Serverless Function entry point.
 *
 * Imports from src/ — NOT from dist/.
 * Vercel's @vercel/node uses esbuild to bundle this file and all its imports.
 * esbuild natively handles .ts and .tsx files (including the react-email template),
 * so the .js → .tsx extension mapping works correctly at bundle time.
 *
 * Do NOT import from dist/ here: Node.js cannot resolve .js imports to .tsx
 * source files at runtime, but esbuild can at bundle time.
 *
 * The app is initialised once per cold start and reused across warm invocations.
 */
import type { IncomingMessage, ServerResponse } from 'http'
import { buildApp } from '../src/app.js'

type FastifyInstance = Awaited<ReturnType<typeof buildApp>>

let appInstance: FastifyInstance | null = null

async function getApp(): Promise<FastifyInstance> {
  if (!appInstance) {
    appInstance = await buildApp()
  }
  return appInstance
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await getApp()
  app.server.emit('request', req, res)
}
