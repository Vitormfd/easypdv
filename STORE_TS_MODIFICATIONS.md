// ARQUIVO: src/lib/store.ts - MODIFICAÇÕES NECESSÁRIAS

/**
 * Este arquivo mostra EXATAMENTE o que modificar no store.ts
 * 
 * REGRA: Adicionar APENAS AS LINHAS COM COMENTÁRIO "← ADD THIS"
 * NÃO modificar nada mais
 */

// ============================================================================
// SEÇÃO 1: Adicionar imports no topo (linhas 1-20 aproximadamente)
// ============================================================================

import type { Product, Sale, Customer, DebtPayment, StockEntry, SaleAdjustment, CashRegister } from '@/types/pdv';

// ← ADD THIS - Importar serviços Supabase
import { saveProductToSupabase, updateProductInSupabase, deleteProductFromSupabase, updateProductStockInSupabase } from '@/lib/supabase/services/products'
import { saveCustomerToSupabase, updateCustomerInSupabase, deleteCustomerFromSupabase } from '@/lib/supabase/services/customers'
import { saveSaleToSupabase, getSalesByDateRangeFromSupabase } from '@/lib/supabase/services/sales'
import { openCashRegisterInSupabase, closeCashRegisterInSupabase, getOpenCashRegisterFromSupabase, getCashRegistersFromSupabase } from '@/lib/supabase/services/cash-register'
import { saveDebtPaymentToSupabase, getDebtPaymentsForCustomerFromSupabase } from '@/lib/supabase/services/debt-payments'
import { saveStockEntryToSupabase } from '@/lib/supabase/services/stock'
import { getSaleAdjustmentsFromSupabase, getAdjustmentsForSaleFromSupabase, saveSaleAdjustmentToSupabase } from '@/lib/supabase/services/sale-adjustments'

// Manter tudo que já tinha...

// ============================================================================
// SEÇÃO 2: Função saveProduct() - adicionar 1 linha
// ============================================================================

// ANTES:
/*
export function saveProduct(p: Omit<Product, 'id' | 'createdAt'>): Product {
  const products = getProducts();
  const product: Product = { ...p, id: genId(), createdAt: new Date().toISOString() };
  products.push(product);
  set('pdv_products', products);
  return product;
}
*/

// DEPOIS:
export function saveProduct(p: Omit<Product, 'id' | 'createdAt'>): Product {
  const products = getProducts();
  const product: Product = { ...p, id: genId(), createdAt: new Date().toISOString() };
  products.push(product);
  set('pdv_products', products);
  saveProductToSupabase(p).catch(err => console.error('[Sync] Erro produto:', err)) // ← ADD THIS
  return product;
}

// ============================================================================
// SEÇÃO 3: Função updateProduct() - adicionar 1 linha
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
  set('pdv_products', products);
  updateProductInSupabase(id, updates).catch(err => console.error('[Sync] Erro update produto:', err)) // ← ADD THIS
}

// ============================================================================
// SEÇÃO 4: Função deleteProduct() - adicionar 1 linha
// ============================================================================

// ANTES:
/*
export function deleteProduct(id: string) {
  set('pdv_products', getProducts().filter(p => p.id !== id));
}
*/

// DEPOIS:
export function deleteProduct(id: string) {
  set('pdv_products', getProducts().filter(p => p.id !== id));
  deleteProductFromSupabase(id).catch(err => console.error('[Sync] Erro delete produto:', err)) // ← ADD THIS
}

// ============================================================================
// SEÇÃO 5: Função saveSale() - IMPORTANTE - adicionar 1 linha
// ============================================================================

// ANTES:
/*
export function saveSale(s: Omit<Sale, 'id' | 'createdAt'> & { createdAt?: string }): Sale {
  const sales = getSales();
  const sale: Sale = { ...s, id: genId(), createdAt: s.createdAt || new Date().toISOString() };
  sales.push(sale);
  set('pdv_sales', sales);
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
  set('pdv_sales', sales);
  s.items.forEach(item => {
    const products = getProducts();
    const product = products.find(p => p.id === item.productId);
    if (product) {
      updateProduct(product.id, { stock: Math.max(0, product.stock - item.quantity) });
    }
  });
  saveSaleToSupabase(s).catch(err => console.error('[Sync] Erro venda:', err)) // ← ADD THIS
  return sale;
}

// ============================================================================
// SEÇÃO 6: Função saveCustomer() - adicionar 1 linha
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
  set('pdv_customers', customers);
  saveCustomerToSupabase(c).catch(err => console.error('[Sync] Erro cliente:', err)) // ← ADD THIS
  return customer;
}

// ============================================================================
// SEÇÃO 7: Função updateCustomer() - adicionar 1 linha
// ============================================================================

// ANTES:
/*
export function updateCustomer(id: string, updates: Partial<Customer>) {
  const customers = getCustomers().map(c => c.id === id ? { ...c, ...updates } : c);
  set('pdv_customers', customers);
}
*/

