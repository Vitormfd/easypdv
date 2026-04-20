// src/lib/supabase/services/products.ts
import { supabase, isSupabaseEnabled, getCurrentUserId } from '../client'
import type { Product } from '@/types/pdv'

/**
 * Busca todos os produtos do usuário
 */
export async function getProductsFromSupabase(): Promise<Product[]> {
  if (!isSupabaseEnabled()) return []

  try {
    const userId = await getCurrentUserId()
    if (!userId) return []

    // OPTIMIZATION: Select only necessary fields instead of *
    const { data, error } = await supabase
      .from('products')
      .select(`
        id,
        code,
        barcode,
        name,
        price,
        cost,
        stock,
        unit,
        min_stock,
        is_active,
        status,
        expiry_date,
        created_at
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data || []).map(p => ({
      id: p.id,
      code: p.code,
      barcode: p.barcode,
      name: p.name,
      price: parseFloat(p.price),
      cost: parseFloat(p.cost),
      stock: parseFloat(p.stock),
      unit: p.unit as 'un' | 'kg' | 'lt',
      minStock: parseFloat(p.min_stock),
      isActive: typeof (p as any).is_active === 'boolean'
        ? (p as any).is_active
        : (typeof (p as any).status === 'string'
            ? (p as any).status !== 'inactive'
            : true),
      status: typeof (p as any).status === 'string'
        ? ((p as any).status === 'inactive' ? 'inactive' : 'active')
        : undefined,
      expiryDate: p.expiry_date,
      createdAt: p.created_at,
    }))
  } catch (error) {
    console.error('Erro ao buscar produtos do Supabase:', error)
    return []
  }
}

/**
 * Salva um novo produto no Supabase
 */
export async function saveProductToSupabase(p: Omit<Product, 'id' | 'createdAt'> & { id?: string }): Promise<Product | null> {
  if (!isSupabaseEnabled()) return null

  try {
    const userId = await getCurrentUserId()
    if (!userId) return null

    const { data, error } = await supabase
      .from('products')
      .insert({
        ...(p.id ? { id: p.id } : {}),
        user_id: userId,
        code: p.code,
        barcode: p.barcode || null,
        name: p.name,
        price: p.price,
        cost: p.cost,
        stock: p.stock,
        unit: p.unit,
        min_stock: p.minStock,
        is_active: p.isActive !== false,
        expiry_date: p.expiryDate || null,
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      code: data.code,
      barcode: data.barcode,
      name: data.name,
      price: parseFloat(data.price),
      cost: parseFloat(data.cost),
      stock: parseFloat(data.stock),
      unit: data.unit,
      minStock: parseFloat(data.min_stock),
      isActive: typeof (data as any).is_active === 'boolean'
        ? (data as any).is_active
        : (typeof (data as any).status === 'string'
            ? (data as any).status !== 'inactive'
            : true),
      status: typeof (data as any).status === 'string'
        ? ((data as any).status === 'inactive' ? 'inactive' : 'active')
        : undefined,
      expiryDate: data.expiry_date,
      createdAt: data.created_at,
    }
  } catch (error) {
    console.error('Erro ao salvar produto no Supabase:', error)
    return null
  }
}

/**
 * Atualiza um produto no Supabase
 */
export async function updateProductInSupabase(id: string, updates: Partial<Product>): Promise<boolean> {
  if (!isSupabaseEnabled()) return false

  try {
    const userId = await getCurrentUserId()
    if (!userId) return false

    const updateData: any = {}
    if (updates.name) updateData.name = updates.name
    if (updates.code !== undefined) updateData.code = updates.code
    if (updates.barcode !== undefined) updateData.barcode = updates.barcode || null
    if (updates.price !== undefined) updateData.price = updates.price
    if (updates.cost !== undefined) updateData.cost = updates.cost
    if (updates.stock !== undefined) updateData.stock = updates.stock
    if (updates.unit) updateData.unit = updates.unit
    if (updates.minStock !== undefined) updateData.min_stock = updates.minStock
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive
    if (updates.expiryDate !== undefined) updateData.expiry_date = updates.expiryDate

    const { error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Erro ao atualizar produto no Supabase:', error)
    return false
  }
}

/**
 * Deleta um produto do Supabase
 */
export async function deleteProductFromSupabase(id: string): Promise<boolean> {
  if (!isSupabaseEnabled()) return false

  try {
    const userId = await getCurrentUserId()
    if (!userId) return false

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Erro ao deletar produto do Supabase:', error)
    return false
  }
}

/**
 * Atualiza o estoque de um produto (operação atômica)
 */
export async function updateProductStockInSupabase(productId: string, newStock: number): Promise<boolean> {
  if (!isSupabaseEnabled()) return false

  try {
    const userId = await getCurrentUserId()
    if (!userId) return false

    const { error } = await supabase
      .from('products')
      .update({ stock: Math.max(0, newStock) })
      .eq('id', productId)
      .eq('user_id', userId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Erro ao atualizar estoque do Supabase:', error)
    return false
  }
}
