import { utils, writeFile } from 'xlsx';

export type PlanId = 'basico' | 'completo' | 'pro';

export interface Plan {
  id: PlanId;
  name: string;
  price: number;
  badge: string;
  features: string[];
  blocked: string[];
}

export const plans: Plan[] = [
  {
    id: 'basico',
    name: 'Básico',
    price: 29,
    badge: '🥉',
    features: [
      'Controle de caixa',
      'Cadastro de clientes',
      'Controle de fiado',
      'Registro de pagamentos',
      'Saldo devedor por cliente',
    ],
    blocked: [
      'whatsapp',
      'debtHighlight',
      'relatorios',
      'extrato',
      'ranking',
    ],
  },
  {
    id: 'completo',
    name: 'Completo',
    price: 49,
    badge: '🥈',
    features: [
      'Tudo do plano Básico',
      'Envio de cobrança via WhatsApp',
      'Lista de devedores com destaque',
      'Relatórios completos',
      'Extrato detalhado por cliente',
      'Ranking de produtos',
    ],
    blocked: [],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 79,
    badge: '🥇',
    features: [
      'Tudo do plano Completo',
      'Backup automático ao fechar caixa',
      'Relatório mensal automático',
      'Envio de relatório via WhatsApp',
    ],
    blocked: [],
  },
];

// Features that require specific plans
type Feature = 'whatsapp' | 'debtHighlight' | 'relatorios' | 'extrato' | 'ranking' | 'backup' | 'monthlyReport';

const featureMinPlan: Record<Feature, PlanId> = {
  whatsapp: 'completo',
  debtHighlight: 'completo',
  relatorios: 'completo',
  extrato: 'completo',
  ranking: 'completo',
  backup: 'pro',
  monthlyReport: 'pro',
};

const planLevel: Record<PlanId, number> = { basico: 0, completo: 1, pro: 2 };

export function getCurrentPlan(): PlanId {
  const stored = localStorage.getItem('pdv_plan');
  if (stored === 'basico' || stored === 'completo' || stored === 'pro') return stored;
  return 'basico';
}

export function setCurrentPlan(plan: PlanId) {
  localStorage.setItem('pdv_plan', plan);
}

export function canAccess(feature: Feature): boolean {
  const current = getCurrentPlan();
  const required = featureMinPlan[feature];
  if (!required) return true;
  return planLevel[current] >= planLevel[required];
}

export function getRequiredPlan(feature: Feature): Plan {
  const required = featureMinPlan[feature];
  return plans.find(p => p.id === required)!;
}

export function getPlanInfo(id: PlanId): Plan {
  return plans.find(p => p.id === id)!;
}

