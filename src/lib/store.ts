import type { Product, Sale, Customer, DebtPayment, StockEntry, SaleAdjustment, CashRegister, PaymentEntry } from '@/types/pdv';
import { initializeSync } from './supabase/sync';
import { saveProductToSupabase, updateProductInSupabase, deleteProductFromSupabase } from './supabase/services/products';
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

function emitDataUpdated(key: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('pdv:data-updated', { detail: { key } }));
}

function genId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

const PRODUCT_ACTIVE_MAP_KEY = 'pdv_product_active_map';

function getProductActiveMap(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(PRODUCT_ACTIVE_MAP_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function setProductActiveState(productId: string, isActive: boolean) {
  const map = getProductActiveMap();
  map[productId] = isActive;
  localStorage.setItem(PRODUCT_ACTIVE_MAP_KEY, JSON.stringify(map));
}

function removeProductActiveState(productId: string) {
  const map = getProductActiveMap();
  delete map[productId];
  localStorage.setItem(PRODUCT_ACTIVE_MAP_KEY, JSON.stringify(map));
}

// ---- Produtos ----
export function getProducts(): Product[] {
  const products = get<Product>('pdv_products');
  const activeMap = getProductActiveMap();

  return products.map((p) => {
    const fromMap = activeMap[p.id];
    const derivedIsActive = fromMap ?? p.isActive ?? (p.status ? p.status !== 'inactive' : true);
    return {
      ...p,
      isActive: derivedIsActive,
      status: derivedIsActive ? 'active' : 'inactive',
    };
  });
}
export function saveProduct(p: Omit<Product, 'id' | 'createdAt'>): Product {
  const products = getProducts();
  const isActive = p.isActive ?? (p.status ? p.status !== 'inactive' : true);
  const product: Product = {
    ...p,
    isActive,
    status: isActive ? 'active' : 'inactive',
    id: genId(),
    createdAt: new Date().toISOString()
  };
  products.push(product);
  set('pdv_products', products);
  setProductActiveState(product.id, isActive);
  emitDataUpdated('pdv_products');
  saveProductToSupabase(product).catch(err => console.error('[Sync] saveProduct:', err));
  return product;
}
export function updateProduct(id: string, updates: Partial<Product>) {
  const products = getProducts().map(p => {
    if (p.id !== id) return p;
    const merged = { ...p, ...updates };
    const isActive = updates.isActive ?? (updates.status ? updates.status !== 'inactive' : (merged.isActive ?? true));
    return {
      ...merged,
      isActive,
      status: isActive ? 'active' : 'inactive',
    };
  });
  set('pdv_products', products);
  const updated = products.find(p => p.id === id);
  if (updated) {
    setProductActiveState(id, updated.isActive !== false);
  }
  emitDataUpdated('pdv_products');
  updateProductInSupabase(id, updates).catch(err => console.error('[Sync] updateProduct:', err));
}
export function deleteProduct(id: string) {
  set('pdv_products', getProducts().filter(p => p.id !== id));
  removeProductActiveState(id);
  emitDataUpdated('pdv_products');
  deleteProductFromSupabase(id).catch(err => console.error('[Sync] deleteProduct:', err));
}

// ---- Vendas ----
export function getSales(): Sale[] { return get<Sale>('pdv_sales'); }
export function saveSale(s: Omit<Sale, 'id' | 'createdAt'> & { createdAt?: string }): Sale {
  const sales = getSales();
  const sale: Sale = { ...s, id: genId(), createdAt: s.createdAt || new Date().toISOString() };
  sales.push(sale);
  set('pdv_sales', sales);
  // Baixa de estoque
  if (!s.isDebtPayment) {
    s.items.forEach(item => {
      const products = getProducts();
      const product = products.find(p => p.id === item.productId);
      if (product) {
        updateProduct(product.id, { stock: Math.max(0, product.stock - item.quantity) });
      }
    });
  }
  saveSaleToSupabase(sale).catch(err => console.error('[Sync] saveSale:', err));
  return sale;
}

export function deleteSale(saleId: string): boolean {
  const sales = getSales();
  const sale = sales.find(s => s.id === saleId);
  if (!sale) return false;

  // Reverte estoque baseado na versão efetiva mais recente da venda.
  if (!sale.isDebtPayment) {
    const effectiveItems = getLatestSaleItems(sale);
    effectiveItems.forEach(item => {
      const product = getProducts().find(p => p.id === item.productId);
      if (product) {
        updateProduct(product.id, { stock: product.stock + item.quantity });
      }
    });
  }

  set('pdv_sales', sales.filter(s => s.id !== saleId));
  emitDataUpdated('pdv_sales');

  const adjustments = getSaleAdjustments();
  const hasAdjustments = adjustments.some(a => a.saleId === saleId);
  if (hasAdjustments) {
    set('pdv_sale_adjustments', adjustments.filter(a => a.saleId !== saleId));
    emitDataUpdated('pdv_sale_adjustments');
  }

  emitDataUpdated('pdv_products');
  emitDataUpdated('pdv_cash_registers');
  return true;
}

// ---- Clientes ----
export function getCustomers(): Customer[] {
  return get<Customer>('pdv_customers')
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
}
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

  // Registra o recebimento na lista de vendas do dia para o caixa bater.
  const customer = getCustomers().find(c => c.id === dp.customerId);
  const paymentMethod = dp.paymentMethod || 'dinheiro';
  saveSale({
    items: [],
    total: dp.amount,
    payments: [{ method: paymentMethod, amount: dp.amount }],
    paymentMethod,
    customerId: dp.customerId,
    customerName: customer?.name,
    fiadoAmount: 0,
    isDebtPayment: true,
    createdAt: payment.createdAt,
  });

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

/** Get effective payments for a sale considering latest adjustment */
export function getEffectiveSalePayments(sale: Sale): PaymentEntry[] {
  const basePayments = sale.payments?.length
    ? sale.payments
    : [{ method: sale.paymentMethod, amount: sale.total }];

  const adjustments = getAdjustmentsForSale(sale.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (adjustments.length === 0) return basePayments;

  const latest = adjustments[0];
  const adjustedTotal = latest.payments.reduce((acc, p) => acc + p.amount, 0);

  // Formato novo: payments do ajuste representam o pagamento final da venda.
  if (Math.abs(adjustedTotal - latest.newTotal) < 0.01) {
    return latest.payments;
  }

  // Formato legado: fallback para pagamentos originais.
  return basePayments;
}

function getBaseFiadoAmount(sale: Sale): number {
  if (sale.fiadoAmount != null) return sale.fiadoAmount;
  if (sale.payments?.length) {
    return sale.payments
      .filter(p => p.method === 'fiado')
      .reduce((acc, p) => acc + p.amount, 0);
  }
  if (sale.paymentMethod === 'fiado') return sale.total;
  return 0;
}

function getEffectiveFiadoAmount(sale: Sale): number {
  const baseFiado = getBaseFiadoAmount(sale);
  const adjustments = getAdjustmentsForSale(sale.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (adjustments.length === 0) return baseFiado;

  const latest = adjustments[0];
  const adjustmentTotal = latest.payments.reduce((acc, p) => acc + p.amount, 0);
  const adjustmentFiado = latest.payments
    .filter(p => p.method === 'fiado')
    .reduce((acc, p) => acc + p.amount, 0);

  // Novo formato: payments representa o total final da venda ajustada.
  if (Math.abs(adjustmentTotal - latest.newTotal) < 0.01) {
    return adjustmentFiado;
  }

  // Formato legado: payments representa apenas a diferença do ajuste.
  const deltaFiado = latest.payments.reduce((acc, p) => {
    if (p.method === 'fiado') return acc + p.amount;
    return acc - p.amount;
  }, 0);

  return Math.max(0, +(baseFiado + deltaFiado).toFixed(2));
}

// ---- Utilitários de relatório ----
export function getCustomerDebt(customerId: string): number {
  const sales = getSales().filter(s => s.customerId === customerId && !s.isDebtPayment);
  const totalFiado = sales.reduce((acc, s) => acc + getEffectiveFiadoAmount(s), 0);
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
  emitDataUpdated('pdv_cash_registers');
  openCashRegisterInSupabase(register.openingAmount, register.id).catch(err => console.error('[Sync] openCashRegister:', err));
  return register;
}

export function closeCashRegister(closingAmount: number): CashRegister {
  const register = getOpenCashRegister();
  if (!register) throw new Error('Nenhum caixa aberto');

  // Calculate totals from sales made during this register session
  const sales = getSales().filter(s => {
    const d = new Date(s.createdAt);
    return d >= new Date(register.openedAt);
  }).filter(s => getEffectiveSaleTotal(s) > 0.01);

  let totalDinheiro = 0, totalPix = 0, totalCartao = 0, totalFiado = 0;
  sales.forEach(s => {
    getEffectiveSalePayments(s).forEach(p => {
      if (p.method === 'dinheiro') totalDinheiro += p.amount;
      else if (p.method === 'pix') totalPix += p.amount;
      else if (p.method === 'cartao_credito' || p.method === 'cartao_debito') totalCartao += p.amount;
      else if (p.method === 'fiado') totalFiado += p.amount;
    });
  });

  const totalSales = sales.filter(s => !s.isDebtPayment).reduce((a, s) => a + getEffectiveSaleTotal(s), 0);
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
    salesCount: sales.filter(s => !s.isDebtPayment).length,
    status: 'closed',
  };

  const registers = getCashRegisters().map(r => r.id === register.id ? updated : r);
  set('pdv_cash_registers', registers);
  localStorage.setItem('pdv_cash_just_closed_at', Date.now().toString());
  emitDataUpdated('pdv_cash_registers');
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

  const sales = getSales()
    .filter(s => new Date(s.createdAt) >= new Date(register.openedAt))
    .filter(s => getEffectiveSaleTotal(s) > 0.01);
  let totalDinheiro = 0, totalPix = 0, totalCartao = 0, totalFiado = 0;
  sales.forEach(s => {
    getEffectiveSalePayments(s).forEach(p => {
      if (p.method === 'dinheiro') totalDinheiro += p.amount;
      else if (p.method === 'pix') totalPix += p.amount;
      else if (p.method === 'cartao_credito' || p.method === 'cartao_debito') totalCartao += p.amount;
      else if (p.method === 'fiado') totalFiado += p.amount;
    });
  });

  const totalSales = sales.filter(s => !s.isDebtPayment).reduce((a, s) => a + getEffectiveSaleTotal(s), 0);
  return {
    register,
    totalSales,
    totalDinheiro,
    totalPix,
    totalCartao,
    totalFiado,
    salesCount: sales.filter(s => !s.isDebtPayment).length,
  };
}
