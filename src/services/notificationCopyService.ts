import { prisma } from '../db.js'

export type SupportedLocale = 'es' | 'en' | 'fr' | 'pt'

export interface NotificationCopyPayload {
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

export const DEFAULT_NOTIFICATION_COPY: Record<SupportedLocale, NotificationCopyPayload> = {
  es: {
    triggerButtonText: 'AVISAR POR EMAIL',
    modalTitle: 'Avísame cuando esté disponible',
    sizeSelectLabel: 'Selecciona tu talla',
    emailLabel: 'Correo electrónico',
    emailPlaceholder: 'tu@email.com',
    submitButtonText: 'Notificarme cuando esté disponible',
    successMessage: 'Te avisaremos cuando esté disponible.',
    selectVariantMessage: 'Selecciona una talla concreta para suscribirte.',
    invalidEmailMessage: 'Por favor, introduce un email válido.',
    genericErrorMessage: 'Ha ocurrido un error. Por favor, inténtalo de nuevo.',
    connectionErrorMessage: 'Error de conexión. Por favor, inténtalo de nuevo.',
  },
  en: {
    triggerButtonText: 'EMAIL ME',
    modalTitle: 'Notify me when it is available',
    sizeSelectLabel: 'Select your size',
    emailLabel: 'Email',
    emailPlaceholder: 'you@email.com',
    submitButtonText: 'Notify me when available',
    successMessage: 'We will let you know when it is back.',
    selectVariantMessage: 'Select a specific size before subscribing.',
    invalidEmailMessage: 'Please enter a valid email address.',
    genericErrorMessage: 'Something went wrong. Please try again.',
    connectionErrorMessage: 'Connection error. Please try again.',
  },
  fr: {
    triggerButtonText: 'M’AVERTIR PAR E-MAIL',
    modalTitle: 'Prévenez-moi quand il sera disponible',
    sizeSelectLabel: 'Sélectionnez votre taille',
    emailLabel: 'E-mail',
    emailPlaceholder: 'vous@email.com',
    submitButtonText: 'Prévenez-moi quand il sera disponible',
    successMessage: 'Nous vous préviendrons lorsqu’il sera disponible.',
    selectVariantMessage: 'Sélectionnez une taille précise avant de vous inscrire.',
    invalidEmailMessage: 'Veuillez saisir une adresse e-mail valide.',
    genericErrorMessage: 'Une erreur est survenue. Veuillez réessayer.',
    connectionErrorMessage: 'Erreur de connexion. Veuillez réessayer.',
  },
  pt: {
    triggerButtonText: 'AVISAR POR EMAIL',
    modalTitle: 'Avise-me quando estiver disponível',
    sizeSelectLabel: 'Selecione o seu tamanho',
    emailLabel: 'Email',
    emailPlaceholder: 'teu@email.com',
    submitButtonText: 'Avisar-me quando estiver disponível',
    successMessage: 'Vamos avisar-te quando estiver disponível.',
    selectVariantMessage: 'Selecione um tamanho específico antes de subscrever.',
    invalidEmailMessage: 'Por favor, introduza um email válido.',
    genericErrorMessage: 'Ocorreu um erro. Tente novamente.',
    connectionErrorMessage: 'Erro de ligação. Tente novamente.',
  },
}

export function normalizeLocale(locale?: string): SupportedLocale {
  const short = String(locale || 'es').toLowerCase().split('-')[0]
  if (short === 'en' || short === 'fr' || short === 'pt') return short
  return 'es'
}

export async function getNotificationCopy(locale?: string) {
  const normalizedLocale = normalizeLocale(locale)
  const [copy, englishCopy] = await Promise.all([
    prisma.notificationCopy.findUnique({ where: { locale: normalizedLocale } }),
    normalizedLocale === 'en'
      ? Promise.resolve(null)
      : prisma.notificationCopy.findUnique({ where: { locale: 'en' } }),
  ])

  return {
    locale: normalizedLocale,
    ...DEFAULT_NOTIFICATION_COPY[normalizedLocale],
    ...(englishCopy ?? {}),
    ...(copy ?? {}),
  }
}

export async function getAllNotificationCopy() {
  const rows = await prisma.notificationCopy.findMany()
  const byLocale = new Map(rows.map((row) => [row.locale, row]))

  return (['es', 'en', 'fr', 'pt'] as SupportedLocale[]).map((locale) => ({
    locale,
    ...DEFAULT_NOTIFICATION_COPY[locale],
    ...(byLocale.get(locale) ?? {}),
  }))
}

export async function saveNotificationCopy(locale: string, payload: NotificationCopyPayload) {
  const normalizedLocale = normalizeLocale(locale)

  return prisma.notificationCopy.upsert({
    where: { locale: normalizedLocale },
    create: {
      locale: normalizedLocale,
      ...payload,
    },
    update: payload,
  })
}
