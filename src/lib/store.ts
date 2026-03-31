import type { Product, Sale, Customer, DebtPayment, StockEntry, SaleAdjustment, CashRegister } from '@/types/pdv';
import { initializeSync } from './supabase/sync';
import { saveProductToSupabase } from './supabase/services/products';
import { saveSaleToSupabase } from './supabase/services/sales';
import { saveCustomerToSupabase } from './supabase/services/customers';
import { saveDebtPaymentToSupabase } from './supabase/services/debt-payments';
import { saveStockEntryToSupabase } from './supabase/services/stock';
import { saveSaleAdjustmentToSupabase } from './supabase/services/sale-adjustments';
import { openCashRegisterInSupabase, closeCashRegisterInSupabase } from './supabase/services/cash-register';

// Inicializa sync em background
initializeSync();

function get<T>(key: string): T[] {
  try {
    const data = localStorage.getItem(key);
    if (!data) return [];

    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function set<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data));
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---- Produtos ----
export function getProducts(): Product[] { return get<Product>('pdv_products'); }
export function saveProduct(p: Omit<Product, 'id' | 'createdAt'>): Product {
  const products = getProducts();
  const product: Product = { ...p, id: genId(), createdAt: new Date().toISOString() };
  products.push(product);
  set('pdv_products', products);
  saveProductToSupabase(product).catch(err => console.error('[Sync] saveProduct:', err));
  return product;
}
export function updateProduct(id: string, updates: Partial<Product>) {
  const products = getProducts().map(p => p.id === id ? { ...p, ...updates } : p);
  set('pdv_products', products);
}
export function deleteProduct(id: string) {
  set('pdv_products', getProducts().filter(p => p.id !== id));
}

// ---- Vendas ----
export function getSales(): Sale[] { return get<Sale>('pdv_sales'); }
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
  saveSaleToSupabase(sale).catch(err => console.error('[Sync] saveSale:', err));
  return sale;
}

// ---- Clientes ----
export function getCustomers(): Customer[] { return get<Customer>('pdv_customers'); }
export function saveCustomer(c: Omit<Customer, 'id' | 'createdAt'>): Customer {
  const customers = getCustomers();
  const customer: Customer = { ...c, id: genId(), createdAt: new Date().toISOString() };
  customers.push(customer);
  set('pdv_customers', customers);
  saveCustomerToSupabase(customer).catch(err => console.error('[Sync] saveCustomer:', err));
  return customer;
}
export function updateCustomer(id: string, updates: Partial<Customer>) {
  const customers = getCustomers().map(c => c.id === id ? { ...c, ...updates } : c);
  set('pdv_customers', customers);
}

// ---- Pagamentos de dívida ----
export function getDebtPayments(): DebtPayment[] { return get<DebtPayment>('pdv_debt_payments'); }
export function saveDebtPayment(dp: Omit<DebtPayment, 'id' | 'createdAt'>): DebtPayment {
  const payments = getDebtPayments();
  const payment: DebtPayment = { ...dp, id: genId(), createdAt: new Date().toISOString() };
  payments.push(payment);
  set('pdv_debt_payments', payments);
  saveDebtPaymentToSupabase(payment).catch(err => console.error('[Sync] saveDebtPayment:', err));
  return payment;
}

// ---- Entradas de estoque ----
export function getStockEntries(): StockEntry[] { return get<StockEntry>('pdv_stock_entries'); }
export function saveStockEntry(se: Omit<StockEntry, 'id' | 'createdAt'>): StockEntry {
  const entries = getStockEntries();
  const entry: StockEntry = { ...se, id: genId(), createdAt: new Date().toISOString() };
  entries.push(entry);
  set('pdv_stock_entries', entries);
  const product = getProducts().find(p => p.id === se.productId);
  if (product) {
    updateProduct(product.id, { stock: product.stock + se.quantity });
  }
  saveStockEntryToSupabase(entry).catch(err => console.error('[Sync] saveStockEntry:', err));
  return entry;
}

// ---- Ajustes de venda ----
export function getSaleAdjustments(): SaleAdjustment[] { return get<SaleAdjustment>('pdv_sale_adjustments'); }
export function getAdjustmentsForSale(saleId: string): SaleAdjustment[] {
  return getSaleAdjustments().filter(a => a.saleId === saleId);
}
export function saveSaleAdjustment(adj: Omit<SaleAdjustment, 'id' | 'createdAt'>): SaleAdjustment {
  const adjustments = getSaleAdjustments();
  const adjustment: SaleAdjustment = { ...adj, id: genId(), createdAt: new Date().toISOString() };
  adjustments.push(adjustment);
  set('pdv_sale_adjustments', adjustments);
  saveSaleAdjustmentToSupabase(adjustment).catch(err => console.error('[Sync] saveSaleAdjustment:', err));

  // Get original sale to compute item diffs
  const sale = getSales().find(s => s.id === adj.saleId);
  if (sale) {
    const lastItems = getLatestSaleItems(sale);
    // Stock adjustments: compare old items vs new items
    adj.items.forEach(newItem => {
      const oldItem = lastItems.find(i => i.productId === newItem.productId);
      const oldQty = oldItem ? oldItem.quantity : 0;
      const diff = newItem.quantity - oldQty;
      if (diff !== 0) {
        // diff > 0 means more sold, reduce stock; diff < 0 means returned, increase stock
        const product = getProducts().find(p => p.id === newItem.productId);
        if (product) {
          updateProduct(product.id, { stock: Math.max(0, product.stock - diff) });
        }
      }
    });
    // Items removed entirely
    lastItems.forEach(oldItem => {
      if (!adj.items.find(i => i.productId === oldItem.productId)) {
        const product = getProducts().find(p => p.id === oldItem.productId);
        if (product) {
          updateProduct(product.id, { stock: product.stock + oldItem.quantity });
        }
      }
    });
  }

  return adjustment;
}