// DEPOIS:
export function updateCustomer(id: string, updates: Partial<Customer>) {
  const customers = getCustomers().map(c => c.id === id ? { ...c, ...updates } : c);
  set('pdv_customers', customers);
  updateCustomerInSupabase(id, updates).catch(err => console.error('[Sync] Erro update cliente:', err)) // ← ADD THIS
}

// ============================================================================
// SEÇÃO 8: Função saveDebtPayment() - adicionar 1 linha
// ============================================================================

// ANTES:
/*
export function saveDebtPayment(dp: Omit<DebtPayment, 'id' | 'createdAt'>): DebtPayment {
  const payments = getDebtPayments();
  const payment: DebtPayment = { ...dp, id: genId(), createdAt: new Date().toISOString() };
  payments.push(payment);
  set('pdv_debt_payments', payments);
  return payment;
}
*/

// DEPOIS:
export function saveDebtPayment(dp: Omit<DebtPayment, 'id' | 'createdAt'>): DebtPayment {
  const payments = getDebtPayments();
  const payment: DebtPayment = { ...dp, id: genId(), createdAt: new Date().toISOString() };
  payments.push(payment);
  set('pdv_debt_payments', payments);
  saveDebtPaymentToSupabase(dp).catch(err => console.error('[Sync] Erro pagto dívida:', err)) // ← ADD THIS
  return payment;
}

// ============================================================================
// SEÇÃO 9: Função saveStockEntry() - adicionar 1 linha
// ============================================================================

// ANTES:
/*
export function saveStockEntry(se: Omit<StockEntry, 'id' | 'createdAt'>): StockEntry {
  const entries = getStockEntries();
  const entry: StockEntry = { ...se, id: genId(), createdAt: new Date().toISOString() };
  entries.push(entry);
  set('pdv_stock_entries', entries);
  const product = getProducts().find(p => p.id === se.productId);
  if (product) {
    updateProduct(product.id, { stock: product.stock + se.quantity });
  }
  return entry;
}
*/

// DEPOIS:
export function saveStockEntry(se: Omit<StockEntry, 'id' | 'createdAt'>): StockEntry {
  const entries = getStockEntries();
  const entry: StockEntry = { ...se, id: genId(), createdAt: new Date().toISOString() };
  entries.push(entry);
  set('pdv_stock_entries', entries);
  const product = getProducts().find(p => p.id === se.productId);
  if (product) {
    updateProduct(product.id, { stock: product.stock + se.quantity });
  }
  saveStockEntryToSupabase(se).catch(err => console.error('[Sync] Erro estoque:', err)) // ← ADD THIS
  return entry;
}

// ============================================================================
// SEÇÃO 10: Função openCashRegister() - adicionar 1 linha
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
  set('pdv_cash_registers', registers);
  openCashRegisterInSupabase(openingAmount).catch(err => console.error('[Sync] Erro abrir caixa:', err)) // ← ADD THIS
  return register;
}

// ============================================================================
// SEÇÃO 11: Função closeCashRegister() - adicionar 1 linha IMPORTANTE
// ============================================================================

// ANTES:
/*
export function closeCashRegister(closingAmount: number): CashRegister {
  const register = getOpenCashRegister();
  if (!register) throw new Error('Nenhum caixa aberto');

  const sales = getSales().filter(s => {
    const d = new Date(s.createdAt);
    return d >= new Date(register.openedAt);
  });

  let totalDinheiro = 0, totalPix = 0, totalCartao = 0, totalFiado = 0;
  sales.forEach(s => {
    if (s.payments?.length) {
      s.payments.forEach(p => {
        if (p.method === 'dinheiro') totalDinheiro += p.amount;
        else if (p.method === 'pix') totalPix += p.amount;
        else if (p.method === 'cartao_credito' || p.method === 'cartao_debito') totalCartao += p.amount;
        else if (p.method === 'fiado') totalFiado += p.amount;
      });
    } else {
      const amt = s.total;
      if (s.paymentMethod === 'dinheiro') totalDinheiro += amt;
      else if (s.paymentMethod === 'pix') totalPix += amt;
      else if (s.paymentMethod === 'cartao_credito' || s.paymentMethod === 'cartao_debito') totalCartao += amt;
      else if (s.paymentMethod === 'fiado') totalFiado += amt;
    }
  });

  const totalSales = sales.reduce((a, s) => a + s.total, 0);
  const expectedAmount = +(register.openingAmount + totalDinheiro).toFixed(2);
  const difference = +(closingAmount - expectedAmount).toFixed(2);

  const updated: CashRegister = {
    ...register,
    closedAt: new Date().toISOString(),
    closingAmount,
    expectedAmount,
    difference,
    totalSales,
    totalDinheiro,
    totalPix,
    totalCartao,
    totalFiado,
    salesCount: sales.length,
    status: 'closed',
  };

  const registers = getCashRegisters().map(r => r.id === register.id ? updated : r);
  set('pdv_cash_registers', registers);
  return updated;
}
*/

