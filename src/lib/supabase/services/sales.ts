// src/lib/supabase/services/sales.ts
import { supabase, isSupabaseEnabled, getCurrentUserId } from '../client'
import type { Sale, PaymentEntry } from '@/types/pdv'

export async function getSalesFromSupabase(): Promise<Sale[]> {
  if (!isSupabaseEnabled()) return []

  try {
    const userId = await getCurrentUserId()
    if (!userId) return []

    const { data: sales, error: salesError } = await supabase
      .from('sales')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (salesError) throw salesError

    const salesToReturn: Sale[] = []

    for (const sale of sales || []) {
      // Buscar items
      const { data: items, error: itemsError } = await supabase
        .from('sale_items')
        .select('*')
        .eq('sale_id', sale.id)

      if (itemsError) throw itemsError

      // Buscar payments
      const { data: payments, error: paymentsError } = await supabase
        .from('sale_payments')
        .select('*')
        .eq('sale_id', sale.id)

      if (paymentsError) throw paymentsError

      salesToReturn.push({
        id: sale.id,
        items: (items || []).map(i => ({
          productId: i.product_id,
          productName: i.product_name,
          quantity: parseFloat(i.quantity),
          unitPrice: parseFloat(i.unit_price),
          subtotal: parseFloat(i.subtotal),
        })),
        total: parseFloat(sale.total),
        payments: (payments || []).map(p => ({
          method: p.method,
          amount: parseFloat(p.amount),
        })),
        paymentMethod: sale.payment_method,
        customerId: sale.customer_id,
        customerName: sale.customer_name,
        fiadoAmount: sale.fiado_amount ? parseFloat(sale.fiado_amount) : undefined,
        createdAt: sale.created_at,
      })
    }

    return salesToReturn
  } catch (error) {
    console.error('Erro ao buscar vendas do Supabase:', error)
    return []
  }
}

export async function saveSaleToSupabase(s: Omit<Sale, 'id' | 'createdAt'> & { createdAt?: string }): Promise<Sale | null> {
  if (!isSupabaseEnabled()) return null

  try {
    const userId = await getCurrentUserId()
    if (!userId) return null

    // 1. Salvar venda principal
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        user_id: userId,
        customer_id: s.customerId || null,
        customer_name: s.customerName || null,
        total: s.total,
        fiado_amount: s.fiadoAmount || 0,
        payment_method: s.paymentMethod,
        created_at: s.createdAt || new Date().toISOString(),
      })
      .select()
      .single()

    if (saleError) throw saleError

    // 2. Salvar items
    if (s.items.length > 0) {
      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(
          s.items.map(item => ({
            sale_id: sale.id,
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
    if (s.payments && s.payments.length > 0) {
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

    return {
      id: sale.id,
      items: s.items,
      total: parseFloat(sale.total),
      payments: s.payments || [],
      paymentMethod: sale.payment_method,
      customerId: sale.customer_id,
      customerName: sale.customer_name,
      fiadoAmount: sale.fiado_amount ? parseFloat(sale.fiado_amount) : undefined,
      createdAt: sale.created_at,
    }
  } catch (error) {
    console.error('Erro ao salvar venda no Supabase:', error)
    return null
  }
}

export async function getSalesByDateRangeFromSupabase(start: Date, end: Date): Promise<Sale[]> {
  if (!isSupabaseEnabled()) return []

  try {
    const userId = await getCurrentUserId()
    if (!userId) return []

    const { data: sales, error: salesError } = await supabase
      .from('sales')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: false })

    if (salesError) throw salesError

    const salesToReturn: Sale[] = []

    for (const sale of sales || []) {
      const { data: items } = await supabase
        .from('sale_items')
        .select('*')
        .eq('sale_id', sale.id)

      const { data: payments } = await supabase
        .from('sale_payments')
        .select('*')
        .eq('sale_id', sale.id)

      salesToReturn.push({
        id: sale.id,
        items: (items || []).map(i => ({
          productId: i.product_id,
          productName: i.product_name,
          quantity: parseFloat(i.quantity),
          unitPrice: parseFloat(i.unit_price),
          subtotal: parseFloat(i.subtotal),
        })),
        total: parseFloat(sale.total),
        payments: (payments || []).map(p => ({
          method: p.method,
          amount: parseFloat(p.amount),
        })),
        paymentMethod: sale.payment_method,
        customerId: sale.customer_id,
        customerName: sale.customer_name,
        fiadoAmount: sale.fiado_amount ? parseFloat(sale.fiado_amount) : undefined,
        createdAt: sale.created_at,
      })
    }

    return salesToReturn
  } catch (error) {
    console.error('Erro ao buscar vendas pelo período no Supabase:', error)
    return []
  }
}
