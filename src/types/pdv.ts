// Tipos do sistema PDV

export type PaymentMethod = 'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito' | 'fiado';
export type ProductUnit = 'un' | 'kg' | 'lt';

export interface Product {
  id: string;
  code: string;
  barcode?: string;
  name: string;
  price: number;
  cost: number;
  stock: number;
  unit: ProductUnit;
  minStock: number;
  expiryDate?: string;
  createdAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  discount: number; // percentage 0-100
  subtotal: number;
}

export interface PaymentEntry {
  method: PaymentMethod;
  amount: number;
}

export interface Sale {
  id: string;
  items: { productId: string; productName: string; quantity: number; unitPrice: number; subtotal: number }[];
  total: number;
  payments: PaymentEntry[];
  /** @deprecated use payments array */
  paymentMethod: PaymentMethod;
  customerId?: string;
  customerName?: string;
  fiadoAmount?: number;
  createdAt: string;
}

export type CustomerStatus = 'active' | 'blocked';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  cpf?: string;
  notes?: string;
  creditLimit?: number;
  monthlyLimit?: number;
  status: CustomerStatus;
  createdAt: string;
}

export interface DebtPayment {
  id: string;
  customerId: string;
  amount: number;
  paymentMethod?: PaymentMethod;
  createdAt: string;
}

export interface StockEntry {
  id: string;
  productId: string;
  quantity: number;
  createdAt: string;
}

export interface SaleAdjustment {
  id: string;
  saleId: string;
  items: { productId: string; productName: string; quantity: number; unitPrice: number; subtotal: number }[];
  previousTotal: number;
  newTotal: number;
  difference: number;
  payments: PaymentEntry[];
  reason: string;
  createdAt: string;
}

export interface CashRegister {
  id: string;
  openedAt: string;
  closedAt?: string;
  openingAmount: number;
  closingAmount?: number;
  expectedAmount?: number;
  difference?: number;
  totalSales: number;
  totalDinheiro: number;
  totalPix: number;
  totalCartao: number;
  totalFiado: number;
  salesCount: number;
  status: 'open' | 'closed';
}