// DEPOIS:
export function closeCashRegister(closingAmount: number): CashRegister {
  const register = getOpenCashRegister();
  if (!register) throw new Error('Nenhum caixa aberto');

  const sales = getSales().filter(s => {
    const d = new Date(s.createdAt);
    return d >= new Date(register.openedAt);
  });

  let totalDinheiro = 0, totalPix = 0, totalCartao = 0, totalFiado = 0;
  sales.forEach(s => {
    if (s.payments?.length) {
      s.payments.forEach(p => {
        if (p.method === 'dinheiro') totalDinheiro += p.amount;
        else if (p.method === 'pix') totalPix += p.amount;
        else if (p.method === 'cartao_credito' || p.method === 'cartao_debito') totalCartao += p.amount;
        else if (p.method === 'fiado') totalFiado += p.amount;
      });
    } else {
      const amt = s.total;
      if (s.paymentMethod === 'dinheiro') totalDinheiro += amt;
      else if (s.paymentMethod === 'pix') totalPix += amt;
      else if (s.paymentMethod === 'cartao_credito' || s.paymentMethod === 'cartao_debito') totalCartao += amt;
      else if (s.paymentMethod === 'fiado') totalFiado += amt;
    }
  });

  const totalSales = sales.reduce((a, s) => a + s.total, 0);
  const expectedAmount = +(register.openingAmount + totalDinheiro).toFixed(2);
  const difference = +(closingAmount - expectedAmount).toFixed(2);

  const updated: CashRegister = {
    ...register,
    closedAt: new Date().toISOString(),
    closingAmount,
    expectedAmount,
    difference,
    totalSales,
    totalDinheiro,
    totalPix,
    totalCartao,
    totalFiado,
    salesCount: sales.length,
    status: 'closed',
  };

  const registers = getCashRegisters().map(r => r.id === register.id ? updated : r);
  set('pdv_cash_registers', registers);
  closeCashRegisterInSupabase(closingAmount).catch(err => console.error('[Sync] Erro fechar caixa:', err)) // ← ADD THIS
  return updated;
}

// ============================================================================
// SEÇÃO 12: Função saveSaleAdjustment() - adicionar 1 linha
// ============================================================================

// ANTES:
/*
export function saveSaleAdjustment(adj: Omit<SaleAdjustment, 'id' | 'createdAt'>): SaleAdjustment {
  // ... código existente ...
  return adjustment;
}
*/

// DEPOIS:
export function saveSaleAdjustment(adj: Omit<SaleAdjustment, 'id' | 'createdAt'>): SaleAdjustment {
  // ... MANTER TODO CÓDIGO EXISTENTE ...
  // const adjustment = { ... };
  // adjustments.push(adjustment);
  // set('pdv_sale_adjustments', adjustments);
  // ... stock adjustments logic ...
  
  saveSaleAdjustmentToSupabase(adj).catch(err => console.error('[Sync] Erro ajuste venda:', err)) // ← ADD THIS - ANTES do return
  
  return adjustment;
}

// ============================================================================
// RESUMO DAS MUDANÇAS
// ============================================================================

/**
 * TOTAL: 13 linhas adicionadas (1 por função)
 * 
 * Adicione em CADA função que modifica dados:
 * - saveProduct() → saveProductToSupabase(p)
 * - updateProduct() → updateProductInSupabase(id, updates)
 * - deleteProduct() → deleteProductFromSupabase(id)
 * - saveSale() → saveSaleToSupabase(s)
 * - saveCustomer() → saveCustomerToSupabase(c)
 * - updateCustomer() → updateCustomerInSupabase(id, updates)
 * - saveDebtPayment() → saveDebtPaymentToSupabase(dp)
 * - saveStockEntry() → saveStockEntryToSupabase(se)
 * - openCashRegister() → openCashRegisterInSupabase(openingAmount)
 * - closeCashRegister() → closeCashRegisterInSupabase(closingAmount)
 * - saveSaleAdjustment() → saveSaleAdjustmentToSupabase(adj)
 * 
 * PADRÃO: Sempre .catch(err => console.error('[Sync]', err))
 * NÃO await - deixar async em background
 */
