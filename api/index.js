/**
 * Vercel Serverless Function entry point.
 *
 * @vercel/node compiles src/app.ts in-place and traces all imports. The
 * default export in src/app.ts is a valid Vercel request handler — re-export
 * it here so there is only one copy of the application in memory.
 */

export { default } from '../src/app.js'
