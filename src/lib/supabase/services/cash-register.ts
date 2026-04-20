// src/lib/supabase/services/cash-register.ts
import { supabase, isSupabaseEnabled, getCurrentUserId } from '../client'
import type { CashRegister } from '@/types/pdv'

export async function getCashRegistersFromSupabase(): Promise<CashRegister[]> {
  if (!isSupabaseEnabled()) return []

  try {
    const userId = await getCurrentUserId()
    if (!userId) return []

    // OPTIMIZATION: Select only necessary fields instead of *
    const { data, error } = await supabase
      .from('cash_registers')
      .select(`
        id,
        opened_at,
        closed_at,
        opening_amount,
        closing_amount,
        expected_amount,
        difference,
        total_sales,
        total_dinheiro,
        total_pix,
        total_cartao,
        total_fiado,
        sales_count,
        status
      `)
      .eq('user_id', userId)
      .order('opened_at', { ascending: false })

    if (error) throw error

    return (data || []).map(r => ({
      id: r.id,
      openedAt: r.opened_at,
      closedAt: r.closed_at,
      openingAmount: parseFloat(r.opening_amount),
      closingAmount: r.closing_amount != null ? parseFloat(r.closing_amount) : undefined,
      expectedAmount: r.expected_amount != null ? parseFloat(r.expected_amount) : undefined,
      difference: r.difference != null ? parseFloat(r.difference) : undefined,
      totalSales: parseFloat(r.total_sales),
      totalDinheiro: parseFloat(r.total_dinheiro),
      totalPix: parseFloat(r.total_pix),
      totalCartao: parseFloat(r.total_cartao),
      totalFiado: parseFloat(r.total_fiado),
      salesCount: r.sales_count,
      status: r.status,
    }))
  } catch (error) {
    console.error('Erro ao buscar caixas do Supabase:', error)
    return []
  }
}

export async function getOpenCashRegisterFromSupabase(): Promise<CashRegister | null> {
  if (!isSupabaseEnabled()) return null

  try {
    const userId = await getCurrentUserId()
    if (!userId) return null

    // OPTIMIZATION: Select only necessary fields instead of *
    const { data, error } = await supabase
      .from('cash_registers')
      .select(`
        id,
        opened_at,
        closed_at,
        opening_amount,
        closing_amount,
        expected_amount,
        difference,
        total_sales,
        total_dinheiro,
        total_pix,
        total_cartao,
        total_fiado,
        sales_count,
        status
      `)
      .eq('user_id', userId)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows found

    if (!data) return null

    return {
      id: data.id,
      openedAt: data.opened_at,
      closedAt: data.closed_at,
      openingAmount: parseFloat(data.opening_amount),
      closingAmount: data.closing_amount != null ? parseFloat(data.closing_amount) : undefined,
      expectedAmount: data.expected_amount != null ? parseFloat(data.expected_amount) : undefined,
      difference: data.difference != null ? parseFloat(data.difference) : undefined,
      totalSales: parseFloat(data.total_sales),
      totalDinheiro: parseFloat(data.total_dinheiro),
      totalPix: parseFloat(data.total_pix),
      totalCartao: parseFloat(data.total_cartao),
      totalFiado: parseFloat(data.total_fiado),
      salesCount: data.sales_count,
      status: data.status,
    }
  } catch (error) {
    console.error('Erro ao buscar caixa aberto do Supabase:', error)
    return null
  }
}

