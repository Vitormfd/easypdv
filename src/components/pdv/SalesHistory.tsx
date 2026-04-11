import { useState, useMemo, useRef, useEffect } from 'react';
import { Eye, X, Clock, Receipt, Pencil, Search, Filter, RotateCcw, Printer } from 'lucide-react';
import type { Sale, PaymentMethod } from '@/types/pdv';
import { getSales, getAdjustmentsForSale, getEffectiveSalePayments, getEffectiveSaleTotal, getOpenCashRegister } from '@/lib/store';
import { formatCurrency, paymentMethodLabels } from '@/lib/format';
import SaleEditDialog from './SaleEditDialog';
import ReceiptPrint, { printReceipt } from './ReceiptPrint';

type PayFilter = 'todas' | 'finalizadas' | 'fiado' | 'pix' | 'dinheiro' | 'cartao';

const filterTabs: { key: PayFilter; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'finalizadas', label: 'Finalizadas' },
  { key: 'fiado', label: 'Fiado' },
  { key: 'pix', label: 'PIX' },
  { key: 'dinheiro', label: 'Dinheiro' },
  { key: 'cartao', label: 'Cartão' },
];

function paymentColor(method: PaymentMethod): string {
  switch (method) {
    case 'dinheiro': return 'bg-success/15 text-success';
    case 'pix': return 'bg-accent/15 text-accent';
    case 'fiado': return 'bg-warning/15 text-warning';
    case 'cartao_credito':
    case 'cartao_debito': return 'bg-muted text-foreground';
    default: return 'bg-muted text-muted-foreground';
  }
}

function getPrimaryMethod(sale: Sale): PaymentMethod {
  const payments = getEffectiveSalePayments(sale);
  return payments.reduce((a, b) => a.amount >= b.amount ? a : b).method;
}

function hasFiado(sale: Sale): boolean {
  return getEffectiveSalePayments(sale).some(p => p.method === 'fiado');
}

function isDebtPaymentSale(sale: Sale): boolean {
  return !!sale.isDebtPayment || (sale.items?.length === 0 && !!sale.customerId && sale.total > 0);
}

interface Props {
  refreshKey: number;
}

