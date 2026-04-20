// src/lib/supabase/services/customers.ts
import { supabase, isSupabaseEnabled, getCurrentUserId } from '../client'
import type { Customer } from '@/types/pdv'

export async function getCustomersFromSupabase(): Promise<Customer[]> {
  if (!isSupabaseEnabled()) return []

  try {
    const userId = await getCurrentUserId()
    if (!userId) return []

    // OPTIMIZATION: Select only necessary fields instead of *
    const { data, error } = await supabase
      .from('customers')
      .select(`
        id,
        name,
        phone,
        address,
        cpf,
        notes,
        credit_limit,
        monthly_limit,
        status,
        created_at
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data || []).map(c => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      address: c.address,
      cpf: c.cpf,
      notes: c.notes,
      creditLimit: c.credit_limit ? parseFloat(c.credit_limit) : undefined,
      monthlyLimit: c.monthly_limit ? parseFloat(c.monthly_limit) : undefined,
      status: c.status,
      createdAt: c.created_at,
    }))
  } catch (error) {
    console.error('Erro ao buscar clientes do Supabase:', error)
    return []
  }
}

export async function saveCustomerToSupabase(c: Omit<Customer, 'id' | 'createdAt'> & { id?: string }): Promise<Customer | null> {
  if (!isSupabaseEnabled()) return null

  try {
    const userId = await getCurrentUserId()
    if (!userId) return null

    const { data, error } = await supabase
      .from('customers')
      .insert({
        ...(c.id ? { id: c.id } : {}),
        user_id: userId,
        name: c.name,
        phone: c.phone,
        address: c.address || null,
        cpf: c.cpf || null,
        notes: c.notes || null,
        credit_limit: c.creditLimit || null,
        monthly_limit: c.monthlyLimit || null,
        status: c.status,
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      name: data.name,
      phone: data.phone,
      address: data.address,
      cpf: data.cpf,
      notes: data.notes,
      creditLimit: data.credit_limit ? parseFloat(data.credit_limit) : undefined,
      monthlyLimit: data.monthly_limit ? parseFloat(data.monthly_limit) : undefined,
      status: data.status,
      createdAt: data.created_at,
    }
  } catch (error) {
    console.error('Erro ao salvar cliente no Supabase:', error)
    return null
  }
}

export async function updateCustomerInSupabase(id: string, updates: Partial<Customer>): Promise<boolean> {
  if (!isSupabaseEnabled()) return false

  try {
    const userId = await getCurrentUserId()
    if (!userId) return false

    const updateData: any = {}
    if (updates.name) updateData.name = updates.name
    if (updates.phone) updateData.phone = updates.phone
    if (updates.address !== undefined) updateData.address = updates.address
    if (updates.cpf !== undefined) updateData.cpf = updates.cpf
    if (updates.notes !== undefined) updateData.notes = updates.notes
    if (updates.creditLimit !== undefined) updateData.credit_limit = updates.creditLimit
    if (updates.monthlyLimit !== undefined) updateData.monthly_limit = updates.monthlyLimit
    if (updates.status) updateData.status = updates.status

    const { error } = await supabase
      .from('customers')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Erro ao atualizar cliente no Supabase:', error)
    return false
  }
}

export async function deleteCustomerFromSupabase(id: string): Promise<boolean> {
  if (!isSupabaseEnabled()) return false

  try {
    const userId = await getCurrentUserId()
    if (!userId) return false

    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Erro ao deletar cliente do Supabase:', error)
    return false
  }
}