/** Get the effective items for a sale considering its latest adjustment */
export function getLatestSaleItems(sale: Sale) {
  const adjustments = getAdjustmentsForSale(sale.id);
  if (adjustments.length === 0) return sale.items;
  const latest = adjustments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  return latest.items;
}

/** Get the effective total for a sale considering adjustments */
export function getEffectiveSaleTotal(sale: Sale): number {
  const adjustments = getAdjustmentsForSale(sale.id);
  if (adjustments.length === 0) return sale.total;
  const latest = adjustments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  return latest.newTotal;
}

// ---- Utilitários de relatório ----
export function getCustomerDebt(customerId: string): number {
  const sales = getSales().filter(s => s.customerId === customerId);
  // Sum fiado amounts, accounting for sale adjustments
  const totalFiado = sales.reduce((acc, s) => {
    // Check if this sale has been adjusted
    const adjustments = getAdjustmentsForSale(s.id);
    if (adjustments.length > 0) {
      // Use the latest adjustment's fiado amount from payments
      const latest = adjustments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      const adjustedFiado = latest.payments
        .filter(p => p.method === 'fiado')
        .reduce((a, p) => a + p.amount, 0);
      return acc + adjustedFiado;
    }
    if (s.fiadoAmount != null) return acc + s.fiadoAmount;
    if (s.paymentMethod === 'fiado') return acc + s.total;
    return acc;
  }, 0);
  const payments = getDebtPayments().filter(p => p.customerId === customerId);
  const totalPayments = payments.reduce((acc, p) => acc + p.amount, 0);
  return Math.max(0, +(totalFiado - totalPayments).toFixed(2));
}

export function getSalesByDateRange(start: Date, end: Date): Sale[] {
  return getSales().filter(s => {
    const d = new Date(s.createdAt);
    return d >= start && d <= end;
  });
}

// ---- Caixa ----
function getOne<T>(key: string): T | null {
  try {
    const data = localStorage.getItem(key);
    if (!data) return null;

    const parsed = JSON.parse(data);
    return parsed && typeof parsed === 'object' ? parsed as T : null;
  } catch {
    return null;
  }
}

export function getCashRegisters(): CashRegister[] { return get<CashRegister>('pdv_cash_registers'); }

export function getOpenCashRegister(): CashRegister | null {
  const openRegisters = getCashRegisters().filter(c => c.status === 'open');
  if (openRegisters.length === 0) return null;
  return openRegisters.sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime())[0];
}

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
  localStorage.removeItem('pdv_cash_just_closed_at');
  openCashRegisterInSupabase(register.openingAmount).catch(err => console.error('[Sync] openCashRegister:', err));
  return register;
}

export function closeCashRegister(closingAmount: number): CashRegister {
  const register = getOpenCashRegister();
  if (!register) throw new Error('Nenhum caixa aberto');

  // Calculate totals from sales made during this register session
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
  localStorage.setItem('pdv_cash_just_closed_at', Date.now().toString());
  closeCashRegisterInSupabase(updated.closingAmount || 0).catch(err => console.error('[Sync] closeCashRegister:', err));
  return updated;
}

/** Get live totals for the currently open register */
// ---- Nome do sistema ----
export function getSystemName(): string {
  return localStorage.getItem('pdv_system_name') || 'EasyCleanPDV';
}
export function setSystemName(name: string) {
  localStorage.setItem('pdv_system_name', name);
}

// ---- Config de impressão ----
export interface PrintConfig {
  showLogo: boolean;
  headerText: string;
  footerText: string;
  showCustomer: boolean;
  showPaymentDetails: boolean;
  showDate: boolean;
  fontSize: number;
}

const defaultPrintConfig: PrintConfig = {
  showLogo: true,
  headerText: '',
  footerText: 'Obrigado pela preferência! 😊\nVolte sempre!',
  showCustomer: true,
  showPaymentDetails: true,
  showDate: true,
  fontSize: 12,
};

export function getPrintConfig(): PrintConfig {
  try {
    const data = localStorage.getItem('pdv_print_config');
    return data ? { ...defaultPrintConfig, ...JSON.parse(data) } : defaultPrintConfig;
  } catch { return defaultPrintConfig; }
}

export function savePrintConfig(config: PrintConfig) {
  localStorage.setItem('pdv_print_config', JSON.stringify(config));
}

export function isAutoPrintEnabled(): boolean {
  return localStorage.getItem('pdv_auto_print') === 'true';
}

export function setAutoPrintEnabled(enabled: boolean) {
  localStorage.setItem('pdv_auto_print', enabled ? 'true' : 'false');
}

export function isBackupOnCloseEnabled(): boolean {
  return localStorage.getItem('pdv_backup_on_close') !== 'false';
}

export function setBackupOnCloseEnabled(enabled: boolean) {
  localStorage.setItem('pdv_backup_on_close', enabled ? 'true' : 'false');
}

export function getOpenRegisterTotals() {
  const register = getOpenCashRegister();
  if (!register) return null;

  const sales = getSales().filter(s => new Date(s.createdAt) >= new Date(register.openedAt));
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
      if (s.paymentMethod === 'dinheiro') totalDinheiro += s.total;
      else if (s.paymentMethod === 'pix') totalPix += s.total;
      else if (s.paymentMethod === 'cartao_credito' || s.paymentMethod === 'cartao_debito') totalCartao += s.total;
      else if (s.paymentMethod === 'fiado') totalFiado += s.total;
    }
  });

  const totalSales = sales.reduce((a, s) => a + s.total, 0);
  return { register, totalSales, totalDinheiro, totalPix, totalCartao, totalFiado, salesCount: sales.length };
}
