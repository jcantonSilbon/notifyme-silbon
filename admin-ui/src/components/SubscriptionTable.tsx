import {
  IndexTable,
  Badge,
  Text,
  Button,
  InlineStack,
  BlockStack,
  Tooltip,
  useIndexResourceState,
} from '@shopify/polaris'
import type { Subscription, SubscriptionStatus } from '../api/client'

interface SubscriptionTableProps {
  subscriptions: Subscription[]
  loading: boolean
  onRetry: (id: string) => void
  onDelete: (id: string) => void
}

const STATUS_BADGE: Record<SubscriptionStatus, { tone: 'attention' | 'success' | 'critical'; label: string }> = {
  PENDING: { tone: 'attention', label: 'En espera' },
  NOTIFIED: { tone: 'success', label: 'Notificado' },
  FAILED: { tone: 'critical', label: 'Fallido' },
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function SubscriptionTable({
  subscriptions,
  loading,
  onRetry,
  onDelete,
}: SubscriptionTableProps) {
  const resourceName = { singular: 'suscripción', plural: 'suscripciones' }

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(subscriptions as unknown as { [key: string]: unknown }[])

  const headings = [
    { title: 'Email' },
    { title: 'Producto' },
    { title: 'Variante' },
    { title: 'Estado' },
    { title: 'Reintentos' },
    { title: 'Suscrito el' },
    { title: 'Notificado el' },
  ]

  const rowMarkup = subscriptions.map((sub, index) => {
    const badge = STATUS_BADGE[sub.status]
    return (
      <IndexTable.Row
        id={sub.id}
        key={sub.id}
        selected={selectedResources.includes(sub.id)}
        position={index}
      >
        <IndexTable.Cell>
          <Text variant="bodyMd" as="span" fontWeight="semibold">
            {sub.email}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" as="span">
            {sub.productTitle}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <BlockStack gap="200">
            <Text variant="bodyMd" as="span">
              {sub.variantTitle}
            </Text>
            <InlineStack gap="200" wrap={false}>
              {(sub.status === 'FAILED' || sub.status === 'PENDING') && (
                <Button
                  size="micro"
                  onClick={() => onRetry(sub.id)}
                  accessibilityLabel={`Reintentar ${sub.email}`}
                >
                  Reintentar
                </Button>
              )}
              <Button
                size="micro"
                tone="critical"
                onClick={() => onDelete(sub.id)}
                accessibilityLabel={`Eliminar ${sub.email}`}
              >
                Eliminar
              </Button>
            </InlineStack>
          </BlockStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Tooltip content={sub.errorMessage ?? undefined} dismissOnMouseOut>
            <Badge tone={badge.tone}>{badge.label}</Badge>
          </Tooltip>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" as="span">
            {sub.retryCount}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" as="span" tone="subdued">
            {formatDate(sub.createdAt)}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" as="span" tone="subdued">
            {formatDate(sub.notifiedAt)}
          </Text>
        </IndexTable.Cell>
      </IndexTable.Row>
    )
  })

  return (
    <IndexTable
      resourceName={resourceName}
      itemCount={subscriptions.length}
      selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
      onSelectionChange={handleSelectionChange}
      headings={headings as [{ title: string }, ...{ title: string }[]]}
      loading={loading}
      emptyState={
        <Text variant="bodyMd" as="p" tone="subdued" alignment="center">
          No se encontraron suscripciones con los filtros seleccionados.
        </Text>
      }
    >
      {rowMarkup}
    </IndexTable>
  )
}
