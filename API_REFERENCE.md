// 📚 REFERÊNCIA COMPLETA DE APIs

// ============================================================================
// SUPABASE SERVICES - Tudo que está disponível
// ============================================================================

// ============================================================================
// 1. PRODUTOS (src/lib/supabase/services/products.ts)
// ============================================================================

import {
  getProductsFromSupabase,      // async (): Promise<Product[]>
  saveProductToSupabase,        // async (p): Promise<Product | null>
  updateProductInSupabase,      // async (id, updates): Promise<boolean>
  deleteProductFromSupabase,    // async (id): Promise<boolean>
  updateProductStockInSupabase, // async (productId, newStock): Promise<boolean>
} from '@/lib/supabase/services/products'

// Exemplos:
const products = await getProductsFromSupabase()
const newProduct = await saveProductToSupabase({
  code: 'PROD001',
  name: 'Arroz',
  price: 5.50,
  cost: 3.00,
  stock: 100,
  unit: 'kg',
  minStock: 10,
})
await updateProductInSupabase('product-id', { price: 6.00 })
await updateProductStockInSupabase('product-id', 95) // baixa de estoque
await deleteProductFromSupabase('product-id')

// ============================================================================
// 2. CLIENTES (src/lib/supabase/services/customers.ts)
// ============================================================================

import {
  getCustomersFromSupabase,    // async (): Promise<Customer[]>
  saveCustomerToSupabase,      // async (c): Promise<Customer | null>
  updateCustomerInSupabase,    // async (id, updates): Promise<boolean>
  deleteCustomerFromSupabase,  // async (id): Promise<boolean>
} from '@/lib/supabase/services/customers'

// Exemplos:
const customers = await getCustomersFromSupabase()
const newCustomer = await saveCustomerToSupabase({
  name: 'João Silva',
  phone: '11999999999',
  cpf: '12345678900',
  creditLimit: 1000,
  monthlyLimit: 500,
  status: 'active',
})
await updateCustomerInSupabase('customer-id', { status: 'blocked' })
await deleteCustomerFromSupabase('customer-id')

// ============================================================================
// 3. VENDAS (src/lib/supabase/services/sales.ts)
// ============================================================================

import {
  getSalesFromSupabase,                // async (): Promise<Sale[]>
  saveSaleToSupabase,                  // async (s): Promise<Sale | null>
  getSalesByDateRangeFromSupabase,     // async (start, end): Promise<Sale[]>
} from '@/lib/supabase/services/sales'

// Exemplos:
const sales = await getSalesFromSupabase()

const newSale = await saveSaleToSupabase({
  items: [
    { productId: 'p1', productName: 'Arroz', quantity: 2, unitPrice: 5.50, subtotal: 11 },
    { productId: 'p2', productName: 'Feijão', quantity: 1, unitPrice: 8, subtotal: 8 },
  ],
  total: 19,
  payments: [
    { method: 'dinheiro', amount: 19 },
  ],
  paymentMethod: 'dinheiro',
  customerId: 'cust-123',
  customerName: 'João Silva',
})

const salesInPeriod = await getSalesByDateRangeFromSupabase(
  new Date('2026-01-01'),
  new Date('2026-01-31')
)

// ============================================================================
// 4. CAIXA (src/lib/supabase/services/cash-register.ts)
// ============================================================================

import {
  getCashRegistersFromSupabase,      // async (): Promise<CashRegister[]>
  getOpenCashRegisterFromSupabase,   // async (): Promise<CashRegister | null>
  openCashRegisterInSupabase,        // async (amount): Promise<CashRegister | null>
  closeCashRegisterInSupabase,       // async (amount): Promise<CashRegister | null>
} from '@/lib/supabase/services/cash-register'

// Exemplos:
const allRegisters = await getCashRegistersFromSupabase()
const openRegister = await getOpenCashRegisterInSupabase()

const opened = await openCashRegisterInSupabase(100) // abre com R$100
const closed = await closeCashRegisterInSupabase(250) // fecha com R$250

// ============================================================================
// 5. PAGAMENTOS DE DÍVIDA (src/lib/supabase/services/debt-payments.ts)
// ============================================================================

