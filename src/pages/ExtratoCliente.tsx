import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, ArrowDownCircle, ArrowUpCircle, Filter, X, Search, Eye, EyeOff } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Customer, Sale } from '@/types/pdv';
import { getCustomers, getSales, getDebtPayments, getSaleAdjustments, getCustomerDebt, getLatestSaleItems, getEffectiveSalePayments, getEffectiveSaleTotal } from '@/lib/store';
import { formatCurrency, formatDate, formatDateTime, paymentMethodLabels } from '@/lib/format';
import PlanGate from '@/components/PlanGate';

export default function ExtratoClientePage() {
  return (
    <PlanGate feature="extrato">
      <ExtratoContent />
    </PlanGate>
  );
}

interface Transaction {
  id: string;
  date: string;
  type: 'compra' | 'pagamento' | 'ajuste';
  description: string;
  debit: number;
  credit: number;
  balance: number;
  saleId?: string;
}

type PeriodFilter = 'all' | 'today' | 'week' | 'month';
type TypeFilter = 'all' | 'compra' | 'pagamento' | 'ajuste';

function ExtratoContent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedId = searchParams.get('id');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedId, setSelectedId] = useState<string>(preselectedId || '');
  const [customerSearch, setCustomerSearch] = useState('');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [hideValues, setHideValues] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const mask = (val: string) => hideValues ? '••••' : val;

  useEffect(() => { setCustomers(getCustomers()); }, []);

  const selectedCustomer = customers.find(c => c.id === selectedId);

  const transactions = useMemo((): Transaction[] => {
    if (!selectedId) return [];
    const items: Omit<Transaction, 'balance'>[] = [];

    // Fiado sales
    const sales = getSales().filter(s => s.customerId === selectedId);
    sales.forEach(s => {
      const fiadoAmt = s.fiadoAmount ?? (s.paymentMethod === 'fiado' ? s.total : 0);
      if (fiadoAmt > 0) {
        const productNames = s.items.map(i => i.productName).join(', ');
        items.push({
          id: s.id,
          date: s.createdAt,
          type: 'compra',
          description: `Compra fiado: ${productNames}`,
          debit: fiadoAmt,
          credit: 0,
          saleId: s.id,
        });
      }
    });

    // Payments
    getDebtPayments().filter(p => p.customerId === selectedId).forEach(p => {
      items.push({
        id: p.id,
        date: p.createdAt,
        type: 'pagamento',
        description: 'Pagamento de dívida',
        debit: 0,
        credit: p.amount,
      });
    });

    // Adjustments
    getSaleAdjustments().forEach(adj => {
      const sale = sales.find(s => s.id === adj.saleId);
      if (!sale) return;
      if (adj.difference !== 0) {
        items.push({
          id: adj.id,
          date: adj.createdAt,
          type: 'ajuste',
          description: `Ajuste de venda (${adj.reason || 'sem motivo'})`,
          debit: adj.difference > 0 ? adj.difference : 0,
          credit: adj.difference < 0 ? Math.abs(adj.difference) : 0,
          saleId: sale.id,
        });
      }
    });

    // Sort by date ascending to calculate running balance
    items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let balance = 0;
    const result: Transaction[] = items.map(item => {
      balance += item.debit - item.credit;
      return { ...item, balance };
    });

    // Return newest first
    return result.reverse();
  }, [selectedId]);

  const filteredTransactions = useMemo(() => {
    let filtered = transactions;

    if (periodFilter !== 'all') {
      const now = new Date();
      let cutoff: Date;
      if (periodFilter === 'today') {
        cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (periodFilter === 'week') {
        cutoff = new Date(now.getTime() - 7 * 86400000);
      } else {
        cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
      }
      filtered = filtered.filter(t => new Date(t.date) >= cutoff);
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(t => t.type === typeFilter);
    }

    return filtered;
  }, [transactions, periodFilter, typeFilter]);

  const filteredCustomers = customerSearch.trim()
    ? customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase())).slice(0, 10)
    : [];

  const currentDebt = selectedId ? getCustomerDebt(selectedId) : 0;

  const typeLabels: Record<string, string> = { compra: 'Compra', pagamento: 'Pagamento', ajuste: 'Ajuste' };
  const typeColors: Record<string, string> = {
    compra: 'bg-destructive/10 text-destructive',
    pagamento: 'bg-success/10 text-success',
    ajuste: 'bg-warning/10 text-warning',
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/clientes')} className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-muted transition-all">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-bold">Extrato do Cliente</h2>
            <p className="text-sm text-muted-foreground">Histórico financeiro completo</p>
          </div>
        </div>
        <button
          onClick={() => setHideValues(v => !v)}
          className="w-10 h-10 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition-all active:scale-95"
          title={hideValues ? 'Mostrar valores' : 'Ocultar valores'}
        >
          {hideValues ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      {/* Customer selector */}
      {!selectedCustomer ? (
        <div className="card-pdv p-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              className="input-pdv pl-12"
              placeholder="Buscar cliente por nome..."
              value={customerSearch}
              onChange={e => setCustomerSearch(e.target.value)}
              autoFocus
            />
          </div>
          {filteredCustomers.length > 0 && (
            <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
              {filteredCustomers.map(c => {
                const debt = getCustomerDebt(c.id);
                return (
                  <button key={c.id} onClick={() => { setSelectedId(c.id); setCustomerSearch(''); }}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left">
                    <div>
                      <p className="font-medium">{c.name}</p>
                      {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                    </div>
                    <span className={`text-sm font-semibold tabular-nums ${debt > 0 ? 'text-destructive' : 'text-success'}`}>
                      {debt > 0 ? mask(formatCurrency(debt)) : 'Em dia'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {customerSearch.trim() && filteredCustomers.length === 0 && (
            <p className="text-center text-muted-foreground py-6">Nenhum cliente encontrado</p>
          )}
        </div>
      ) : (
        <>
          {/* Customer header */}
          <div className="card-pdv p-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold">{selectedCustomer.name}</h3>
              {selectedCustomer.phone && <p className="text-sm text-muted-foreground">{selectedCustomer.phone}</p>}
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Saldo Devedor</p>
              <p className={`text-xl font-extrabold tabular-nums ${currentDebt > 0 ? 'text-destructive' : 'text-success'}`}>
                  {currentDebt > 0 ? mask(formatCurrency(currentDebt)) : 'Em dia ✓'}
                </p>
              </div>
              <button onClick={() => setSelectedId('')} className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-muted transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <div className="flex gap-1">
              {([['all', 'Todos'], ['today', 'Hoje'], ['week', 'Semana'], ['month', 'Mês']] as [PeriodFilter, string][]).map(([key, label]) => (
                <button key={key} onClick={() => setPeriodFilter(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${periodFilter === key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                  {label}
                </button>
              ))}
            </div>
            <span className="text-muted-foreground">|</span>
            <div className="flex gap-1">
              {([['all', 'Todos'], ['compra', 'Compras'], ['pagamento', 'Pagamentos'], ['ajuste', 'Ajustes']] as [TypeFilter, string][]).map(([key, label]) => (
                <button key={key} onClick={() => setTypeFilter(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${typeFilter === key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Transaction list */}
          <div className="card-pdv overflow-hidden">
            {filteredTransactions.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">Nenhuma transação encontrada</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Data</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Tipo</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Descrição</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Valor</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredTransactions.map(t => (
                      <tr
                        key={t.id}
                        className={`hover:bg-muted/30 transition-colors ${t.saleId ? 'cursor-pointer' : ''}`}
                        onClick={() => {
                          if (!t.saleId) return;
                          const sale = getSales().find(s => s.id === t.saleId);
                          if (sale) setSelectedSale(sale);
                        }}
                        title={t.saleId ? 'Clique para ver detalhes da venda' : undefined}
                      >
                        <td className="px-4 py-3 tabular-nums whitespace-nowrap">{formatDate(t.date)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${typeColors[t.type]}`}>
                            {t.type === 'compra' ? <ArrowDownCircle className="w-3 h-3" /> : <ArrowUpCircle className="w-3 h-3" />}
                            {typeLabels[t.type]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{t.description}</td>
                        <td className={`px-4 py-3 text-right font-medium tabular-nums ${t.debit > 0 ? 'text-destructive' : 'text-success'}`}>
                          {t.debit > 0
                            ? mask(formatCurrency(t.debit))
                            : `-${mask(formatCurrency(t.credit))}`}
                        </td>
                        <td className={`px-4 py-3 text-right font-bold tabular-nums ${t.balance > 0 ? 'text-destructive' : 'text-success'}`}>
                          {mask(formatCurrency(t.balance))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </>
      )}

      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelectedSale(null)}>
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] overflow-y-auto animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-bold text-lg">Detalhes da Venda</h3>
              <button onClick={() => setSelectedSale(null)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-all active:scale-95">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="text-sm text-muted-foreground">
                {formatDateTime(selectedSale.createdAt)}
                {selectedSale.customerName && <span className="ml-2 font-medium text-foreground">• {selectedSale.customerName}</span>}
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Itens</p>
                {getLatestSaleItems(selectedSale).map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 text-sm">
                    <span>{item.quantity}x {item.productName}</span>
                    <span className="font-medium tabular-nums">{formatCurrency(item.subtotal)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pagamento</p>
                {getEffectiveSalePayments(selectedSale).map((p, idx) => (
                  <div key={`${p.method}-${idx}`} className="flex items-center justify-between py-1.5 text-sm">
                    <span>{paymentMethodLabels[p.method]}</span>
                    <span className="font-medium tabular-nums">{formatCurrency(p.amount)}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="font-semibold">Total</span>
                <span className="text-xl font-extrabold tabular-nums">{formatCurrency(getEffectiveSaleTotal(selectedSale))}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
