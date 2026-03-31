// EXEMPLOS DE INTEGRAÇÃO COM CÓDIGO EXISTENTE
// Sempre com MUDANÇA MÍNIMA (apenas adicionar chamadas em background)

// ============================================================================
// 1. INTEGRAÇÃO DO ARQUIVO store.ts
// ============================================================================

/**
 * Arquivo: src/lib/store.ts
 * 
 * MUDANÇA: Adicionar ao final do arquivo (após as funções existentes)
 * 
 * As funções existentes NÃO mudam - apenas adicionam chamadas async em background
 */

// Adicione no topo do arquivo store.ts:
import {
  saveProductToSupabase,
  updateProductInSupabase,
  deleteProductFromSupabase,
  updateProductStockInSupabase,
} from '@/lib/supabase/services/products'
import { saveCustomerToSupabase, updateCustomerInSupabase, deleteCustomerFromSupabase } from '@/lib/supabase/services/customers'
import { saveSaleToSupabase, getSalesByDateRangeFromSupabase } from '@/lib/supabase/services/sales'
import { getDebtPaymentsForCustomerFromSupabase } from '@/lib/supabase/services/debt-payments'
import { saveStockEntryToSupabase } from '@/lib/supabase/services/stock'
import { saveSaleAdjustmentToSupabase } from '@/lib/supabase/services/sale-adjustments'
import { openCashRegisterInSupabase, closeCashRegisterInSupabase } from '@/lib/supabase/services/cash-register'

// ============================================================================
// EXEMPLO: Função saveProduct() com sincronização em background
// ============================================================================

// ANTES (código atual):
/*
export function saveProduct(p: Omit<Product, 'id' | 'createdAt'>): Product {
  const products = getProducts();
  const product: Product = { ...p, id: genId(), createdAt: new Date().toISOString() };
  products.push(product);
  set('pdv_products', products);
  return product;
}
*/

// DEPOIS (com Supabase):
export function saveProduct(p: Omit<Product, 'id' | 'createdAt'>): Product {
  const products = getProducts();
  const product: Product = { ...p, id: genId(), createdAt: new Date().toISOString() };
  products.push(product);
  set('pdv_products', products);  // ← localStorage (instantâneo)
  
  // Sincronizar com Supabase em background (não bloqueia)
  saveProductToSupabase(p).catch(err => {
    console.error('Erro sincronizar produto:', err)
  })
  
  return product;
}

// ============================================================================
// EXEMPLO: Função updateProduct() com sincronização
// ============================================================================

// ANTES:
/*
export function updateProduct(id: string, updates: Partial<Product>) {
  const products = getProducts().map(p => p.id === id ? { ...p, ...updates } : p);
  set('pdv_products', products);
}
*/

// DEPOIS:
export function updateProduct(id: string, updates: Partial<Product>) {
  const products = getProducts().map(p => p.id === id ? { ...p, ...updates } : p);
  set('pdv_products', products);  // ← localStorage
  
  updateProductInSupabase(id, updates).catch(err => {
    console.error('Erro atualizar produto:', err)
  })  // ← Supabase background
}

// ============================================================================
// EXEMPLO: Função deleteProduct() com sincronização
// ============================================================================

// ANTES:
/*
export function deleteProduct(id: string) {
  set('pdv_products', getProducts().filter(p => p.id !== id));
}
*/

// DEPOIS:
export function deleteProduct(id: string) {
  set('pdv_products', getProducts().filter(p => p.id !== id));  // ← localStorage
  
  deleteProductFromSupabase(id).catch(err => {
    console.error('Erro deletar produto:', err)
  })  // ← Supabase background
}

// ============================================================================
// EXEMPLO: Função saveSale() com sincronização MAIS IMPORTANTE
// ============================================================================

// ANTES:
/*
export function saveSale(s: Omit<Sale, 'id' | 'createdAt'> & { createdAt?: string }): Sale {
  const sales = getSales();
  const sale: Sale = { ...s, id: genId(), createdAt: s.createdAt || new Date().toISOString() };
  sales.push(sale);
  set('pdv_sales', sales);
  
  // Baixa de estoque
  s.items.forEach(item => {
    const products = getProducts();
    const product = products.find(p => p.id === item.productId);
    if (product) {
      updateProduct(product.id, { stock: Math.max(0, product.stock - item.quantity) });
    }
  });
  return sale;
}
*/

// DEPOIS:
export function saveSale(s: Omit<Sale, 'id' | 'createdAt'> & { createdAt?: string }): Sale {
  const sales = getSales();
  const sale: Sale = { ...s, id: genId(), createdAt: s.createdAt || new Date().toISOString() };
  sales.push(sale);
  set('pdv_sales', sales);  // ← localStorage (instantâneo)
  
  // Baixa de estoque (local)
  s.items.forEach(item => {
    const products = getProducts();
    const product = products.find(p => p.id === item.productId);
    if (product) {
      updateProduct(product.id, { stock: Math.max(0, product.stock - item.quantity) });
    }
  });
  
  // Sincronizar com Supabase em background
  saveSaleToSupabase(s).catch(err => {
    console.error('Erro sincronizar venda:', err)
  })
  
  return sale;
}