// Backup: export sales and cash register data as Excel
export function downloadBackup() {
  const sales = JSON.parse(localStorage.getItem('pdv_sales') || '[]');
  const registers = JSON.parse(localStorage.getItem('pdv_cash_registers') || '[]');

  const salesRows = sales
    .filter((s: any) => !s.items?.every((i: any) => i.productId === 'import'))
    .map((s: any, idx: number) => ({
      '#': idx + 1,
      'Data': new Date(s.createdAt).toLocaleString('pt-BR'),
      'Cliente': s.customerName || '—',
      'Produtos': s.items?.map((i: any) => `${i.productName} x${i.quantity}`).join(', ') || '',
      'Total': s.total,
      'Pagamento': s.payments?.map((p: any) => `${p.method}: R$${p.amount.toFixed(2)}`).join(', ') || s.paymentMethod || '',
      'Fiado': s.fiadoAmount || 0,
    }));

  const regRows = registers.map((r: any) => ({
    'Abertura': new Date(r.openedAt).toLocaleString('pt-BR'),
    'Fechamento': r.closedAt ? new Date(r.closedAt).toLocaleString('pt-BR') : 'Aberto',
    'Valor Inicial': r.openingAmount,
    'Valor Final': r.closingAmount ?? '',
    'Total Vendas': r.totalSales,
    'Dinheiro': r.totalDinheiro,
    'PIX': r.totalPix,
    'Cartão': r.totalCartao,
    'Fiado': r.totalFiado,
    'Diferença': r.difference ?? '',
    'Qtd Vendas': r.salesCount,
  }));

  const wb = utils.book_new();
  const wsSales = utils.json_to_sheet(salesRows);
  const wsReg = utils.json_to_sheet(regRows);

  wsSales['!cols'] = [{ wch: 5 }, { wch: 18 }, { wch: 20 }, { wch: 40 }, { wch: 12 }, { wch: 30 }, { wch: 12 }];
  wsReg['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }];

  utils.book_append_sheet(wb, wsSales, 'Vendas');
  utils.book_append_sheet(wb, wsReg, 'Caixas');

  const date = new Date().toISOString().slice(0, 10);
  writeFile(wb, `backup_pdv_${date}.xlsx`);
}

// Backup de um caixa específico
export function downloadRegisterBackup(register: import('@/types/pdv').CashRegister) {
  const allSales = JSON.parse(localStorage.getItem('pdv_sales') || '[]');
  const openedAt = new Date(register.openedAt);
  const closedAt = register.closedAt ? new Date(register.closedAt) : new Date();

  const sales = allSales.filter((s: any) => {
    const d = new Date(s.createdAt);
    return d >= openedAt && d <= closedAt && !s.items?.every((i: any) => i.productId === 'import');
  });

  const salesRows = sales.map((s: any, idx: number) => ({
    '#': idx + 1,
    'Data': new Date(s.createdAt).toLocaleString('pt-BR'),
    'Cliente': s.customerName || '—',
    'Produtos': s.items?.map((i: any) => `${i.productName} x${i.quantity}`).join(', ') || '',
    'Total': s.total,
    'Pagamento': s.payments?.map((p: any) => `${p.method}: R$${p.amount.toFixed(2)}`).join(', ') || s.paymentMethod || '',
    'Fiado': s.fiadoAmount || 0,
  }));

  const regRow = [{
    'Abertura': new Date(register.openedAt).toLocaleString('pt-BR'),
    'Fechamento': register.closedAt ? new Date(register.closedAt).toLocaleString('pt-BR') : 'Aberto',
    'Valor Inicial': register.openingAmount,
    'Valor Final': register.closingAmount ?? '',
    'Total Vendas': register.totalSales,
    'Dinheiro': register.totalDinheiro,
    'PIX': register.totalPix,
    'Cartão': register.totalCartao,
    'Fiado': register.totalFiado,
    'Diferença': register.difference ?? '',
    'Qtd Vendas': register.salesCount,
  }];

  const wb = utils.book_new();
  const wsSales = utils.json_to_sheet(salesRows);
  const wsReg = utils.json_to_sheet(regRow);

  wsSales['!cols'] = [{ wch: 5 }, { wch: 18 }, { wch: 20 }, { wch: 40 }, { wch: 12 }, { wch: 30 }, { wch: 12 }];
  wsReg['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }];

  utils.book_append_sheet(wb, wsSales, 'Vendas');
  utils.book_append_sheet(wb, wsReg, 'Resumo Caixa');

  const dateStr = new Date(register.openedAt).toISOString().slice(0, 10);
  writeFile(wb, `backup_caixa_${dateStr}.xlsx`);
}

// Monthly report summary
export function generateMonthlyReport(): { month: string; totalSales: number; totalRevenue: number; topProducts: { name: string; qty: number }[] } {
  const salesRaw = JSON.parse(localStorage.getItem('pdv_sales') || '[]');
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthSales = salesRaw.filter((s: any) => new Date(s.createdAt) >= monthStart);
  
  const productCount: Record<string, { name: string; qty: number }> = {};
  monthSales.forEach((s: any) => {
    s.items.forEach((i: any) => {
      if (!productCount[i.productId]) productCount[i.productId] = { name: i.productName, qty: 0 };
      productCount[i.productId].qty += i.quantity;
    });
  });

  const topProducts = Object.values(productCount).sort((a, b) => b.qty - a.qty).slice(0, 5);

  return {
    month: `${now.getMonth() + 1}/${now.getFullYear()}`,
    totalSales: monthSales.length,
    totalRevenue: monthSales.reduce((a: number, s: any) => a + s.total, 0),
    topProducts,
  };
}
