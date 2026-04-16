import 'dotenv/config'
import { buildApp } from './app.js'
import { config } from './config.js'
import { logger } from './utils/logger.js'

const fastify = await buildApp()

try {
  const address = await fastify.listen({ port: config.PORT, host: '0.0.0.0' })
  logger.info('Server started', { address, env: config.NODE_ENV })

  if (config.RESEND_API_KEY === 're_xxxxx' || config.RESEND_API_KEY.startsWith('re_test')) {
    logger.warn(
      'RESEND_API_KEY looks like a placeholder. Verify domain at https://resend.com before going live.',
    )
  }
} catch (err) {
  logger.error('Failed to start server', { error: err })
  process.exit(1)
}
