import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  getAllNotificationCopy,
  normalizeLocale,
  saveNotificationCopy,
} from '../../services/notificationCopyService.js'

const NotificationCopySchema = z.object({
  triggerButtonText: z.string().min(1).max(120),
  modalTitle: z.string().min(1).max(160),
  sizeSelectLabel: z.string().min(1).max(160),
  emailLabel: z.string().min(1).max(120),
  emailPlaceholder: z.string().min(1).max(160),
  submitButtonText: z.string().min(1).max(160),
  successMessage: z.string().min(1).max(200),
  selectVariantMessage: z.string().min(1).max(200),
  invalidEmailMessage: z.string().min(1).max(200),
  genericErrorMessage: z.string().min(1).max(200),
  connectionErrorMessage: z.string().min(1).max(200),
})

export async function adminCopyRoute(fastify: FastifyInstance) {
  fastify.get('/admin/api/copy', async (_request, reply) => {
    const locales = await getAllNotificationCopy()
    return reply.send({ locales })
  })

  fastify.put('/admin/api/copy/:locale', async (request, reply) => {
    const { locale } = request.params as { locale: string }
    const parsed = NotificationCopySchema.safeParse(request.body)

    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.issues[0]?.message ?? 'Invalid copy payload',
      })
    }

    const saved = await saveNotificationCopy(normalizeLocale(locale), parsed.data)
    return reply.send({ ok: true, locale: saved.locale })
  })
}
