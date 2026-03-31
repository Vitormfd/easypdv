import type { Product } from '@/types/pdv';
import { getSales } from './store';

export interface RestockSuggestion {
  product: Product;
  avgDailySales: number;
  daysUntilOut: number;
  suggestedQty: number;
  critical: boolean;
}

export function getRestockSuggestions(products: Product[]): RestockSuggestion[] {
  const sales = getSales();
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  // Calcula média de vendas por dia nos últimos 30 dias
  const recentSales = sales.filter(s => new Date(s.createdAt).getTime() >= thirtyDaysAgo);

  const productSalesMap: Record<string, number> = {};
  recentSales.forEach(s => {
    s.items.forEach(item => {
      productSalesMap[item.productId] = (productSalesMap[item.productId] || 0) + item.quantity;
    });
  });

  const daysCovered = Math.max(1, Math.ceil((now - thirtyDaysAgo) / (24 * 60 * 60 * 1000)));

  return products
    .map(product => {
      const totalSold = productSalesMap[product.id] || 0;
      const avgDailySales = totalSold / daysCovered;
      const daysUntilOut = avgDailySales > 0 ? Math.floor(product.stock / avgDailySales) : 999;
      // Sugere compra para 15 dias
      const suggestedQty = Math.max(0, Math.ceil(avgDailySales * 15) - product.stock);
      const critical = daysUntilOut <= 3;

      return { product, avgDailySales, daysUntilOut, suggestedQty, critical };
    })
    .filter(s => s.daysUntilOut <= 14 || s.product.stock <= s.product.minStock)
    .sort((a, b) => a.daysUntilOut - b.daysUntilOut);
}

// Lista de itens marcados como "comprados"
export function getPurchasedItems(): string[] {
  try {
    return JSON.parse(localStorage.getItem('pdv_purchased_items') || '[]');
  } catch { return []; }
}

export function togglePurchased(productId: string) {
  const items = getPurchasedItems();
  const idx = items.indexOf(productId);
  if (idx >= 0) items.splice(idx, 1);
  else items.push(productId);
  localStorage.setItem('pdv_purchased_items', JSON.stringify(items));
}

export function clearPurchased() {
  localStorage.removeItem('pdv_purchased_items');
}
