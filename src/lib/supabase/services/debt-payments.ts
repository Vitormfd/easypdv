// src/lib/supabase/services/debt-payments.ts
import { supabase, isSupabaseEnabled, getCurrentUserId } from '../client'
import type { DebtPayment } from '@/types/pdv'

export async function getDebtPaymentsFromSupabase(): Promise<DebtPayment[]> {
  if (!isSupabaseEnabled()) return []

  try {
    const userId = await getCurrentUserId()
    if (!userId) return []

    const { data, error } = await supabase
      .from('debt_payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data || []).map(p => ({
      id: p.id,
      customerId: p.customer_id,
      amount: parseFloat(p.amount),
      paymentMethod: p.payment_method,
      createdAt: p.created_at,
    }))
  } catch (error) {
    console.error('Erro ao buscar pagamentos de dívida do Supabase:', error)
    return []
  }
}

export async function saveDebtPaymentToSupabase(dp: Omit<DebtPayment, 'id' | 'createdAt'>): Promise<DebtPayment | null> {
  if (!isSupabaseEnabled()) return null

  try {
    const userId = await getCurrentUserId()
    if (!userId) return null

    const { data, error } = await supabase
      .from('debt_payments')
      .insert({
        user_id: userId,
        customer_id: dp.customerId,
        amount: dp.amount,
        payment_method: dp.paymentMethod || null,
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      customerId: data.customer_id,
      amount: parseFloat(data.amount),
      paymentMethod: data.payment_method,
      createdAt: data.created_at,
    }
  } catch (error) {
    console.error('Erro ao salvar pagamento de dívida no Supabase:', error)
    return null
  }
}

export async function getDebtPaymentsForCustomerFromSupabase(customerId: string): Promise<DebtPayment[]> {
  if (!isSupabaseEnabled()) return []

  try {
    const userId = await getCurrentUserId()
    if (!userId) return []

    const { data, error } = await supabase
      .from('debt_payments')
      .select('*')
      .eq('user_id', userId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data || []).map(p => ({
      id: p.id,
      customerId: p.customer_id,
      amount: parseFloat(p.amount),
      paymentMethod: p.payment_method,
      createdAt: p.created_at,
    }))
  } catch (error) {
    console.error('Erro ao buscar pagamentos de dívida do cliente no Supabase:', error)
    return []
  }
}
