// src/lib/supabase/services/sales.ts
import { supabase, isSupabaseEnabled, getCurrentUserId } from '../client'
import type { Sale, PaymentEntry } from '@/types/pdv'

type SaleItem = Sale['items'][number]

function mapSaleItemRow(row: {
  product_id: string
  product_name: string
  quantity: number | string
  unit_price: number | string
  subtotal: number | string
}): SaleItem {
  return {
    productId: row.product_id,
    productName: row.product_name,
    quantity: parseFloat(String(row.quantity)),
    unitPrice: parseFloat(String(row.unit_price)),
    subtotal: parseFloat(String(row.subtotal)),
  }
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

export async function getSalesFromSupabase(): Promise<Sale[]> {
  if (!isSupabaseEnabled()) return []

  try {
    const userId = await getCurrentUserId()
    if (!userId) return []

    // OPTIMIZATION: Use single query with joins instead of N+1 queries
    // Fetch sales with related items and payments in one call
    const { data: sales, error: salesError } = await supabase
      .from('sales')
      .select(`
        id,
        total,
        payment_method,
        customer_id,
        customer_name,
        created_at,
        fiado_amount,
        sale_items(product_id, product_name, quantity, unit_price, subtotal),
        sale_payments(method, amount)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (salesError) throw salesError

    return (sales || []).map((sale: any) => ({
      id: sale.id,
      items: (sale.sale_items || []).map((i: any) => mapSaleItemRow(i)),
      total: parseFloat(sale.total),
      payments: (sale.sale_payments || []).map((p: any) => ({
        method: p.method,
        amount: parseFloat(p.amount),
      })),
      paymentMethod: sale.payment_method,
      customerId: sale.customer_id,
      customerName: sale.customer_name,
      fiadoAmount: sale.fiado_amount ? parseFloat(sale.fiado_amount) : undefined,
      isDebtPayment:
        (sale.sale_items || []).length === 0 &&
        !!sale.customer_id &&
        parseFloat(sale.total) > 0 &&
        sale.payment_method !== 'fiado' &&
        !(sale.fiado_amount && parseFloat(sale.fiado_amount) > 0),
      createdAt: sale.created_at,
    }))
  } catch (error) {
    console.error('Erro ao buscar vendas do Supabase:', error)
    return []
  }
}

/** Busca itens salvos no Supabase para vendas específicas (recuperação de histórico). */
export async function getSaleItemsBySaleIdsFromSupabase(
  saleIds: string[]
): Promise<Record<string, SaleItem[]>> {
  if (!isSupabaseEnabled() || saleIds.length === 0) return {}

  try {
    const userId = await getCurrentUserId()
    if (!userId) return {}

    const result: Record<string, SaleItem[]> = {}

    for (const chunk of chunkArray(Array.from(new Set(saleIds)), 100)) {
      const { data, error } = await supabase
        .from('sale_items')
        .select('sale_id, product_id, product_name, quantity, unit_price, subtotal')
        .in('sale_id', chunk)

      if (error) throw error

      for (const row of data || []) {
        const saleId = row.sale_id as string
        if (!result[saleId]) result[saleId] = []
        result[saleId].push(mapSaleItemRow(row as any))
      }
    }

    return result
  } catch (error) {
    console.error('Erro ao buscar itens de vendas no Supabase:', error)
    return {}
  }
}

export async function fetchSaleItemsFromSupabase(saleId: string): Promise<SaleItem[]> {
  const itemsBySaleId = await getSaleItemsBySaleIdsFromSupabase([saleId])
  return itemsBySaleId[saleId] ?? []
}

export async function backfillSaleItemsToSupabase(
  saleId: string,
  items: Sale['items']
): Promise<boolean> {
  if (!isSupabaseEnabled() || items.length === 0) return false

  try {
    const userId = await getCurrentUserId()
    if (!userId) return false

    const { data: existingItems, error: checkError } = await supabase
      .from('sale_items')
      .select('id')
      .eq('sale_id', saleId)
      .limit(1)

    if (checkError) throw checkError
    if (existingItems && existingItems.length > 0) return true

    const { error: itemsError } = await supabase
      .from('sale_items')
      .insert(
        items.map(item => ({
          sale_id: saleId,
          product_id: item.productId,
          product_name: item.productName?.trim() || 'Produto',
          quantity: item.quantity,
          unit_price: item.unitPrice,
          subtotal: item.subtotal,
        }))
      )

    if (itemsError) throw itemsError
    return true
  } catch (error) {
    console.error('Erro ao preencher itens da venda no Supabase:', error)
    return false
  }
}

export async function saveSaleToSupabase(s: Omit<Sale, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): Promise<Sale | null> {
  if (!isSupabaseEnabled()) return null

  try {
    const userId = await getCurrentUserId()
    if (!userId) return null

    const salePayload = {
      ...(s.id ? { id: s.id } : {}),
      user_id: userId,
      customer_id: s.customerId || null,
      customer_name: s.customerName || null,
      total: s.total,
      fiado_amount: s.fiadoAmount || 0,
      payment_method: s.paymentMethod,
      created_at: s.createdAt || new Date().toISOString(),
    }

    // 1. Salvar venda principal (upsert para permitir retry de itens/pagamentos)
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .upsert(salePayload, { onConflict: 'id' })
      .select()
      .single()

    if (saleError) throw saleError

    // 2. Salvar items apenas se ainda não existirem
    if (s.items.length > 0) {
      await backfillSaleItemsToSupabase(sale.id, s.items)
    }

    // 3. Salvar payments apenas se ainda não existirem
    if (s.payments && s.payments.length > 0) {
      const { data: existingPayments, error: paymentsCheckError } = await supabase
        .from('sale_payments')
        .select('id')
        .eq('sale_id', sale.id)
        .limit(1)

      if (paymentsCheckError) throw paymentsCheckError

      if (!existingPayments || existingPayments.length === 0) {
        const { error: paymentsError } = await supabase
          .from('sale_payments')
          .insert(
            s.payments.map(p => ({
              sale_id: sale.id,
              method: p.method,
              amount: p.amount,
            }))
          )

        if (paymentsError) throw paymentsError
      }
    }

    return {
      id: sale.id,
      items: s.items,
      total: parseFloat(sale.total),
      payments: s.payments || [],
      paymentMethod: sale.payment_method,
      customerId: sale.customer_id,
      customerName: sale.customer_name,
      fiadoAmount: sale.fiado_amount ? parseFloat(sale.fiado_amount) : undefined,
      isDebtPayment: s.isDebtPayment,
      createdAt: sale.created_at,
    }
  } catch (error) {
    console.error('Erro ao salvar venda no Supabase:', error)
    return null
  }
}

export async function deleteSaleFromSupabase(id: string): Promise<boolean> {
  if (!isSupabaseEnabled()) return false

  try {
    const userId = await getCurrentUserId()
    if (!userId) return false

    const { data, error } = await supabase
      .from('sales')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')

    if (error) throw error
    return Array.isArray(data) && data.length > 0
  } catch (error) {
    console.error('Erro ao deletar venda do Supabase:', error)
    return false
  }
}

export async function getSalesByDateRangeFromSupabase(start: Date, end: Date): Promise<Sale[]> {
  if (!isSupabaseEnabled()) return []

  try {
    const userId = await getCurrentUserId()
    if (!userId) return []

    // OPTIMIZATION: Single query with joins instead of N+1
    const { data: sales, error: salesError } = await supabase
      .from('sales')
      .select(`
        id,
        total,
        payment_method,
        customer_id,
        customer_name,
        created_at,
        fiado_amount,
        sale_items(product_id, product_name, quantity, unit_price, subtotal),
        sale_payments(method, amount)
      `)
      .eq('user_id', userId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: false })

    if (salesError) throw salesError

    return (sales || []).map((sale: any) => ({
      id: sale.id,
      items: (sale.sale_items || []).map((i: any) => mapSaleItemRow(i)),
      total: parseFloat(sale.total),
      payments: (sale.sale_payments || []).map((p: any) => ({
        method: p.method,
        amount: parseFloat(p.amount),
      })),
      paymentMethod: sale.payment_method,
      customerId: sale.customer_id,
      customerName: sale.customer_name,
      fiadoAmount: sale.fiado_amount ? parseFloat(sale.fiado_amount) : undefined,
      isDebtPayment:
        (sale.sale_items || []).length === 0 &&
        !!sale.customer_id &&
        parseFloat(sale.total) > 0 &&
        sale.payment_method !== 'fiado' &&
        !(sale.fiado_amount && parseFloat(sale.fiado_amount) > 0),
      createdAt: sale.created_at,
    }))
  } catch (error) {
    console.error('Erro ao buscar vendas pelo período no Supabase:', error)
    return []
  }
}
