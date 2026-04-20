// src/lib/supabase/sync.ts
/**
 * SINCRONIZAÇÃO HÍBRIDA: localStorage + Supabase
 * 
 * Estratégia:
 * - Sempre escreve em localStorage (rápido, offline)
 * - Se Supabase ativado, sincroniza em background
 * - Leitura: localStorage como fonte de verdade (offline-first)
 * - Sincronização: quando online, envia dados para Supabase
 */

import { getCurrentUserId, isSupabaseEnabled } from './client'
import {
  getProductsFromSupabase,
  saveProductToSupabase,
  updateProductInSupabase,
  deleteProductFromSupabase,
} from './services/products'
import {
  getCustomersFromSupabase,
  saveCustomerToSupabase,
  updateCustomerInSupabase,
  deleteCustomerFromSupabase,
} from './services/customers'
import {
  getSalesFromSupabase,
  saveSaleToSupabase,
  getSalesByDateRangeFromSupabase,
} from './services/sales'
import {
  getCashRegistersFromSupabase,
  getOpenCashRegisterFromSupabase,
  openCashRegisterInSupabase,
  closeCashRegisterInSupabase,
} from './services/cash-register'
import {
  getDebtPaymentsFromSupabase,
  saveDebtPaymentToSupabase,
  getDebtPaymentsForCustomerFromSupabase,
} from './services/debt-payments'
import {
  getStockEntriesFromSupabase,
  saveStockEntryToSupabase,
  recordStockMovementInSupabase,
} from './services/stock'
import {
  getSaleAdjustmentsFromSupabase,
  getAdjustmentsForSaleFromSupabase,
  saveSaleAdjustmentToSupabase,
} from './services/sale-adjustments'

// Flag para controlar sincronização
let isSyncing = false
let lastSyncTime = 0
const SYNC_INTERVAL = 5000 // 5 segundos
const DATA_UPDATED_EVENT = 'pdv:data-updated'
const CASH_REOPEN_GRACE_MS = 30000

type SyncCashRegister = {
  id: string
  status?: 'open' | 'closed' | string
  openedAt?: string
  closedAt?: string
  closingAmount?: number
}

function isSyncCashRegister(value: unknown): value is SyncCashRegister {
  return !!value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string'
}

function notifyDataUpdated(key: string) {
  window.dispatchEvent(new CustomEvent(DATA_UPDATED_EVENT, { detail: { key } }))
}

function syncLocalSnapshot(key: string, data: unknown, options?: { preventShrink?: boolean }) {
  const next = JSON.stringify(data)
  const current = localStorage.getItem(key)

  if (options?.preventShrink) {
    try {
      const currentParsed = current ? JSON.parse(current) : []
      const nextParsed = Array.isArray(data) ? data : []
      if (Array.isArray(currentParsed) && currentParsed.length > nextParsed.length) {
        // Evita regressão visual quando a escrita local ainda não foi refletida no Supabase.
        return
      }
    } catch {
      // Se falhar parse, segue fluxo padrão de atualização.
    }
  }

  if (current !== next) {
    localStorage.setItem(key, next)
    notifyDataUpdated(key)
  }
}

