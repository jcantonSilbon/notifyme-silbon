import { Resend } from 'resend'
import { render } from '@react-email/render'
import * as React from 'react'
import { BackInStockEmail } from './templates/BackInStock.js'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'

const resend = new Resend(config.RESEND_API_KEY)

interface SendBackInStockEmailParams {
  to: string
  productTitle: string
  variantTitle: string
  productUrl: string
  productId: string
  variantId: string
}

/**
 * Sends a back-in-stock notification email via Resend.
 * Throws on failure — caller is responsible for retry logic.
 */
export async function sendBackInStockEmail(params: SendBackInStockEmailParams): Promise<void> {
  const { to, productTitle, variantTitle, productUrl, productId, variantId } = params

  const html = await render(
    React.createElement(BackInStockEmail, {
      productTitle,
      variantTitle,
      productUrl,
      productId,
      variantId,
    }),
  )

  const { error } = await resend.emails.send({
    from: `${config.EMAIL_FROM_NAME} <${config.EMAIL_FROM}>`,
    to,
    subject: `¡${productTitle} ya está disponible en tu talla!`,
    html,
    tags: [
      { name: 'type', value: 'back-in-stock' },
      { name: 'product_id', value: productId },
      { name: 'variant_id', value: variantId },
    ],
  })

  if (error) {
    logger.error('Resend API error', { error, to, variantId })
    throw new Error(`Resend error: ${error.message}`)
  }
}
