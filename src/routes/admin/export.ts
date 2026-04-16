import type { FastifyInstance } from 'fastify'
import { prisma } from '../../db.js'

function escapeCsvField(value: string | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  // Wrap in quotes if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function toCSVRow(fields: (string | null | undefined)[]): string {
  return fields.map(escapeCsvField).join(',')
}

export async function adminExportRoute(fastify: FastifyInstance) {
  fastify.get('/admin/api/export/csv', async (request, reply) => {
    const query = request.query as {
      status?: string
      productId?: string
      variantId?: string
      search?: string
    }

    const where = {
      ...(query.status ? { status: query.status as 'PENDING' | 'NOTIFIED' | 'FAILED' } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.variantId ? { variantId: query.variantId } : {}),
      ...(query.search ? { email: { contains: query.search, mode: 'insensitive' as const } } : {}),
    }

    const subscriptions = await prisma.subscription.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    const headers = toCSVRow([
      'ID',
      'Email',
      'Producto',
      'Variante',
      'Product ID',
      'Variant ID',
      'Estado',
      'Reintentos',
      'Suscrito el',
      'Notificado el',
      'Último intento',
      'Error',
    ])

    const rows = subscriptions.map((s) =>
      toCSVRow([
        s.id,
        s.email,
        s.productTitle,
        s.variantTitle,
        s.productId,
        s.variantId,
        s.status,
        String(s.retryCount),
        s.createdAt.toISOString(),
        s.notifiedAt?.toISOString() ?? '',
        s.lastAttemptAt?.toISOString() ?? '',
        s.errorMessage ?? '',
      ]),
    )

    const csv = [headers, ...rows].join('\n')
    const filename = `subscriptions-${new Date().toISOString().split('T')[0]}.csv`

    return reply
      .status(200)
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send('\uFEFF' + csv) // BOM for Excel UTF-8 compatibility
  })
}
