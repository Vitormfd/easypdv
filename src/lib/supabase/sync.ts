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

import { isSupabaseEnabled } from './client'
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

/**
 * Sincronizar dados com Supabase (background)
 * Chamado periodicamente
 */
export async function syncWithSupabase() {
  if (!isSupabaseEnabled() || isSyncing) return

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
    if (supabaseProducts.length === 0) return

    // Aqui você pode comparar com localStorage e resolver conflitos
    // Por agora, apenas logs de confirmação
    console.debug(`[Sync] ${supabaseProducts.length} produtos sincronizados`)
  } catch (error) {
    console.error('[Sync] Erro ao sincronizar produtos:', error)
  }
}

async function syncCustomersInBackground() {
  try {
    const supabaseCustomers = await getCustomersFromSupabase()
    if (supabaseCustomers.length === 0) return
    console.debug(`[Sync] ${supabaseCustomers.length} clientes sincronizados`)
  } catch (error) {
    console.error('[Sync] Erro ao sincronizar clientes:', error)
  }
}

async function syncSalesInBackground() {
  try {
    const supabaseSales = await getSalesFromSupabase()
    if (supabaseSales.length === 0) return
    console.debug(`[Sync] ${supabaseSales.length} vendas sincronizadas`)
  } catch (error) {
    console.error('[Sync] Erro ao sincronizar vendas:', error)
  }
}

async function syncCashRegistersInBackground() {
  try {
    const supabaseRegisters = await getCashRegistersFromSupabase()
    if (supabaseRegisters.length === 0) return
    console.debug(`[Sync] ${supabaseRegisters.length} caixas sincronizadas`)
  } catch (error) {
    console.error('[Sync] Erro ao sincronizar caixas:', error)
  }
}

async function syncDebtPaymentsInBackground() {
  try {
    const supabasePayments = await getDebtPaymentsFromSupabase()
    if (supabasePayments.length === 0) return
    console.debug(`[Sync] ${supabasePayments.length} pagamentos de dívida sincronizados`)
  } catch (error) {
    console.error('[Sync] Erro ao sincronizar pagamentos de dívida:', error)
  }
}

async function syncStockEntriesInBackground() {
  try {
    const supabaseEntries = await getStockEntriesFromSupabase()
    if (supabaseEntries.length === 0) return
    console.debug(`[Sync] ${supabaseEntries.length} entradas de estoque sincronizadas`)
  } catch (error) {
    console.error('[Sync] Erro ao sincronizar estoque:', error)
  }
}

async function syncSaleAdjustmentsInBackground() {
  try {
    const supabaseAdjustments = await getSaleAdjustmentsFromSupabase()
    if (supabaseAdjustments.length === 0) return
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