function syncCashRegistersSnapshot(supabaseRegisters: unknown) {
  const nextRegisters = Array.isArray(supabaseRegisters)
    ? supabaseRegisters.filter(isSyncCashRegister)
    : []
  const currentRaw = localStorage.getItem('pdv_cash_registers')
  const currentRegisters: unknown = currentRaw ? JSON.parse(currentRaw) : []
  const localList = Array.isArray(currentRegisters)
    ? currentRegisters.filter(isSyncCashRegister)
    : []

  const hasLocalOpen = localList.some((r) => r.status === 'open')
  const hasSupabaseOpen = nextRegisters.some((r) => r.status === 'open')
  const justClosedAt = Number(localStorage.getItem('pdv_cash_just_closed_at') || 0)
  const inCloseGraceWindow = justClosedAt > 0 && (Date.now() - justClosedAt) < CASH_REOPEN_GRACE_MS

  // Evita "caixa fechado" falso por atraso de sincronização do registro aberto.
  if (hasLocalOpen && !hasSupabaseOpen) return
  // Evita "caixa aberto" falso logo após fechamento local.
  if (!hasLocalOpen && hasSupabaseOpen && inCloseGraceWindow) return

  const supabaseById = new Map(
    nextRegisters
      .map((r) => [r.id, r] as const)
  )

  const mergedById = new Map<string, SyncCashRegister>()

  for (const localRegister of localList) {
    if (!localRegister?.id) continue

    const remoteRegister = supabaseById.get(localRegister.id)
    if (!remoteRegister) {
      // Mantém registros locais ainda não refletidos no Supabase.
      mergedById.set(localRegister.id, localRegister)
      continue
    }

    // Se local já fechou e remoto ainda está aberto, prioriza local para não "reabrir" caixa.
    if (localRegister.status === 'closed' && remoteRegister.status === 'open') {
      mergedById.set(localRegister.id, localRegister)
      continue
    }

    // Se ambos fechados, prioriza quem tiver dados de fechamento mais completos.
    if (localRegister.status === 'closed' && remoteRegister.status === 'closed') {
      const localHasClosing = localRegister.closingAmount != null || localRegister.closedAt
      const remoteHasClosing = remoteRegister.closingAmount != null || remoteRegister.closedAt
      if (localHasClosing && !remoteHasClosing) {
        mergedById.set(localRegister.id, localRegister)
        continue
      }
    }

    mergedById.set(localRegister.id, remoteRegister)
  }

  for (const remoteRegister of nextRegisters) {
    if (!remoteRegister?.id) continue
    if (!mergedById.has(remoteRegister.id)) {
      mergedById.set(remoteRegister.id, remoteRegister)
    }
  }

  const mergedRegisters = Array.from(mergedById.values()).sort(
    (a, b) => new Date(b.openedAt || 0).getTime() - new Date(a.openedAt || 0).getTime()
  )

  syncLocalSnapshot('pdv_cash_registers', mergedRegisters)
}

/**
 * Sincronizar dados com Supabase (background)
 * Chamado periodicamente
 */
export async function syncWithSupabase() {
  if (!isSupabaseEnabled() || isSyncing) return

  // Evita sobrescrever cache local com listas vazias antes do login.
  const userId = await getCurrentUserId()
  if (!userId) return

  const now = Date.now()
  if (now - lastSyncTime < SYNC_INTERVAL) return

  isSyncing = true
  lastSyncTime = now

  try {
    // Sincronizar cada entidade em background
    syncProductsInBackground()
    syncCustomersInBackground()
    syncSalesInBackground()
    syncCashRegistersInBackground()
    syncDebtPaymentsInBackground()
    syncStockEntriesInBackground()
    syncSaleAdjustmentsInBackground()
  } catch (error) {
    console.error('Erro na sincronização com Supabase:', error)
  } finally {
    isSyncing = false
  }
}

// ============================================================================
// BACKGROUND SYNCS (não bloqueia o frontend)
// ============================================================================

async function syncProductsInBackground() {
  try {
    const supabaseProducts = await getProductsFromSupabase()
    const localProductsRaw = localStorage.getItem('pdv_products')
    const localProducts = localProductsRaw ? JSON.parse(localProductsRaw) : []
    const localActiveById = new Map(
      (Array.isArray(localProducts) ? localProducts : []).map((p: any) => [p?.id, p?.isActive])
    )

    // OPTIMIZATION: Preserve local active states and merge with Supabase data
    const mergedProducts = supabaseProducts.map((p: any) => {
      if (typeof p.isActive !== 'boolean') {
        const localIsActive = localActiveById.get(p.id)
        if (typeof localIsActive === 'boolean') {
          return { ...p, isActive: localIsActive, status: localIsActive ? 'active' : 'inactive' }
        }
      }
      return p
    })

    syncLocalSnapshot('pdv_products', mergedProducts, { preventShrink: true })
    console.debug(`[Sync] ${mergedProducts.length} produtos sincronizados`)
  } catch (error) {
    console.error('[Sync] Erro ao sincronizar produtos:', error)
  }
}

