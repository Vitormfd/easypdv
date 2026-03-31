import { formatCurrency } from './format';
import { getSales } from './store';

export function getDaysSinceLastPurchase(customerId: string): number | null {
  const sales = getSales()
    .filter(s => s.customerId === customerId && s.paymentMethod === 'fiado')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  if (sales.length === 0) return null;
  const last = new Date(sales[0].createdAt);
  const now = new Date();
  return Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
}

export function generateDebtMessage(name: string, debt: number, customerId?: string): string {
  let daysText = '';
  if (customerId) {
    const days = getDaysSinceLastPurchase(customerId);
    if (days !== null && days > 0) {
      daysText = `\nJá faz ${days} ${days === 1 ? 'dia' : 'dias'} desde a última compra.`;
    }
  }
  return `Olá, ${name}! Tudo bem? 😊\nNotamos que você possui um valor em aberto de ${formatCurrency(debt)} aqui no Supermercado Compre Aqui.${daysText}\nQuando puder, passe aqui para acertarmos. Obrigado!`;
}

export function openWhatsApp(phone: string, message: string) {
  const cleanPhone = phone.replace(/\D/g, '');
  const fullPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
  const encoded = encodeURIComponent(message);
  window.open(`https://wa.me/${fullPhone}?text=${encoded}`, '_blank');
}

// Smart collection: identify clients needing follow-up
export interface CollectionFlag {
  customerId: string;
  reason: 'overdue' | 'high_value' | 'both';
  daysSince: number | null;
  debt: number;
}

export function getCollectionThresholds(): { days: number; amount: number } {
  try {
    const data = localStorage.getItem('pdv_collection_thresholds');
    return data ? JSON.parse(data) : { days: 7, amount: 100 };
  } catch { return { days: 7, amount: 100 }; }
}

export function setCollectionThresholds(days: number, amount: number) {
  localStorage.setItem('pdv_collection_thresholds', JSON.stringify({ days, amount }));
}
