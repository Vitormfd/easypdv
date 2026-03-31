import { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, Calendar, CheckCircle, Clock, Package } from 'lucide-react';
import type { Product } from '@/types/pdv';
import { getProducts } from '@/lib/store';
import { formatDate } from '@/lib/format';

interface ExpiryEntry {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  expiryDate: string;
  lot?: string;
  daysUntilExpiry: number;
  status: 'ok' | 'warning' | 'expired';
}

function getExpiryEntries(): ExpiryEntry[] {
  try {
    const data = localStorage.getItem('pdv_expiry_entries');
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

function saveExpiryEntries(entries: ExpiryEntry[]) {
  localStorage.setItem('pdv_expiry_entries', JSON.stringify(entries));
}

export default function ValidadePage() {
  const [entries, setEntries] = useState<ExpiryEntry[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ productId: '', quantity: 0, expiryDate: '', lot: '' });
  const [filter, setFilter] = useState<'all' | 'warning' | 'expired'>('all');

  const reload = () => {
    setEntries(getExpiryEntries());
    setProducts(getProducts());
  };
  useEffect(() => { reload(); }, []);

  const now = new Date();

  // Merge manual entries + products with expiryDate
  const allEntries = useMemo(() => {
    const manual = entries.map(e => {
      const expiry = new Date(e.expiryDate);
      const diffMs = expiry.getTime() - now.getTime();
      const daysUntilExpiry = Math.ceil(diffMs / 86400000);
      const status: ExpiryEntry['status'] = daysUntilExpiry <= 0 ? 'expired' : daysUntilExpiry <= 7 ? 'warning' : 'ok';
      return { ...e, daysUntilExpiry, status };
    });

    // Auto-generate entries from products with expiryDate
    const fromProducts = products
      .filter(p => p.expiryDate)
      .filter(p => !manual.some(e => e.productId === p.id && e.expiryDate === p.expiryDate))
      .map(p => {
        const expiry = new Date(p.expiryDate!);
        const diffMs = expiry.getTime() - now.getTime();
        const daysUntilExpiry = Math.ceil(diffMs / 86400000);
        const status: ExpiryEntry['status'] = daysUntilExpiry <= 0 ? 'expired' : daysUntilExpiry <= 7 ? 'warning' : 'ok';
        return {
          id: `auto-${p.id}`,
          productId: p.id,
          productName: p.name,
          quantity: p.stock,
          expiryDate: p.expiryDate!,
          daysUntilExpiry,
          status,
        } as ExpiryEntry;
      });

    return [...manual, ...fromProducts].sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  }, [entries, products]);

  const filteredEntries = useMemo(() => {
    if (filter === 'all') return allEntries;
    return allEntries.filter(e => e.status === filter);
  }, [allEntries, filter]);

  const expiredCount = allEntries.filter(e => e.status === 'expired').length;
  const warningCount = allEntries.filter(e => e.status === 'warning').length;

  const handleAddEntry = () => {
    if (!formData.productId || !formData.expiryDate || formData.quantity <= 0) return;
    const product = products.find(p => p.id === formData.productId);
    if (!product) return;
    const entry: ExpiryEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      productId: formData.productId,
      productName: product.name,
      quantity: formData.quantity,
      expiryDate: formData.expiryDate,
      lot: formData.lot || undefined,
      daysUntilExpiry: 0,
      status: 'ok',
    };
    const updated = [...getExpiryEntries(), entry];
    saveExpiryEntries(updated);
    setFormData({ productId: '', quantity: 0, expiryDate: '', lot: '' });
    setShowForm(false);
    reload();
  };

  const handleRemoveEntry = (id: string) => {
    saveExpiryEntries(getExpiryEntries().filter(e => e.id !== id));
    reload();
  };

  const statusColors = {
    ok: 'bg-success/10 text-success border-success/30',
    warning: 'bg-warning/10 text-warning border-warning/30',
    expired: 'bg-destructive/10 text-destructive border-destructive/30',
  };
  const statusLabels = { ok: 'OK', warning: 'Próximo', expired: 'Vencido' };
  const statusIcons = { ok: CheckCircle, warning: Clock, expired: AlertTriangle };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Controle de Validade</h2>
          <p className="text-sm text-muted-foreground">
            {allEntries.length} itens rastreados
            {expiredCount > 0 && <span className="text-destructive font-semibold"> • {expiredCount} vencido(s)</span>}
            {warningCount > 0 && <span className="text-warning font-semibold"> • {warningCount} próximo(s)</span>}
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-pdv-primary !text-base !py-3">
          <Calendar className="w-5 h-5" /> Registrar Validade
        </button>
      </div>

      {/* Alerts */}
      {(expiredCount > 0 || warningCount > 0) && (
        <div className="space-y-2">
          {expiredCount > 0 && (
            <div className="flex items-center gap-3 bg-destructive/10 text-destructive rounded-xl px-4 py-3 border border-destructive/20">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">{expiredCount} produto(s) com validade vencida!</span>
            </div>
          )}
          {warningCount > 0 && (
            <div className="flex items-center gap-3 bg-warning/10 text-warning rounded-xl px-4 py-3 border border-warning/20">
              <Clock className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">{warningCount} produto(s) próximo(s) do vencimento (7 dias)</span>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        {([['all', 'Todos', allEntries.length], ['warning', 'Próximos', warningCount], ['expired', 'Vencidos', expiredCount]] as [typeof filter, string, number][]).map(([key, label, count]) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
            {label} ({count})
          </button>
        ))}
      </div>

      {/* Entries table */}
      <div className="card-pdv overflow-hidden">
        {filteredEntries.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum item de validade registrado</p>
            <p className="text-xs mt-1">Adicione validade no cadastro do produto ou registre manualmente</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Produto</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Lote</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Qtd</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Validade</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Dias</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredEntries.map(e => {
                  const Icon = statusIcons[e.status];
                  const isAuto = e.id.startsWith('auto-');
                  return (
                    <tr key={e.id} className={`hover:bg-muted/30 transition-colors ${e.status === 'expired' ? 'bg-destructive/5' : e.status === 'warning' ? 'bg-warning/5' : ''}`}>
                      <td className="px-4 py-3 font-medium">
                        {e.productName}
                        {isAuto && <span className="ml-1 text-[10px] text-muted-foreground">(cadastro)</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{e.lot || '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{e.quantity}</td>
                      <td className="px-4 py-3 tabular-nums">{formatDate(e.expiryDate)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${statusColors[e.status]}`}>
                          <Icon className="w-3 h-3" /> {statusLabels[e.status]}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-right font-bold tabular-nums ${e.status === 'expired' ? 'text-destructive' : e.status === 'warning' ? 'text-warning' : 'text-success'}`}>
                        {e.daysUntilExpiry <= 0 ? `${Math.abs(e.daysUntilExpiry)}d atrás` : `${e.daysUntilExpiry}d`}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!isAuto && (
                          <button onClick={() => handleRemoveEntry(e.id)} className="text-xs text-destructive hover:underline">Remover</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add entry form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-foreground/30 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowForm(false)}>
          <div className="card-pdv p-6 w-full max-w-md space-y-4 animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold">Registrar Validade</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Produto *</label>
                <select className="input-pdv" value={formData.productId} onChange={e => setFormData(f => ({ ...f, productId: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Quantidade *</label>
                  <input className="input-pdv" type="number" min={1} value={formData.quantity || ''} onChange={e => setFormData(f => ({ ...f, quantity: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Lote</label>
                  <input className="input-pdv" value={formData.lot} onChange={e => setFormData(f => ({ ...f, lot: e.target.value }))} placeholder="Opcional" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Data de Validade *</label>
                <input className="input-pdv" type="date" value={formData.expiryDate} onChange={e => setFormData(f => ({ ...f, expiryDate: e.target.value }))} />
              </div>
            </div>
            <button onClick={handleAddEntry} disabled={!formData.productId || !formData.expiryDate || formData.quantity <= 0} className="btn-pdv-primary w-full">
              Registrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
