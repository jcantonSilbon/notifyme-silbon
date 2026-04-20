import { z } from 'zod'

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().min(1, 'DIRECT_URL is required'),

  // Shopify
  SHOPIFY_ACCESS_TOKEN: z.string().min(1, 'SHOPIFY_ACCESS_TOKEN is required'),
  SHOPIFY_SHOP_DOMAIN: z
    .string()
    .min(1)
    .refine((d) => d.endsWith('.myshopify.com'), {
      message: 'SHOPIFY_SHOP_DOMAIN must end with .myshopify.com',
    }),
  SHOPIFY_API_VERSION: z.string().default('2024-10'),
  SHOPIFY_WEBHOOK_SECRET: z.string().min(1, 'SHOPIFY_WEBHOOK_SECRET is required'),

  // Resend
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required'),
  EMAIL_FROM: z.string().email().default('notificaciones@silbon.com'),
  EMAIL_FROM_NAME: z.string().default('Silbon'),

  // Admin
  ADMIN_TOKEN: z.string().min(32, 'ADMIN_TOKEN must be at least 32 characters'),

  // Cron
  CRON_SECRET: z.string().min(32, 'CRON_SECRET must be at least 32 characters'),

  // Optional location filter
  NOTIFY_LOCATION_ID: z.string().optional(),

  // URLs
  APP_URL: z.string().url().default('http://localhost:3000'),
  STORE_URL: z.string().url().default('https://www.silbonshop.com'),

  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
})

function parseEnv() {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    console.error('❌ Invalid environment variables:')
    result.error.issues.forEach((issue) => {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`)
    })
    process.exit(1)
  }
  return result.data
}

export const config = parseEnv()
export type Config = typeof config
