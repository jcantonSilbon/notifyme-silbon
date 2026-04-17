import { useCallback, useEffect, useState } from 'react'
import {
  AppProvider,
  Frame,
  Navigation,
  TopBar,
  Page,
  Layout,
  Card,
  Pagination,
  Banner,
  BlockStack,
  Text,
  Divider,
} from '@shopify/polaris'
import { HomeIcon, OrderIcon } from '@shopify/polaris-icons'
import enTranslations from '@shopify/polaris/locales/en.json'
import { StatsCards } from './components/StatsCards'
import { FilterBar } from './components/FilterBar'
import { SubscriptionTable } from './components/SubscriptionTable'
import { api } from './api/client'
import type { Stats, SubscriptionsResponse, SubscriptionsParams } from './api/client'

type View = 'overview' | 'subscriptions'

export default function App() {
  const [currentView, setCurrentView] = useState<View>('overview')
  const [mobileNavigationActive, setMobileNavigationActive] = useState(false)

  const [stats, setStats] = useState<Stats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  const [subscriptions, setSubscriptions] = useState<SubscriptionsResponse | null>(null)
  const [subsLoading, setSubsLoading] = useState(false)

  const [filters, setFilters] = useState<SubscriptionsParams>({ page: 1, limit: 50 })
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Load stats on mount and when returning to overview
  useEffect(() => {
    if (currentView !== 'overview') return
    setStatsLoading(true)
    api
      .getStats()
      .then(setStats)
      .catch((err: Error) => setError(err.message))
      .finally(() => setStatsLoading(false))
  }, [currentView])

  // Load subscriptions when on that view or filters change
  const loadSubscriptions = useCallback(() => {
    setSubsLoading(true)
    api
      .getSubscriptions(filters)
      .then(setSubscriptions)
      .catch((err: Error) => setError(err.message))
      .finally(() => setSubsLoading(false))
  }, [filters])

  useEffect(() => {
    if (currentView !== 'subscriptions') return
    loadSubscriptions()
  }, [currentView, loadSubscriptions])

  const handleRetry = async (id: string) => {
    try {
      await api.retrySubscription(id)
      setSuccessMessage('Suscripción marcada para reintento')
      loadSubscriptions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al reintentar')
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar esta suscripción?')) return
    try {
      await api.deleteSubscription(id)
      setSuccessMessage('Suscripción eliminada')
      setSubscriptions((current) => {
        if (!current) return current
        return {
          ...current,
          data: current.data.filter((sub) => sub.id !== id),
          total: Math.max(0, current.total - 1),
        }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar')
    }
  }

  const handleExport = () => {
    const url = api.getExportUrl(filters)
    window.open(url, '_blank')
  }

  const handleFilterChange = (newFilters: SubscriptionsParams) => {
    setFilters(newFilters)
  }

  const totalPages = subscriptions
    ? Math.ceil(subscriptions.total / (filters.limit ?? 50))
    : 1

  const navigationMarkup = (
    <Navigation location="/">
      <Navigation.Section
        items={[
          {
            label: 'Resumen',
            icon: HomeIcon,
            onClick: () => setCurrentView('overview'),
            selected: currentView === 'overview',
          },
          {
            label: 'Suscripciones',
            icon: OrderIcon,
            onClick: () => setCurrentView('subscriptions'),
            selected: currentView === 'subscriptions',
            badge: stats?.totalPending ? String(stats.totalPending) : undefined,
          },
        ]}
      />
    </Navigation>
  )

  const topBarMarkup = (
    <TopBar
      showNavigationToggle
      onNavigationToggle={() => setMobileNavigationActive((v) => !v)}
    />
  )

  return (
    <AppProvider i18n={enTranslations}>
      <Frame
        topBar={topBarMarkup}
        navigation={navigationMarkup}
        showMobileNavigation={mobileNavigationActive}
        onNavigationDismiss={() => setMobileNavigationActive(false)}
      >
        {currentView === 'overview' && (
          <Page title="Notificaciones de Restock" subtitle="Silbon — Panel de administración">
            <BlockStack gap="600">
              {error && (
                <Banner tone="critical" onDismiss={() => setError(null)}>
                  {error}
                </Banner>
              )}
              <StatsCards stats={stats} loading={statsLoading} />
            </BlockStack>
          </Page>
        )}

        {currentView === 'subscriptions' && (
          <Page
            title="Suscripciones"
            subtitle={
              subscriptions
                ? `${subscriptions.total.toLocaleString('es-ES')} suscripciones en total`
                : undefined
            }
          >
            <Layout>
              <Layout.Section>
                {error && (
                  <Banner tone="critical" onDismiss={() => setError(null)}>
                    {error}
                  </Banner>
                )}
                {successMessage && (
                  <Banner tone="success" onDismiss={() => setSuccessMessage(null)}>
                    {successMessage}
                  </Banner>
                )}

                <Card>
                  <BlockStack gap="400">
                    <FilterBar
                      filters={filters}
                      onFilterChange={handleFilterChange}
                      onExport={handleExport}
                    />

                    <Divider />

                    <SubscriptionTable
                      subscriptions={subscriptions?.data ?? []}
                      loading={subsLoading}
                      onRetry={handleRetry}
                      onDelete={handleDelete}
                    />

                    {subscriptions && subscriptions.total > (filters.limit ?? 50) && (
                      <Pagination
                        hasPrevious={(filters.page ?? 1) > 1}
                        hasNext={(filters.page ?? 1) < totalPages}
                        onPrevious={() =>
                          setFilters((f) => ({ ...f, page: Math.max(1, (f.page ?? 1) - 1) }))
                        }
                        onNext={() =>
                          setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))
                        }
                        label={`Página ${filters.page ?? 1} de ${totalPages}`}
                      />
                    )}

                    <Text variant="bodySm" as="p" tone="subdued" alignment="center">
                      Mostrando {subscriptions?.data.length ?? 0} de{' '}
                      {subscriptions?.total ?? 0} resultados
                    </Text>
                  </BlockStack>
                </Card>
              </Layout.Section>
            </Layout>
          </Page>
        )}
      </Frame>
    </AppProvider>
  )
}