import {
  getDebtPaymentsFromSupabase,              // async (): Promise<DebtPayment[]>
  saveDebtPaymentToSupabase,                // async (dp): Promise<DebtPayment | null>
  getDebtPaymentsForCustomerFromSupabase,   // async (customerId): Promise<DebtPayment[]>
} from '@/lib/supabase/services/debt-payments'

// Exemplos:
const allPayments = await getDebtPaymentsFromSupabase()

const customerPayments = await getDebtPaymentsForCustomerFromSupabase('cust-123')

const newPayment = await saveDebtPaymentToSupabase({
  customerId: 'cust-123',
  amount: 50,
  paymentMethod: 'dinheiro',
})

// ============================================================================
// 6. ESTOQUE (src/lib/supabase/services/stock.ts)
// ============================================================================

import {
  getStockEntriesFromSupabase,        // async (): Promise<StockEntry[]>
  saveStockEntryToSupabase,           // async (se): Promise<StockEntry | null>
  recordStockMovementInSupabase,      // async (productId, qty, type, reason?): Promise<boolean>
} from '@/lib/supabase/services/stock'

// Exemplos:
const entries = await getStockEntriesFromSupabase()

const entry = await saveStockEntryToSupabase({
  productId: 'prod-123',
  quantity: 50,
})

await recordStockMovementInSupabase('prod-123', 10, 'entrada', 'Devolução do cliente')
await recordStockMovementInSupabase('prod-123', -5, 'saida', 'Amostra')
await recordStockMovementInSupabase('prod-123', 2, 'ajuste', 'Diferença de contagem')

// ============================================================================
// 7. AJUSTES DE VENDA (src/lib/supabase/services/sale-adjustments.ts)
// ============================================================================

import {
  getSaleAdjustmentsFromSupabase,       // async (): Promise<SaleAdjustment[]>
  getAdjustmentsForSaleFromSupabase,    // async (saleId): Promise<SaleAdjustment[]>
  saveSaleAdjustmentToSupabase,         // async (adj): Promise<SaleAdjustment | null>
} from '@/lib/supabase/services/sale-adjustments'

// Exemplos:
const allAdjustments = await getSaleAdjustmentsFromSupabase()
const saleAdjustments = await getAdjustmentsForSaleFromSupabase('sale-123')

const adjustment = await saveSaleAdjustmentToSupabase({
  saleId: 'sale-123',
  items: [
    { productId: 'p1', productName: 'Arroz', quantity: 3, unitPrice: 5.50, subtotal: 16.50 },
  ],
  previousTotal: 19,
  newTotal: 16.50,
  difference: -2.50,
  payments: [
    { method: 'dinheiro', amount: 16.50 },
  ],
  reason: 'Desconto concedido',
})

// ============================================================================
// CLIENTE LOW-LEVEL (src/lib/supabase/client.ts)
// ============================================================================

import {
  supabase,              // Cliente Supabase JS
  isSupabaseEnabled,     // (): boolean
  getCurrentUser,        // async (): Promise<User | null>
  getCurrentUserId,      // async (): Promise<string | null>
} from '@/lib/supabase/client'

// Exemplos:
if (isSupabaseEnabled()) {
  const user = await getCurrentUser()
  const userId = await getCurrentUserId()
  
  // Acesso direto ao Supabase se necessário:
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .limit(10)
}

// ============================================================================
// SINCRONIZAÇÃO (src/lib/supabase/sync.ts)
// ============================================================================

import {
  syncWithSupabase,   // (): void - sincroniza tudo agora
  initializeSync,     // (): void - inicia sincronização periódica
} from '@/lib/supabase/sync'

// Exemplos:
// Chamar uma vez no startup do app:
initializeSync()

// Forçar sincronização imediata (raramente necessário):
syncWithSupabase()

// ============================================================================
// SETUP (src/lib/supabase/setup.ts)
// ============================================================================

import {
  setupUserConfig,               // async (): Promise<boolean>
  migrateLocalDataToSupabase,    // async (localData): Promise<{...}>
  initializeAfterLogin,          // async (): void
} from '@/lib/supabase/setup'

// Exemplos:
// Após login bem-sucedido:
await initializeAfterLogin()

// Para migrar dados antigos:
const result = await migrateLocalDataToSupabase({
  products: localProducts,
  customers: localCustomers,
  sales: localSales,
  // ... resto dos dados
})

