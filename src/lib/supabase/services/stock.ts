// src/lib/supabase/services/stock.ts
import { supabase, isSupabaseEnabled, getCurrentUserId } from '../client'
import type { StockEntry } from '@/types/pdv'

export async function getStockEntriesFromSupabase(): Promise<StockEntry[]> {
  if (!isSupabaseEnabled()) return []

  try {
    const userId = await getCurrentUserId()
    if (!userId) return []

    // OPTIMIZATION: Select only necessary fields instead of *
    const { data, error } = await supabase
      .from('stock_entries')
      .select(`
        id,
        product_id,
        quantity,
        created_at
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data || []).map(e => ({
      id: e.id,
      productId: e.product_id,
      quantity: parseFloat(e.quantity),
      createdAt: e.created_at,
    }))
  } catch (error) {
    console.error('Erro ao buscar entradas de estoque do Supabase:', error)
    return []
  }
}

export async function saveStockEntryToSupabase(se: Omit<StockEntry, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): Promise<StockEntry | null> {
  if (!isSupabaseEnabled()) return null

  try {
    const userId = await getCurrentUserId()
    if (!userId) return null

    const { data, error } = await supabase
      .from('stock_entries')
      .insert({
        ...(se.id ? { id: se.id } : {}),
        user_id: userId,
        product_id: se.productId,
        quantity: se.quantity,
        type: 'entrada',
        created_at: se.createdAt || new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      productId: data.product_id,
      quantity: parseFloat(data.quantity),
      createdAt: data.created_at,
    }
  } catch (error) {
    console.error('Erro ao salvar entrada de estoque no Supabase:', error)
    return null
  }
}

export async function recordStockMovementInSupabase(
  productId: string,
  quantity: number,
  type: 'entrada' | 'saida' | 'ajuste',
  reason?: string
): Promise<boolean> {
  if (!isSupabaseEnabled()) return false

  try {
    const userId = await getCurrentUserId()
    if (!userId) return false

    const { error } = await supabase
      .from('stock_entries')
      .insert({
        user_id: userId,
        product_id: productId,
        quantity: type === 'saida' ? -Math.abs(quantity) : Math.abs(quantity),
        type,
        reason: reason || null,
      })

    if (error) throw error
    return true
  } catch (error) {
    console.error('Erro ao registrar movimentação de estoque no Supabase:', error)
    return false
  }
}
