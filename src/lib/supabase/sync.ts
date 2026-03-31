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
    syncLocalSnapshot('pdv_products', supabaseProducts, { preventShrink: true })
    console.debug(`[Sync] ${supabaseProducts.length} produtos sincronizados`)
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
    const supabaseSales = await getSalesFromSupabase()
    syncLocalSnapshot('pdv_sales', supabaseSales, { preventShrink: true })
    console.debug(`[Sync] ${supabaseSales.length} vendas sincronizadas`)
  } catch (error) {
    console.error('[Sync] Erro ao sincronizar vendas:', error)
  }
}

async function syncCashRegistersInBackground() {
  try {
    const supabaseRegisters = await getCashRegistersFromSupabase()
    syncLocalSnapshot('pdv_cash_registers', supabaseRegisters)
    console.debug(`[Sync] ${supabaseRegisters.length} caixas sincronizadas`)
  } catch (error) {
    console.error('[Sync] Erro ao sincronizar caixas:', error)
  }
}

async function syncDebtPaymentsInBackground() {
  try {
    const supabasePayments = await getDebtPaymentsFromSupabase()
    syncLocalSnapshot('pdv_debt_payments', supabasePayments)
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
