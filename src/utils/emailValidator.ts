import { promises as dns } from 'dns'

// RFC 5322 simplified regex — catches the vast majority of invalid emails
const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/

// Common disposable email domains to block
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'tempmail.com',
  'throwaway.email',
  'yopmail.com',
  'sharklasers.com',
  'guerrillamailblock.com',
  'grr.la',
  'guerrillamail.info',
  'trashmail.com',
  'dispostable.com',
  '10minutemail.com',
  'fakeinbox.com',
])

export function isValidEmailFormat(email: string): boolean {
  return EMAIL_REGEX.test(email)
}

export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase()
  return domain ? DISPOSABLE_DOMAINS.has(domain) : false
}

/**
 * Validates email format and checks DNS MX records exist for the domain.
 * Returns an error message string if invalid, or null if valid.
 */
export async function validateEmail(email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase()

  if (!isValidEmailFormat(normalized)) {
    return 'Formato de email inválido'
  }

  if (isDisposableEmail(normalized)) {
    return 'No se permiten emails temporales'
  }

  const domain = normalized.split('@')[1]

  try {
    const mxRecords = await dns.resolveMx(domain)
    if (!mxRecords || mxRecords.length === 0) {
      return 'El dominio del email no es válido'
    }
  } catch {
    // DNS lookup failed — could be network issue or invalid domain
    // In production, treat DNS failure as invalid to reject bots
    // In development, allow it to avoid issues with local DNS
    if (process.env.NODE_ENV === 'production') {
      return 'El dominio del email no es válido'
    }
  }

  return null
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}
