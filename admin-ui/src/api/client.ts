const ADMIN_TOKEN = import.meta.env.VITE_ADMIN_TOKEN as string

export type SubscriptionStatus = 'PENDING' | 'NOTIFIED' | 'FAILED'

export interface Subscription {
  id: string
  shop: string
  productId: string
  variantId: string
  productTitle: string
  variantTitle: string
  email: string
  status: SubscriptionStatus
  retryCount: number
  createdAt: string
  notifiedAt: string | null
  lastAttemptAt: string | null
  errorMessage: string | null
}

export interface SubscriptionsResponse {
  data: Subscription[]
  total: number
  page: number
  limit: number
}

export interface Stats {
  totalPending: number
  totalNotified: number
  totalFailed: number
  topVariants: {
    variantId: string
    variantTitle: string
    productTitle: string
    productId: string
    count: number
  }[]
}

export type SupportedLocale = 'es' | 'en' | 'fr' | 'pt'

export interface NotificationCopy {
  locale: SupportedLocale
  triggerButtonText: string
  modalTitle: string
  sizeSelectLabel: string
  emailLabel: string
  emailPlaceholder: string
  submitButtonText: string
  successMessage: string
  selectVariantMessage: string
  invalidEmailMessage: string
  genericErrorMessage: string
  connectionErrorMessage: string
}

export interface SubscriptionsParams {
  page?: number
  limit?: number
  status?: string
  productId?: string
  variantId?: string
  search?: string
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/admin/api${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${ADMIN_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (res.status === 401) {
    throw new Error('No autorizado. Verifica el token de administrador.')
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Error ${res.status}: ${text}`)
  }

  return res.json() as Promise<T>
}

export const api = {
  getSubscriptions(params: SubscriptionsParams = {}): Promise<SubscriptionsResponse> {
    const qs = new URLSearchParams()
    if (params.page) qs.set('page', String(params.page))
    if (params.limit) qs.set('limit', String(params.limit))
    if (params.status) qs.set('status', params.status)
    if (params.productId) qs.set('productId', params.productId)
    if (params.variantId) qs.set('variantId', params.variantId)
    if (params.search) qs.set('search', params.search)
    const query = qs.toString()
    return apiFetch<SubscriptionsResponse>(`/subscriptions${query ? `?${query}` : ''}`)
  },

  getStats(): Promise<Stats> {
    return apiFetch<Stats>('/stats')
  },

  getNotificationCopy(): Promise<{ locales: NotificationCopy[] }> {
    return apiFetch<{ locales: NotificationCopy[] }>('/copy')
  },

  saveNotificationCopy(locale: SupportedLocale, payload: Omit<NotificationCopy, 'locale'>): Promise<{ ok: boolean; locale: SupportedLocale }> {
    return apiFetch<{ ok: boolean; locale: SupportedLocale }>(`/copy/${locale}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  retrySubscription(id: string): Promise<{ ok: boolean }> {
    return apiFetch<{ ok: boolean }>(`/subscriptions/${id}/retry`, { method: 'POST' })
  },

  deleteSubscription(id: string): Promise<{ ok: boolean }> {
    return apiFetch<{ ok: boolean }>(`/subscriptions/${id}`, { method: 'DELETE' })
  },

  getExportUrl(params: Omit<SubscriptionsParams, 'page' | 'limit'>): string {
    const qs = new URLSearchParams()
    if (params.status) qs.set('status', params.status)
    if (params.productId) qs.set('productId', params.productId)
    if (params.variantId) qs.set('variantId', params.variantId)
    if (params.search) qs.set('search', params.search)
    const query = qs.toString()
    // Append token as query param for the CSV download (can't set headers on anchor click)
    qs.set('token', ADMIN_TOKEN)
    return `/admin/api/export/csv${query ? `?${qs.toString()}` : `?token=${ADMIN_TOKEN}`}`
  },
}
