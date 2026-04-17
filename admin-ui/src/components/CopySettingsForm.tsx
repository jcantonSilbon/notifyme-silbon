import { useEffect, useState } from 'react'
import {
  BlockStack,
  Button,
  Card,
  InlineGrid,
  Select,
  Text,
  TextField,
} from '@shopify/polaris'
import type { NotificationCopy, SupportedLocale } from '../api/client'

interface CopySettingsFormProps {
  locales: NotificationCopy[]
  loading: boolean
  saving: boolean
  onSave: (locale: SupportedLocale, payload: Omit<NotificationCopy, 'locale'>) => Promise<void>
}

const LOCALE_OPTIONS = [
  { label: 'Español', value: 'es' },
  { label: 'English', value: 'en' },
  { label: 'Français', value: 'fr' },
  { label: 'Português', value: 'pt' },
]

const FIELD_LABELS: Array<{ key: keyof Omit<NotificationCopy, 'locale'>; label: string; multiline?: number }> = [
  { key: 'triggerButtonText', label: 'Texto del botón exterior' },
  { key: 'modalTitle', label: 'Título del pop-up' },
  { key: 'sizeSelectLabel', label: 'Texto del selector de talla' },
  { key: 'emailLabel', label: 'Label del email' },
  { key: 'emailPlaceholder', label: 'Placeholder del email' },
  { key: 'submitButtonText', label: 'Texto del botón del pop-up' },
  { key: 'successMessage', label: 'Mensaje de éxito', multiline: 2 },
  { key: 'selectVariantMessage', label: 'Mensaje si falta talla', multiline: 2 },
  { key: 'invalidEmailMessage', label: 'Mensaje de email inválido', multiline: 2 },
  { key: 'genericErrorMessage', label: 'Mensaje de error genérico', multiline: 2 },
  { key: 'connectionErrorMessage', label: 'Mensaje de error de conexión', multiline: 2 },
]

export function CopySettingsForm({
  locales,
  loading,
  saving,
  onSave,
}: CopySettingsFormProps) {
  const [selectedLocale, setSelectedLocale] = useState<SupportedLocale>('es')
  const [draft, setDraft] = useState<Omit<NotificationCopy, 'locale'> | null>(null)

  const activeLocale = locales.find((locale) => locale.locale === selectedLocale) ?? null

  useEffect(() => {
    if (!activeLocale) return
    const { locale: _locale, ...rest } = activeLocale
    setDraft(rest)
  }, [activeLocale])

  if (loading || !draft) {
    return (
      <Card>
        <Text as="p" variant="bodyMd" tone="subdued">
          Cargando ajustes de copy...
        </Text>
      </Card>
    )
  }

  return (
    <Card>
      <BlockStack gap="500">
        <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
          <Select
            label="Idioma"
            options={LOCALE_OPTIONS}
            value={selectedLocale}
            onChange={(value) => setSelectedLocale(value as SupportedLocale)}
          />
          <Text as="p" variant="bodyMd" tone="subdued">
            Edita aquí los textos del botón y del pop-up para cada idioma del storefront.
          </Text>
        </InlineGrid>

        <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
          {FIELD_LABELS.map((field) => (
            <TextField
              key={field.key}
              label={field.label}
              value={draft[field.key]}
              onChange={(value) =>
                setDraft((current) => (current ? { ...current, [field.key]: value } : current))
              }
              autoComplete="off"
              multiline={field.multiline}
            />
          ))}
        </InlineGrid>

        <Button
          variant="primary"
          onClick={() => onSave(selectedLocale, draft)}
          loading={saving}
        >
          Guardar textos
        </Button>
      </BlockStack>
    </Card>
  )
}