export default function SalesHistory({ refreshKey }: Props) {
  const [filter, setFilter] = useState<PayFilter>('todas');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [localRefresh, setLocalRefresh] = useState(0);
  const [printingSale, setPrintingSale] = useState<Sale | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [minValue, setMinValue] = useState('');
  const [maxValue, setMaxValue] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  useEffect(() => {
    const handleDataUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ key?: string }>;
      const key = customEvent.detail?.key;
      if (key === 'pdv_sales' || key === 'pdv_sale_adjustments' || key === 'pdv_cash_registers') {
        setLocalRefresh(k => k + 1);
      }
    };

    window.addEventListener('pdv:data-updated', handleDataUpdated as EventListener);
    return () => window.removeEventListener('pdv:data-updated', handleDataUpdated as EventListener);
  }, []);

  const openRegisterOpenedAt = getOpenCashRegister()?.openedAt;

  const todaySales = useMemo(() => {
    const allSales = getSales();
    const start = openRegisterOpenedAt ? new Date(openRegisterOpenedAt) : (() => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today;
    })();

    return allSales
      .filter(s => new Date(s.createdAt) >= start)
      .filter(s => !s.items.some(item => item.productId === 'import'))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, localRefresh, openRegisterOpenedAt]);

  const filtered = useMemo(() => {
    let result = todaySales;

    // Payment filter
    if (filter === 'finalizadas') result = result.filter(s => !hasFiado(s));
    else if (filter === 'fiado') result = result.filter(s => hasFiado(s));
    else if (filter === 'cartao') result = result.filter(s => {
      return getEffectiveSalePayments(s).some(p => p.method === 'cartao_credito' || p.method === 'cartao_debito');
    });
    else if (filter !== 'todas') result = result.filter(s => {
      return getEffectiveSalePayments(s).some(p => p.method === filter);
    });

    // Customer search
    if (customerSearch.trim()) {
      const q = customerSearch.toLowerCase();
      result = result.filter(s => s.customerName?.toLowerCase().includes(q));
    }

    // Value range
    const min = parseFloat(minValue);
    const max = parseFloat(maxValue);
    if (!isNaN(min) && min > 0) result = result.filter(s => s.total >= min);
    if (!isNaN(max) && max > 0) result = result.filter(s => s.total <= max);

    return result;
  }, [todaySales, filter, customerSearch, minValue, maxValue]);

  const hasActiveFilters = filter !== 'todas' || customerSearch.trim() || minValue || maxValue;

  const clearFilters = () => {
    setFilter('todas');
    setCustomerSearch('');
    setMinValue('');
    setMaxValue('');
  };

  const daySummary = useMemo(() => {
    const totalSold = todaySales.reduce((a, s) => a + (isDebtPaymentSale(s) ? 0 : s.total), 0);
    const totalFiado = todaySales.reduce((a, s) => {
      if (isDebtPaymentSale(s)) return a;
      return a + getEffectiveSalePayments(s)
        .filter(p => p.method === 'fiado')
        .reduce((acc, p) => acc + p.amount, 0);
    }, 0);
    return { totalSold, count: todaySales.length, totalFiado };
  }, [todaySales]);

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Header + Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-primary" />
          <h3 className="text-base font-bold">Vendas do Dia</h3>
          <span className="text-xs text-muted-foreground">({daySummary.count})</span>
        </div>
        <div className="flex items-center gap-3 text-sm tabular-nums">
          <span className="font-semibold text-foreground">Total: {formatCurrency(daySummary.totalSold)}</span>
          {daySummary.totalFiado > 0 && (
            <span className="text-warning font-semibold">Fiado: {formatCurrency(daySummary.totalFiado)}</span>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1.5 overflow-x-auto pb-1 flex-1">
            {filterTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all active:scale-95 ${
                  filter === tab.key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button onClick={() => setShowAdvanced(!showAdvanced)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${showAdvanced ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
            <Filter className="w-3 h-3" /> Filtros
          </button>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-destructive hover:bg-destructive/10 transition-all">
              <RotateCcw className="w-3 h-3" /> Limpar
            </button>
          )}
        </div>

        {showAdvanced && (
          <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-lg border border-border animate-fade-in">
            <div className="flex-1 min-w-[140px]">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Cliente</label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input className="w-full pl-7 pr-2 py-1.5 text-xs rounded-md border border-border bg-card" placeholder="Buscar..."
                  value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} />
              </div>
            </div>
            <div className="min-w-[100px]">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Valor mín</label>
              <input className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-card tabular-nums" type="number" placeholder="R$ 0"
                value={minValue} onChange={e => setMinValue(e.target.value)} min={0} step={10} />
            </div>
            <div className="min-w-[100px]">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Valor máx</label>
              <input className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-card tabular-nums" type="number" placeholder="R$ ∞"
                value={maxValue} onChange={e => setMaxValue(e.target.value)} min={0} step={10} />
            </div>
          </div>
        )}

        {hasActiveFilters && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>Filtrado: <strong className="text-foreground">{filtered.length}</strong> vendas • {formatCurrency(filtered.reduce((a, s) => a + s.total, 0))}</span>
          </div>
        )}
      </div>

      {/* Sales Table */}
      {filtered.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground text-sm">
          Nenhuma venda encontrada
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">#</th>
                <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Hora</th>
                <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Cliente</th>
                <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Valor</th>
                <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Pagamento</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((sale, idx) => {
                const primary = getPrimaryMethod(sale);
                const time = new Date(sale.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const adjustments = getAdjustmentsForSale(sale.id);
                const isAdjusted = adjustments.length > 0;
                const isDebtPayment = isDebtPaymentSale(sale);
                const effectiveTotal = isAdjusted ? getEffectiveSaleTotal(sale) : sale.total;
                return (
                  <tr key={sale.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                      {filtered.length - idx}
                      {isDebtPayment && (
                        <span className="ml-1 text-[10px] bg-success/15 text-success px-1.5 py-0.5 rounded font-semibold">Recebimento</span>
                      )}
                      {isAdjusted && (
                        <span className="ml-1 text-[10px] bg-warning/15 text-warning px-1.5 py-0.5 rounded font-semibold">Ajustada</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        {time}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {sale.customerName || <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className={`px-3 py-2.5 text-right font-bold tabular-nums ${effectiveTotal >= 200 ? 'text-primary' : ''}`}>
                      {formatCurrency(effectiveTotal)}
                      {isAdjusted && effectiveTotal !== sale.total && (
                        <span className="block text-[10px] text-muted-foreground line-through">{formatCurrency(sale.total)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {isDebtPayment && (
                          <span className="inline-block px-2 py-0.5 rounded-md text-xs font-medium bg-success/15 text-success">
                            Recebimento
                          </span>
                        )}
                        {getEffectiveSalePayments(sale).map((p, paymentIndex) => (
                          <span key={`${p.method}-${paymentIndex}`} className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${paymentColor(p.method)}`}>
                            {paymentMethodLabels[p.method]}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setSelectedSale(sale)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all active:scale-95"
                          title="Ver detalhes"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingSale(sale)}
                          disabled={isDebtPayment}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all active:scale-95"
                          title="Editar / Ajustar"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { setPrintingSale(sale); setTimeout(() => printReceipt(receiptRef), 100); }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all active:scale-95"
                          title="Reimprimir"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Sale Detail Modal */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelectedSale(null)}>
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] overflow-y-auto animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-bold text-lg">{isDebtPaymentSale(selectedSale) ? 'Detalhes do Recebimento' : 'Detalhes da Venda'}</h3>
              <button onClick={() => setSelectedSale(null)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-all active:scale-95">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="text-sm text-muted-foreground">
                {new Date(selectedSale.createdAt).toLocaleString('pt-BR')}
                {selectedSale.customerName && <span className="ml-2 font-medium text-foreground">• {selectedSale.customerName}</span>}
              </div>

              {/* Products */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {isDebtPaymentSale(selectedSale) ? 'Origem' : 'Produtos'}
                </p>
                {isDebtPaymentSale(selectedSale) ? (
                  <div className="flex items-center justify-between py-1.5 text-sm">
                    <span>Recebimento de dívida (fiado)</span>
                    <span className="font-medium tabular-nums">{formatCurrency(selectedSale.total)}</span>
                  </div>
                ) : (
                  selectedSale.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 text-sm">
                      <span>{item.quantity}x {item.productName}</span>
                      <span className="font-medium tabular-nums">{formatCurrency(item.subtotal)}</span>
                    </div>
                  ))
                )}
              </div>

              {/* Payments */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pagamento</p>
                {getEffectiveSalePayments(selectedSale).map((p, paymentIndex) => (
                  <div key={`${p.method}-${paymentIndex}`} className="flex items-center justify-between py-1.5 text-sm">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${paymentColor(p.method)}`}>
                      {paymentMethodLabels[p.method]}
                    </span>
                    <span className="font-medium tabular-nums">{formatCurrency(p.amount)}</span>
                  </div>
                ))}
              </div>

              {/* Total */}
              {(() => {
                const adjTotal = getEffectiveSaleTotal(selectedSale);
                const isAdj = adjTotal !== selectedSale.total;
                return (
                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <span className="font-semibold">Total</span>
                    <div className="text-right">
                      <span className="text-xl font-extrabold tabular-nums">{formatCurrency(adjTotal)}</span>
                      {isAdj && <span className="block text-xs text-muted-foreground line-through">{formatCurrency(selectedSale.total)}</span>}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Sale Edit Dialog */}
      {editingSale && (
        <SaleEditDialog
          sale={editingSale}
          onClose={() => setEditingSale(null)}
          onSaved={() => setLocalRefresh(k => k + 1)}
        />
      )}

      {/* Receipt for printing */}
      {printingSale && <ReceiptPrint ref={receiptRef} sale={printingSale} />}
    </div>
  );
}
