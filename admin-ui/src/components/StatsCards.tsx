import { Card, Text, InlineGrid, BlockStack, Box, Badge } from '@shopify/polaris'
import type { Stats } from '../api/client'

interface StatsCardsProps {
  stats: Stats | null
  loading: boolean
}

export function StatsCards({ stats, loading }: StatsCardsProps) {
  return (
    <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
      <Card>
        <BlockStack gap="200">
          <Text variant="bodyMd" as="p" tone="subdued">
            En espera
          </Text>
          <Text variant="heading2xl" as="p" fontWeight="bold">
            {loading ? '—' : (stats?.totalPending ?? 0).toLocaleString('es-ES')}
          </Text>
          <Badge tone="attention">PENDING</Badge>
        </BlockStack>
      </Card>

      <Card>
        <BlockStack gap="200">
          <Text variant="bodyMd" as="p" tone="subdued">
            Notificados
          </Text>
          <Text variant="heading2xl" as="p" fontWeight="bold">
            {loading ? '—' : (stats?.totalNotified ?? 0).toLocaleString('es-ES')}
          </Text>
          <Badge tone="success">NOTIFIED</Badge>
        </BlockStack>
      </Card>

      <Card>
        <BlockStack gap="200">
          <Text variant="bodyMd" as="p" tone="subdued">
            Fallidos
          </Text>
          <Text variant="heading2xl" as="p" fontWeight="bold">
            {loading ? '—' : (stats?.totalFailed ?? 0).toLocaleString('es-ES')}
          </Text>
          <Badge tone="critical">FAILED</Badge>
        </BlockStack>
      </Card>

      {stats && stats.topVariants.length > 0 && (
        <Box paddingBlockStart="400">
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h3">
                Variantes con más solicitudes pendientes
              </Text>
              {stats.topVariants.map((v) => (
                <InlineGrid key={v.variantId} columns="1fr auto" alignItems="center">
                  <BlockStack gap="050">
                    <Text variant="bodyMd" as="p" fontWeight="semibold">
                      {v.productTitle}
                    </Text>
                    <Text variant="bodySm" as="p" tone="subdued">
                      {v.variantTitle}
                    </Text>
                  </BlockStack>
                  <Badge>{String(v.count)}</Badge>
                </InlineGrid>
              ))}
            </BlockStack>
          </Card>
        </Box>
      )}
    </InlineGrid>
  )
}
