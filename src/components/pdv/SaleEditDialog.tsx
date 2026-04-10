import { useState, useMemo } from 'react';
import { X, Plus, Minus, Trash2, Search, AlertTriangle, History } from 'lucide-react';
import type { Sale, PaymentEntry, PaymentMethod } from '@/types/pdv';
import { getProducts, saveSaleAdjustment, getAdjustmentsForSale, getLatestSaleItems } from '@/lib/store';
import { formatCurrency, paymentMethodLabels, formatDateTime } from '@/lib/format';
import { toast } from 'sonner';

interface Props {
  sale: Sale;
  onClose: () => void;
  onSaved: () => void;
}

interface EditItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export default function SaleEditDialog({ sale, onClose, onSaved }: Props) {
  const currentItems = getLatestSaleItems(sale);
  const [items, setItems] = useState<EditItem[]>(currentItems.map(i => ({ ...i })));
  const [search, setSearch] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const products = getProducts();
  const adjustments = getAdjustmentsForSale(sale.id);
  const latestAdjustment = adjustments
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  const filteredProducts = search.trim()
    ? products
        .filter(p =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.code.toLowerCase().includes(search.toLowerCase())
        )
        .filter(p => !items.find(i => i.productId === p.id))
        .slice(0, 5)
    : [];

  const originalTotal = sale.total;
  const newTotal = items.reduce((a, i) => a + i.subtotal, 0);
  const difference = +(newTotal - originalTotal).toFixed(2);

  const basePayments: PaymentEntry[] = sale.payments?.length
    ? sale.payments
    : [{ method: sale.paymentMethod, amount: sale.total }];
  const hasFullAdjustedPayments = !!latestAdjustment &&
    latestAdjustment.payments.length > 0 &&
    Math.abs(latestAdjustment.payments.reduce((acc, p) => acc + p.amount, 0) - latestAdjustment.newTotal) < 0.01;
  const effectivePayments = hasFullAdjustedPayments ? latestAdjustment!.payments : basePayments;
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>(
    effectivePayments.reduce((a, b) => a.amount >= b.amount ? a : b).method
  );