export async function openCashRegisterInSupabase(openingAmount: number, localId?: string): Promise<CashRegister | null> {
  if (!isSupabaseEnabled()) return null

  try {
    const userId = await getCurrentUserId()
    if (!userId) return null

    // Verificar se já existe um caixa aberto
    const existing = await getOpenCashRegisterFromSupabase()
    if (existing) throw new Error('Já existe um caixa aberto')

    const { data, error } = await supabase
      .from('cash_registers')
      .insert({
        ...(localId ? { id: localId } : {}),
        user_id: userId,
        opening_amount: openingAmount,
        total_sales: 0,
        total_dinheiro: 0,
        total_pix: 0,
        total_cartao: 0,
        total_fiado: 0,
        sales_count: 0,
        status: 'open',
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      openedAt: data.opened_at,
      closedAt: data.closed_at,
      openingAmount: parseFloat(data.opening_amount),
      closingAmount: data.closing_amount != null ? parseFloat(data.closing_amount) : undefined,
      expectedAmount: data.expected_amount != null ? parseFloat(data.expected_amount) : undefined,
      difference: data.difference != null ? parseFloat(data.difference) : undefined,
      totalSales: parseFloat(data.total_sales),
      totalDinheiro: parseFloat(data.total_dinheiro),
      totalPix: parseFloat(data.total_pix),
      totalCartao: parseFloat(data.total_cartao),
      totalFiado: parseFloat(data.total_fiado),
      salesCount: data.sales_count,
      status: data.status,
    }
  } catch (error) {
    console.error('Erro ao abrir caixa no Supabase:', error)
    return null
  }
}

export async function closeCashRegisterInSupabase(closingAmount: number): Promise<CashRegister | null> {
  if (!isSupabaseEnabled()) return null

  try {
    const userId = await getCurrentUserId()
    if (!userId) return null

    const register = await getOpenCashRegisterFromSupabase()
    if (!register) throw new Error('Nenhum caixa aberto')

    // OPTIMIZATION: Fetch all sales with related items and payments in single query
    // This eliminates the N+1 problem where we'd fetch items/payments for each sale
    const { data: sales, error: salesError } = await supabase
      .from('sales')
      .select(`
        id,
        total,
        customer_id,
        payment_method,
        created_at,
        sale_items(id),
        sale_payments(method, amount)
      `)
      .eq('user_id', userId)
      .gte('created_at', new Date(register.openedAt).toISOString())

    if (salesError) throw salesError

    // Calculate totals by payment method
    let totalDinheiro = 0, totalPix = 0, totalCartao = 0, totalFiado = 0
    let totalSales = 0
    let salesCount = 0

    for (const sale of sales || []) {
      const isDebtPayment = (sale.sale_items || []).length === 0 && !!sale.customer_id && parseFloat(sale.total) > 0

      if (!isDebtPayment) {
        totalSales += parseFloat(sale.total)
        salesCount += 1
      }

      // Prefer sale_payments table if available, fallback to legacy payment_method
      if (sale.sale_payments && sale.sale_payments.length > 0) {
        sale.sale_payments.forEach((p: any) => {
          const amount = parseFloat(p.amount)
          if (p.method === 'dinheiro') totalDinheiro += amount
          else if (p.method === 'pix') totalPix += amount
          else if (p.method === 'cartao_credito' || p.method === 'cartao_debito') totalCartao += amount
          else if (p.method === 'fiado') totalFiado += amount
        })
      } else {
        // Fallback for legacy sales without sale_payments records
        const amount = parseFloat(sale.total)
        if (sale.payment_method === 'dinheiro') totalDinheiro += amount
        else if (sale.payment_method === 'pix') totalPix += amount
        else if (sale.payment_method === 'cartao_credito' || sale.payment_method === 'cartao_debito') totalCartao += amount
        else if (sale.payment_method === 'fiado') totalFiado += amount
      }
    }

    const expectedAmount = +(register.openingAmount + totalDinheiro).toFixed(2)
    const difference = +(closingAmount - expectedAmount).toFixed(2)

    const { data, error } = await supabase
      .from('cash_registers')
      .update({
        closed_at: new Date().toISOString(),
        closing_amount: closingAmount,
        expected_amount: expectedAmount,
        difference,
        total_sales: totalSales,
        total_dinheiro: totalDinheiro,
        total_pix: totalPix,
        total_cartao: totalCartao,
        total_fiado: totalFiado,
        sales_count: salesCount,
        status: 'closed',
      })
      .eq('id', register.id)
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      openedAt: data.opened_at,
      closedAt: data.closed_at,
      openingAmount: parseFloat(data.opening_amount),
      closingAmount: data.closing_amount != null ? parseFloat(data.closing_amount) : undefined,
      expectedAmount: data.expected_amount != null ? parseFloat(data.expected_amount) : undefined,
      difference: data.difference != null ? parseFloat(data.difference) : undefined,
      totalSales: parseFloat(data.total_sales),
      totalDinheiro: parseFloat(data.total_dinheiro),
      totalPix: parseFloat(data.total_pix),
      totalCartao: parseFloat(data.total_cartao),
      totalFiado: parseFloat(data.total_fiado),
      salesCount: data.sales_count,
      status: data.status,
    }
  } catch (error) {
    console.error('Erro ao fechar caixa no Supabase:', error)
    return null
  }
}
