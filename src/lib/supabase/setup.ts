// src/lib/supabase/setup.ts
/**
 * Setup Supabase para novo usuário
 * Executar quando usuário fizer login pela primeira vez
 */

import { supabase, isSupabaseEnabled, getCurrentUserId } from './client'

/**
 * Inicializar configuração do usuário no Supabase
 * Chamar após login bem-sucedido
 */
export async function setupUserConfig(): Promise<boolean> {
  if (!isSupabaseEnabled()) return false

  try {
    const userId = await getCurrentUserId()
    if (!userId) return false

    // Verificar se já tem config
    const { data: existing } = await supabase
      .from('system_config')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (existing) {
      // Já tem config, não precisa criar
      return true
    }

    // Criar config padrão
    const { error } = await supabase
      .from('system_config')
      .insert({
        user_id: userId,
        system_name: 'EasyPDV',
        auto_print_enabled: false,
        print_config: {
          showLogo: true,
          headerText: '',
          footerText: 'Obrigado pela preferência! 😊\nVolte sempre!',
          showCustomer: true,
          showPaymentDetails: true,
          showDate: true,
          fontSize: 12,
        },
      })

    if (error) throw error
    return true
  } catch (error) {
    console.error('Erro ao configurar usuário:', error)
    return false
  }
}

/**
 * Migrar dados locais para Supabase (para usuários que já usavam offline)
 * Chamar quando Supabase é ativado pela primeira vez
 */
export async function migrateLocalDataToSupabase(localData: {
  products?: any[]
  customers?: any[]
  sales?: any[]
  cashRegisters?: any[]
  debtPayments?: any[]
  stockEntries?: any[]
  saleAdjustments?: any[]
}): Promise<{ success: boolean; errors: string[] }> {
  if (!isSupabaseEnabled()) {
    return { success: false, errors: ['Supabase não está configurado'] }
  }

  const errors: string[] = []

  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return { success: false, errors: ['Usuário não autenticado'] }
    }

    // Migrar produtos
    if (localData.products && localData.products.length > 0) {
      const { error } = await supabase
        .from('products')
        .insert(
          localData.products.map(p => ({
            user_id: userId,
            code: p.code,
            barcode: p.barcode || null,
            name: p.name,
            price: p.price,
            cost: p.cost,
            stock: p.stock,
            unit: p.unit,
            min_stock: p.minStock,
            expiry_date: p.expiryDate || null,
            created_at: p.createdAt,
          }))
        )
      if (error) errors.push(`Erro ao migrar produtos: ${error.message}`)
    }

    // Migrar clientes
    if (localData.customers && localData.customers.length > 0) {
      const { error } = await supabase
        .from('customers')
        .insert(
          localData.customers.map(c => ({
            user_id: userId,
            name: c.name,
            phone: c.phone || null,
            address: c.address || null,
            cpf: c.cpf || null,
            notes: c.notes || null,
            credit_limit: c.creditLimit || null,
            monthly_limit: c.monthlyLimit || null,
            status: c.status,
            created_at: c.createdAt,
          }))
        )
      if (error) errors.push(`Erro ao migrar clientes: ${error.message}`)
    }

    // Migrar vendas (com items e payments)
    if (localData.sales && localData.sales.length > 0) {
      for (const sale of localData.sales) {
        const { data: createdSale, error: saleError } = await supabase
          .from('sales')
          .insert({
            user_id: userId,
            customer_id: sale.customerId || null,
            customer_name: sale.customerName || null,
            total: sale.total,
            fiado_amount: sale.fiadoAmount || 0,
            payment_method: sale.paymentMethod,
            created_at: sale.createdAt,
          })
          .select()
          .single()

        if (saleError) {
          errors.push(`Erro ao migrar venda: ${saleError.message}`)
          continue
        }

        // Migrar items
        if (sale.items?.length > 0) {
          const { error: itemsError } = await supabase
            .from('sale_items')
            .insert(
              sale.items.map(item => ({
                sale_id: createdSale.id,
                product_id: item.productId,
                product_name: item.productName,
                quantity: item.quantity,
                unit_price: item.unitPrice,
                subtotal: item.subtotal,
                discount: item.discount || 0,
              }))
            )
          if (itemsError) errors.push(`Erro ao migrar items da venda: ${itemsError.message}`)
        }

        // Migrar payments
        if (sale.payments?.length > 0) {
          const { error: paymentsError } = await supabase
            .from('sale_payments')
            .insert(
              sale.payments.map(p => ({
                sale_id: createdSale.id,
                method: p.method,
                amount: p.amount,
              }))
            )
          if (paymentsError) errors.push(`Erro ao migrar payments: ${paymentsError.message}`)
        }
      }
    }

    // Migrar caixas
    if (localData.cashRegisters && localData.cashRegisters.length > 0) {
      const { error } = await supabase
        .from('cash_registers')
        .insert(
          localData.cashRegisters.map(r => ({
            user_id: userId,
            opened_at: r.openedAt,
            closed_at: r.closedAt || null,
            opening_amount: r.openingAmount,
            closing_amount: r.closingAmount || null,
            expected_amount: r.expectedAmount || null,
            difference: r.difference || null,
            total_sales: r.totalSales,
            total_dinheiro: r.totalDinheiro,
            total_pix: r.totalPix,
            total_cartao: r.totalCartao,
            total_fiado: r.totalFiado,
            sales_count: r.salesCount,
            status: r.status,
            created_at: r.openedAt,
          }))
        )
      if (error) errors.push(`Erro ao migrar caixas: ${error.message}`)
    }

    // Migrar pagamentos de dívida
    if (localData.debtPayments && localData.debtPayments.length > 0) {
      const { error } = await supabase
        .from('debt_payments')
        .insert(
          localData.debtPayments.map(p => ({
            user_id: userId,
            customer_id: p.customerId,
            amount: p.amount,
            payment_method: p.paymentMethod || null,
            created_at: p.createdAt,
          }))
        )
      if (error) errors.push(`Erro ao migrar pagamentos de dívida: ${error.message}`)
    }

    // Migrar entradas de estoque
    if (localData.stockEntries && localData.stockEntries.length > 0) {
      const { error } = await supabase
        .from('stock_entries')
        .insert(
          localData.stockEntries.map(e => ({
            user_id: userId,
            product_id: e.productId,
            quantity: e.quantity,
            type: 'entrada',
            created_at: e.createdAt,
          }))
        )
      if (error) errors.push(`Erro ao migrar estoque: ${error.message}`)
    }

    return {
      success: errors.length === 0,
      errors,
    }
  } catch (error) {
    console.error('Erro geral na migração:', error)
    return {
      success: false,
      errors: [`Erro geral: ${error instanceof Error ? error.message : 'Desconhecido'}`],
    }
  }
}

/**
 * Setup inicial após login
 * Executar esta função após autenticar usuário
 */
export async function initializeAfterLogin(): Promise<void> {
  if (!isSupabaseEnabled()) return

  try {
    console.log('Inicializando setup pós-login...')

    // 1. Configurar usuário
    await setupUserConfig()

    // 2. Iniciar sincronização
    console.log('Setup completo. Sincronização iniciada.')
  } catch (error) {
    console.error('Erro no setup pós-login:', error)
  }
}