  const hasChanges = useMemo(() => {
    if (items.length !== currentItems.length) return true;
    return items.some(item => {
      const orig = currentItems.find(i => i.productId === item.productId);
      return !orig || orig.quantity !== item.quantity;
    });
  }, [items, currentItems]);

  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      setItems(prev => prev.filter(i => i.productId !== productId));
      return;
    }
    setItems(prev => prev.map(i =>
      i.productId === productId
        ? { ...i, quantity: qty, subtotal: +(qty * i.unitPrice).toFixed(2) }
        : i
    ));
  };

  const removeItem = (productId: string) => {
    setItems(prev => prev.filter(i => i.productId !== productId));
  };

  const addProduct = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    setItems(prev => [...prev, {
      productId: product.id,
      productName: product.name,
      quantity: 1,
      unitPrice: product.price,
      subtotal: product.price,
    }]);
    setSearch('');
  };

  const handleSave = () => {
    if (items.length === 0) {
      toast.error('A venda deve ter pelo menos um item');
      return;
    }
    if (!hasChanges) {
      toast.info('Nenhuma alteração foi feita');
      return;
    }

    // Novo formato: grava o pagamento efetivo da venda após o ajuste.
    const payments: PaymentEntry[] = [{ method: selectedPaymentMethod, amount: newTotal }];

    saveSaleAdjustment({
      saleId: sale.id,
      items,
      previousTotal: originalTotal,
      newTotal,
      difference,
      payments,
      reason: difference > 0 ? 'Itens adicionados/ajustados' : difference < 0 ? 'Itens removidos/ajustados' : 'Quantidades ajustadas',
    });

    toast.success('Ajuste registrado com sucesso!');
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-fade-in-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h3 className="font-bold text-lg">Editar / Ajustar Venda</h3>
            <p className="text-xs text-muted-foreground">
              Venda de {formatDateTime(sale.createdAt)}
              {sale.customerName && <> • {sale.customerName}</>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {adjustments.length > 0 && (
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted hover:bg-muted/80 transition-all"
              >
                <History className="w-3.5 h-3.5" />
                {adjustments.length} ajuste{adjustments.length > 1 ? 's' : ''}
              </button>
            )}
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-all active:scale-95">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Adjustment History */}
          {showHistory && adjustments.length > 0 && (
            <div className="bg-muted/50 rounded-xl p-3 space-y-2 animate-fade-in">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Histórico de Ajustes</p>
              {adjustments
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map(adj => (
                  <div key={adj.id} className="flex items-center justify-between text-sm p-2 bg-card rounded-lg">
                    <div>
                      <p className="font-medium">{adj.reason}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(adj.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold tabular-nums ${adj.difference > 0 ? 'text-destructive' : adj.difference < 0 ? 'text-success' : 'text-foreground'}`}>
                        {adj.difference > 0 ? '+' : ''}{formatCurrency(adj.difference)}
                      </p>
                      <p className="text-xs text-muted-foreground">→ {formatCurrency(adj.newTotal)}</p>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Add product search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Adicionar produto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {filteredProducts.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-lg z-10 divide-y divide-border overflow-hidden">
                {filteredProducts.map(p => (
                  <button
                    key={p.id}
                    onClick={() => addProduct(p.id)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted transition-colors text-left text-sm"
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="font-bold tabular-nums">{formatCurrency(p.price)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Items list */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Itens da Venda</p>
            {items.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground text-sm">
                Nenhum item na venda
              </div>
            ) : (
              items.map(item => {
                const origItem = currentItems.find(i => i.productId === item.productId);
                const isNew = !origItem;
                const isChanged = origItem && origItem.quantity !== item.quantity;
                return (
                  <div
                    key={item.productId}
                    className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                      isNew ? 'border-primary/30 bg-primary/5' : isChanged ? 'border-warning/30 bg-warning/5' : 'border-border bg-muted/30'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-sm truncate">{item.productName}</p>
                        {isNew && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-semibold">NOVO</span>}
                        {isChanged && <span className="text-[10px] bg-warning/10 text-warning px-1.5 py-0.5 rounded font-semibold">ALTERADO</span>}
                      </div>
                      <p className="text-xs text-muted-foreground tabular-nums">{formatCurrency(item.unitPrice)} un</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(item.productId, item.quantity - 1)} className="w-7 h-7 rounded-lg bg-card border border-border flex items-center justify-center hover:bg-muted active:scale-95 transition-all">
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={e => updateQty(item.productId, parseFloat(e.target.value) || 0)}
                        className="w-14 text-center text-sm font-medium bg-card border border-border rounded-lg py-1 tabular-nums"
                        min={0}
                        step={1}
                      />
                      <button onClick={() => updateQty(item.productId, item.quantity + 1)} className="w-7 h-7 rounded-lg bg-card border border-border flex items-center justify-center hover:bg-muted active:scale-95 transition-all">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="w-20 text-right font-bold text-sm tabular-nums">{formatCurrency(item.subtotal)}</p>
                    <button onClick={() => removeItem(item.productId)} className="w-7 h-7 rounded-lg flex items-center justify-center text-destructive hover:bg-destructive/10 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Original payments */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Forma de Pagamento</p>
            <div className="flex flex-wrap gap-2">
              {([
                'dinheiro',
                'pix',
                'cartao_credito',
                'cartao_debito',
                'fiado',
              ] as PaymentMethod[]).map(method => (
                <button
                  key={method}
                  onClick={() => setSelectedPaymentMethod(method)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm transition-all ${
                    selectedPaymentMethod === method
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground hover:bg-muted/80'
                  }`}
                >
                  <span className="font-medium">{paymentMethodLabels[method]}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Valor final será registrado em <strong>{paymentMethodLabels[selectedPaymentMethod]}</strong>.
            </p>
          </div>
        </div>

        {/* Footer with totals */}
        <div className="border-t border-border p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total original</span>
            <span className="tabular-nums">{formatCurrency(originalTotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Novo total</span>
            <span className="font-bold tabular-nums">{formatCurrency(newTotal)}</span>
          </div>
          {difference !== 0 && (
            <div className={`flex items-center justify-between text-sm p-2.5 rounded-lg ${
              difference > 0 ? 'bg-destructive/10' : 'bg-success/10'
            }`}>
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                {difference > 0
                  ? (selectedPaymentMethod === 'fiado' ? 'Valor pendente em fiado' : 'Valor adicional registrado na forma escolhida')
                  : 'Valor reduzido na venda'}
              </span>
              <span className={`font-bold tabular-nums ${difference > 0 ? 'text-destructive' : 'text-success'}`}>
                {formatCurrency(Math.abs(difference))}
              </span>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl border border-border font-medium text-sm hover:bg-muted transition-all active:scale-[0.98]"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || items.length === 0}
              className="flex-1 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Salvar Ajuste
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}