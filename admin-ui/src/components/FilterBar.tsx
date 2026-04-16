import React, { useState } from 'react'
import { InlineGrid, TextField, Select, Button, InlineStack } from '@shopify/polaris'
import type { SubscriptionsParams } from '../api/client'

interface FilterBarProps {
  filters: SubscriptionsParams
  onFilterChange: (filters: SubscriptionsParams) => void
  onExport: () => void
}

const STATUS_OPTIONS = [
  { label: 'Todos los estados', value: '' },
  { label: 'En espera (PENDING)', value: 'PENDING' },
  { label: 'Notificado (NOTIFIED)', value: 'NOTIFIED' },
  { label: 'Fallido (FAILED)', value: 'FAILED' },
]

export function FilterBar({ filters, onFilterChange, onExport }: FilterBarProps) {
  const [search, setSearch] = useState(filters.search ?? '')

  const handleSearchSubmit = () => {
    onFilterChange({ ...filters, search: search || undefined, page: 1 })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearchSubmit()
  }

  return (
    <InlineGrid columns={{ xs: 1, sm: '1fr 1fr auto auto' }} gap="300" alignItems="end">
      <TextField
        label="Buscar por email"
        value={search}
        onChange={setSearch}
        onKeyDown={handleKeyDown}
        placeholder="cliente@ejemplo.com"
        clearButton
        onClearButtonClick={() => {
          setSearch('')
          onFilterChange({ ...filters, search: undefined, page: 1 })
        }}
        autoComplete="off"
      />

      <Select
        label="Estado"
        options={STATUS_OPTIONS}
        value={filters.status ?? ''}
        onChange={(value) =>
          onFilterChange({ ...filters, status: value || undefined, page: 1 })
        }
      />

      <Button onClick={handleSearchSubmit} variant="primary">
        Buscar
      </Button>

      <Button onClick={onExport} variant="secondary">
        Exportar CSV
      </Button>
    </InlineGrid>
  )
}