async function syncCustomersInBackground() {
  try {
    const supabaseCustomers = await getCustomersFromSupabase()
    syncLocalSnapshot('pdv_customers', supabaseCustomers, { preventShrink: true })
    console.debug(`[Sync] ${supabaseCustomers.length} clientes sincronizados`)
  } catch (error) {
    console.error('[Sync] Erro ao sincronizar clientes:', error)
  }
}

async function syncSalesInBackground() {
  try {
    // OPTIMIZATION: Only sync recent sales (last 30 days) to reduce payload
    // Local storage already has older sales
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const supabaseSales = await getSalesByDateRangeFromSupabase(thirtyDaysAgo, new Date())
    
    // Merge with existing sales to preserve local-only sales (pending sync)
    const localSalesRaw = localStorage.getItem('pdv_sales')
    const localSales = localSalesRaw ? JSON.parse(localSalesRaw) : []
    const supabaseIds = new Set((supabaseSales || []).map((s: any) => s.id))
    const localOnlySales = (localSales || []).filter((s: any) => !supabaseIds.has(s.id))
    
    const mergedSales = [...supabaseSales, ...localOnlySales]
    syncLocalSnapshot('pdv_sales', mergedSales, { preventShrink: true })
    console.debug(`[Sync] ${supabaseSales.length} vendas sincronizadas (últimos 30 dias)`)
  } catch (error) {
    console.error('[Sync] Erro ao sincronizar vendas:', error)
  }
}

async function syncCashRegistersInBackground() {
  try {
    const supabaseRegisters = await getCashRegistersFromSupabase()
    syncCashRegistersSnapshot(supabaseRegisters)
    console.debug(`[Sync] ${supabaseRegisters.length} caixas sincronizadas`)
  } catch (error) {
    console.error('[Sync] Erro ao sincronizar caixas:', error)
  }
}

async function syncDebtPaymentsInBackground() {
  try {
    const supabasePayments = await getDebtPaymentsFromSupabase()
    syncLocalSnapshot('pdv_debt_payments', supabasePayments, { preventShrink: true })
    console.debug(`[Sync] ${supabasePayments.length} pagamentos de dívida sincronizados`)
  } catch (error) {
    console.error('[Sync] Erro ao sincronizar pagamentos de dívida:', error)
  }
}

async function syncStockEntriesInBackground() {
  try {
    const supabaseEntries = await getStockEntriesFromSupabase()
    syncLocalSnapshot('pdv_stock_entries', supabaseEntries)
    console.debug(`[Sync] ${supabaseEntries.length} entradas de estoque sincronizadas`)
  } catch (error) {
    console.error('[Sync] Erro ao sincronizar estoque:', error)
  }
}

async function syncSaleAdjustmentsInBackground() {
  try {
    const supabaseAdjustments = await getSaleAdjustmentsFromSupabase()
    syncLocalSnapshot('pdv_sale_adjustments', supabaseAdjustments)
    console.debug(`[Sync] ${supabaseAdjustments.length} ajustes de venda sincronizados`)
  } catch (error) {
    console.error('[Sync] Erro ao sincronizar ajustes:', error)
  }
}

// ============================================================================
// INICIALIZAÇÃO
// ============================================================================

/**
 * Iniciar sincronização periódica com Supabase
 * Chamado uma vez ao carregar o app
 */
export function initializeSync() {
  if (!isSupabaseEnabled()) return

  // Sincronizar imediatamente
  syncWithSupabase()

  // Sincronizar periodicamente
  setInterval(() => {
    syncWithSupabase()
  }, SYNC_INTERVAL)

  // Sincronizar quando o app ficar online
  window.addEventListener('online', () => {
    console.log('Online - sincronizando com Supabase...')
    syncWithSupabase()
  })
}