// ============================================================================
// EXEMPLO: Função saveCustomer() com sincronização
// ============================================================================

// ANTES:
/*
export function saveCustomer(c: Omit<Customer, 'id' | 'createdAt'>): Customer {
  const customers = getCustomers();
  const customer: Customer = { ...c, id: genId(), createdAt: new Date().toISOString() };
  customers.push(customer);
  set('pdv_customers', customers);
  return customer;
}
*/

// DEPOIS:
export function saveCustomer(c: Omit<Customer, 'id' | 'createdAt'>): Customer {
  const customers = getCustomers();
  const customer: Customer = { ...c, id: genId(), createdAt: new Date().toISOString() };
  customers.push(customer);
  set('pdv_customers', customers);  // ← localStorage
  
  saveCustomerToSupabase(c).catch(err => {
    console.error('Erro sincronizar cliente:', err)
  })
  
  return customer;
}

// ============================================================================
// EXEMPLO: Função openCashRegister() com sincronização
// ============================================================================

// ANTES:
/*
export function openCashRegister(openingAmount: number): CashRegister {
  if (getOpenCashRegister()) throw new Error('Já existe um caixa aberto');
  const registers = getCashRegisters();
  const register: CashRegister = {
    id: genId(),
    openedAt: new Date().toISOString(),
    openingAmount,
    totalSales: 0,
    totalDinheiro: 0,
    totalPix: 0,
    totalCartao: 0,
    totalFiado: 0,
    salesCount: 0,
    status: 'open',
  };
  registers.push(register);
  set('pdv_cash_registers', registers);
  return register;
}
*/

// DEPOIS:
export function openCashRegister(openingAmount: number): CashRegister {
  if (getOpenCashRegister()) throw new Error('Já existe um caixa aberto');
  const registers = getCashRegisters();
  const register: CashRegister = {
    id: genId(),
    openedAt: new Date().toISOString(),
    openingAmount,
    totalSales: 0,
    totalDinheiro: 0,
    totalPix: 0,
    totalCartao: 0,
    totalFiado: 0,
    salesCount: 0,
    status: 'open',
  };
  registers.push(register);
  set('pdv_cash_registers', registers);  // ← localStorage
  
  openCashRegisterInSupabase(openingAmount).catch(err => {
    console.error('Erro abrir caixa:', err)
  })
  
  return register;
}

// ============================================================================
// 2. INICIALIZAR SINCRONIZAÇÃO
// ============================================================================

/**
 * Arquivo: src/main.tsx
 * 
 * MUDANÇA: Adicionar estas linhas após criar a aplicação
 */

// No arquivo main.tsx, após ReactDOM.createRoot(...).render(...):

import { initializeSync } from '@/lib/supabase/sync'

// Inicializar sincronização periódica
initializeSync()

// ============================================================================
// 3. EXEMPLO: FEATURE NOVA - Buscar dados do backend (multi-device)
// ============================================================================

/**
 * Se precisar sincronizar dados entre devices:
 */

import { getSalesFromSupabase } from '@/lib/supabase/services/sales'
import { getProductsFromSupabase } from '@/lib/supabase/services/products'

// Em qualquer página/componente:
async function loadDataFromBackend() {
  try {
    // Buscar dados do Supabase (dados mais atualizados)
    const backendSales = await getSalesFromSupabase()
    const backendProducts = await getProductsFromSupabase()
    
    // Comparar com localStorage e atualizar se necessário
    const localSales = getSales()
    if (backendSales.length > localSales.length) {
      // Há dados novos no backend, atualizar localStorage
      set('pdv_sales', backendSales)
    }
    
    // Idem para produtos
    const localProducts = getProducts()
    if (backendProducts.length > localProducts.length) {
      set('pdv_products', backendProducts)
    }
  } catch (error) {
    console.error('Erro ao sincronizar com backend:', error)
    // Continua funcionando com dados locais
  }
}

// ============================================================================
// PADRÃO A SEGUIR
// ============================================================================

/**
 * SEMPRE:
 * 1. Escrever em localStorage primeiro (rápido, offline)
 * 2. Chamar função Supabase em background (.catch() para erros)
 * 3. NÃO fazer await nas chamadas Supabase (não bloqueia UI)
 * 4. Deixar sincronização periódica (sync.ts) fazer o trabalho
 * 
 * RESULTADO:
 * - Sistema funciona 100% igual (offline ou online)
 * - Dados persistidos no backend automaticamente
 * - Sem mudanças visuais no frontend
 * - Pronto para SaaS
 */
