import type { Customer } from '@/types/pdv';
import { getSales, getCustomerDebt } from './store';

/** Get total fiado purchases for a customer in the current month */
export function getMonthlyFiadoTotal(customerId: string): number {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sales = getSales().filter(s => {
    if (s.customerId !== customerId) return false;
    const d = new Date(s.createdAt);
    if (d < monthStart) return false;
    return (s.fiadoAmount != null && s.fiadoAmount > 0) || s.paymentMethod === 'fiado';
  });
  return sales.reduce((acc, s) => {
    if (s.fiadoAmount != null) return acc + s.fiadoAmount;
    return acc + s.total;
  }, 0);
}

export interface CreditValidation {
  allowed: boolean;
  reasons: string[];
  currentDebt: number;
  creditLimit: number | null;
  monthlyTotal: number;
  monthlyLimit: number | null;
  remainingCredit: number | null;
  remainingMonthly: number | null;
}

/** Validate if a fiado sale is allowed for the given customer and amount */
export function validateFiadoSale(customer: Customer, fiadoAmount: number): CreditValidation {
  const currentDebt = getCustomerDebt(customer.id);
  const monthlyTotal = getMonthlyFiadoTotal(customer.id);
  const reasons: string[] = [];

  if (customer.status === 'blocked') {
    reasons.push('Cliente está bloqueado');
  }

  const creditLimit = customer.creditLimit ?? null;
  const monthlyLimit = customer.monthlyLimit ?? null;
  let remainingCredit: number | null = null;
  let remainingMonthly: number | null = null;

  if (creditLimit !== null && creditLimit > 0) {
    remainingCredit = Math.max(0, creditLimit - currentDebt);
    if (currentDebt + fiadoAmount > creditLimit) {
      reasons.push(`Ultrapassa limite de crédito (${formatBRL(creditLimit)}). Dívida atual: ${formatBRL(currentDebt)}`);
    }
  }

  if (monthlyLimit !== null && monthlyLimit > 0) {
    remainingMonthly = Math.max(0, monthlyLimit - monthlyTotal);
    if (monthlyTotal + fiadoAmount > monthlyLimit) {
      reasons.push(`Ultrapassa limite mensal (${formatBRL(monthlyLimit)}). Gasto este mês: ${formatBRL(monthlyTotal)}`);
    }
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    currentDebt,
    creditLimit,
    monthlyTotal,
    monthlyLimit,
    remainingCredit,
    remainingMonthly,
  };
}

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Get credit status color for a customer */
export function getCreditStatusColor(customer: Customer): 'green' | 'yellow' | 'red' {
  if (customer.status === 'blocked') return 'red';
  const debt = getCustomerDebt(customer.id);
  const limit = customer.creditLimit;
  if (!limit || limit <= 0) return debt > 0 ? 'yellow' : 'green';
  const ratio = debt / limit;
  if (ratio >= 1) return 'red';
  if (ratio >= 0.7) return 'yellow';
  return 'green';
}
