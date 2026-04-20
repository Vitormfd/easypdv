// src/lib/supabase/services/sale-adjustments.ts
import { supabase, isSupabaseEnabled, getCurrentUserId } from '../client'
import type { SaleAdjustment, PaymentEntry } from '@/types/pdv'

export async function getSaleAdjustmentsFromSupabase(): Promise<SaleAdjustment[]> {
  if (!isSupabaseEnabled()) return []

  try {
    const userId = await getCurrentUserId()
    if (!userId) return []

    // OPTIMIZATION: Use single query with joins instead of N+1 queries
    const { data, error } = await supabase
      .from('sale_adjustments')
      .select(`
        id,
        sale_id,
        previous_total,
        new_total,
        difference,
        reason,
        created_at,
        adjustment_items(product_id, product_name, quantity, unit_price, subtotal),
        adjustment_payments(method, amount)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data || []).map((adj: any) => ({
      id: adj.id,
      saleId: adj.sale_id,
      items: (adj.adjustment_items || []).map((i: any) => ({
        productId: i.product_id,
        productName: i.product_name,
        quantity: parseFloat(i.quantity),
        unitPrice: parseFloat(i.unit_price),
        subtotal: parseFloat(i.subtotal),
      })),
      previousTotal: parseFloat(adj.previous_total),
      newTotal: parseFloat(adj.new_total),
      difference: parseFloat(adj.difference),
      payments: (adj.adjustment_payments || []).map((p: any) => ({
        method: p.method,
        amount: parseFloat(p.amount),
      })),
      reason: adj.reason,
      createdAt: adj.created_at,
    }))
  } catch (error) {
    console.error('Erro ao buscar ajustes de venda do Supabase:', error)
    return []
  }
}

export async function getAdjustmentsForSaleFromSupabase(saleId: string): Promise<SaleAdjustment[]> {
  if (!isSupabaseEnabled()) return []

  try {
    const userId = await getCurrentUserId()
    if (!userId) return []

    // OPTIMIZATION: Use single query with joins instead of N+1 queries
    const { data, error } = await supabase
      .from('sale_adjustments')
      .select(`
        id,
        sale_id,
        previous_total,
        new_total,
        difference,
        reason,
        created_at,
        adjustment_items(product_id, product_name, quantity, unit_price, subtotal),
        adjustment_payments(method, amount)
      `)
      .eq('user_id', userId)
      .eq('sale_id', saleId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data || []).map((adj: any) => ({
      id: adj.id,
      saleId: adj.sale_id,
      items: (adj.adjustment_items || []).map((i: any) => ({
        productId: i.product_id,
        productName: i.product_name,
        quantity: parseFloat(i.quantity),
        unitPrice: parseFloat(i.unit_price),
        subtotal: parseFloat(i.subtotal),
      })),
      previousTotal: parseFloat(adj.previous_total),
      newTotal: parseFloat(adj.new_total),
      difference: parseFloat(adj.difference),
      payments: (adj.adjustment_payments || []).map((p: any) => ({
        method: p.method,
        amount: parseFloat(p.amount),
      })),
      reason: adj.reason,
      createdAt: adj.created_at,
    }))
  } catch (error) {
    console.error('Erro ao buscar ajustes da venda no Supabase:', error)
    return []
  }
}

export async function saveSaleAdjustmentToSupabase(adj: Omit<SaleAdjustment, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): Promise<SaleAdjustment | null> {
  if (!isSupabaseEnabled()) return null

  try {
    const userId = await getCurrentUserId()
    if (!userId) return null

    // 1. Salvar adjustment principal
    const { data: adjustment, error: adjError } = await supabase
      .from('sale_adjustments')
      .insert({
        ...(adj.id ? { id: adj.id } : {}),
        user_id: userId,
        sale_id: adj.saleId,
        previous_total: adj.previousTotal,
        new_total: adj.newTotal,
        difference: adj.difference,
        reason: adj.reason,
        created_at: adj.createdAt || new Date().toISOString(),
      })
      .select()
      .single()

    if (adjError) throw adjError

    // 2. Salvar items
    if (adj.items.length > 0) {
      const { error: itemsError } = await supabase
        .from('adjustment_items')
        .insert(
          adj.items.map(item => ({
            adjustment_id: adjustment.id,
            product_id: item.productId,
            product_name: item.productName,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            subtotal: item.subtotal,
          }))
        )

      if (itemsError) throw itemsError
    }

    // 3. Salvar payments
    if (adj.payments && adj.payments.length > 0) {
      const { error: paymentsError } = await supabase
        .from('adjustment_payments')
        .insert(
          adj.payments.map(p => ({
            adjustment_id: adjustment.id,
            method: p.method,
            amount: p.amount,
          }))
        )

      if (paymentsError) throw paymentsError
    }

    return {
      id: adjustment.id,
      saleId: adjustment.sale_id,
      items: adj.items,
      previousTotal: parseFloat(adjustment.previous_total),
      newTotal: parseFloat(adjustment.new_total),
      difference: parseFloat(adjustment.difference),
      payments: adj.payments || [],
      reason: adjustment.reason,
      createdAt: adjustment.created_at,
    }
  } catch (error) {
    console.error('Erro ao salvar ajuste de venda no Supabase:', error)
    return null
  }
}