if (result.success) {
  console.log('Migração concluída!')
} else {
  console.error('Erros na migração:', result.errors)
}

// ============================================================================
// PADRÕES DE USO
// ============================================================================

// PADRÃO 1: Leitura sempre em localStorage (rápido)
// const products = getProducts()  // localStorage

// PADRÃO 2: Escrita em localStorage + background sync
// saveProduct({...})  // localStorage instantâneo
// → em background, saveProductToSupabase({...}) é chamado

// PADRÃO 3: Sincronizar com backend
// const backendProducts = await getProductsFromSupabase()
// // Use quando precisar dados mais atualizados

// PADRÃO 4: Offline funciona naturalmente
// Tudo em localStorage, sync quando online

// PADRÃO 5: RLS protege dados por usuário
// Cada user vê apenas seus dados automaticamente

// ============================================================================
// OBSERVAÇÕES IMPORTANTES
// ============================================================================

/*
1. RETORNO NULL significa erro
   const newProduct = await saveProductToSupabase(...)
   if (!newProduct) {
     console.error('Erro ao salvar')
   }

2. Sempre use .catch() em background sync
   saveProductToSupabase(p).catch(err => console.error(err))

3. NÃO await na UI
   // ❌ Não faça isso:
   await saveProductToSupabase(p)  // bloqueia a UI
   
   // ✅ Faça assim:
   saveProductToSupabase(p).catch(err => ...)  // async em background

4. Diferença de tipos
   - getProducts(): Product[]           // localStorage, instantâneo
   - getProductsFromSupabase(): Promise // backend, async

5. RLS automático
   - Não precisa ficar atento a user_id
   - SELECT/INSERT/UPDATE/DELETE já filtra por auth.uid()

6. Timestamps automáticos
   - created_at: automático
   - updated_at: automático (triggers)

7. Decimals vs Floats
   - Estoque: decimal (kg, lt)
   - Preços: decimal
   - Sempre parseFloat() ao retornar
*/

// ============================================================================
// TIPOS TYPESCRIPT
// ============================================================================

/*
Product {
  id: string
  code: string
  barcode?: string
  name: string
  price: number
  cost: number
  stock: number
  unit: 'un' | 'kg' | 'lt'
  minStock: number
  expiryDate?: string
  createdAt: string
}

Customer {
  id: string
  name: string
  phone: string
  address?: string
  cpf?: string
  notes?: string
  creditLimit?: number
  monthlyLimit?: number
  status: 'active' | 'blocked'
  createdAt: string
}

Sale {
  id: string
  items: { productId, productName, quantity, unitPrice, subtotal }[]
  total: number
  payments: { method, amount }[]
  paymentMethod: PaymentMethod
  customerId?: string
  customerName?: string
  fiadoAmount?: number
  createdAt: string
}

CashRegister {
  id: string
  openedAt: string
  closedAt?: string
  openingAmount: number
  closingAmount?: number
  expectedAmount?: number
  difference?: number
  totalSales: number
  totalDinheiro: number
  totalPix: number
  totalCartao: number
  totalFiado: number
  salesCount: number
  status: 'open' | 'closed'
}

PaymentMethod = 'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito' | 'fiado'
*/

// ============================================================================
// QUICK REFERENCE - FUNÇÕES MAIS USADAS
// ============================================================================

/*
📌 Produtos
  getProductsFromSupabase()
  saveProductToSupabase(p)
  updateProductInSupabase(id, updates)
  updateProductStockInSupabase(id, newStock)
  deleteProductFromSupabase(id)

📌 Clientes
  getCustomersFromSupabase()
  saveCustomerToSupabase(c)
  updateCustomerInSupabase(id, updates)
  deleteCustomerFromSupabase(id)

📌 Vendas
  getSalesFromSupabase()
  saveSaleToSupabase(s)
  getSalesByDateRangeFromSupabase(start, end)

📌 Caixa
  getOpenCashRegisterFromSupabase()
  openCashRegisterInSupabase(amount)
  closeCashRegisterInSupabase(amount)

📌 Sincronização
  initializeSync()           // chamar no startup
  syncWithSupabase()         // forçar sync imediato

📌 Setup
  initializeAfterLogin()     // após login
  migrateLocalDataToSupabase(data)  // migração
*/
