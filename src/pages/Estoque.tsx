import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, AlertTriangle, Edit2, Trash2, PackagePlus, X, Upload, Download } from 'lucide-react';
import type { Product, ProductUnit } from '@/types/pdv';
import ImportProducts from '@/components/ImportProducts';
import { getProducts, saveProduct, updateProduct, deleteProduct, saveStockEntry } from '@/lib/store';
import { formatCurrency, unitLabels } from '@/lib/format';
import { exportProductsToExcel } from '@/lib/exportExcel';
import { toast } from 'sonner';

const emptyForm = { name: '', code: '', barcode: '', price: 0, cost: 0, stock: 0, unit: 'un' as ProductUnit, minStock: 5, expiryDate: '' };

export default function EstoquePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'ok'>('all');
  const [unitFilter, setUnitFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [stockEntryProduct, setStockEntryProduct] = useState<Product | null>(null);
  const [stockEntryQty, setStockEntryQty] = useState(0);
  const [showImport, setShowImport] = useState(false);

  const reload = () => setProducts(getProducts());
  useEffect(() => { reload(); }, []);
  useEffect(() => {
    const handleDataUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ key?: string }>;
      if (customEvent.detail?.key === 'pdv_products') {
        reload();
      }
    };

    window.addEventListener('pdv:data-updated', handleDataUpdated as EventListener);
    return () => window.removeEventListener('pdv:data-updated', handleDataUpdated as EventListener);
  }, []);

  const [visibleCount, setVisibleCount] = useState(50);

  const filtered = useMemo(() => products.filter(p => {
    const matchSearch = !search.trim() || p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode && p.barcode.includes(search));
    const matchStock = stockFilter === 'all' || (stockFilter === 'low' ? p.stock <= p.minStock : p.stock > p.minStock);
    const matchUnit = unitFilter === 'all' || p.unit === unitFilter;
    return matchSearch && matchStock && matchUnit;
  }), [products, search, stockFilter, unitFilter]);

  const visibleProducts = filtered.slice(0, visibleCount);

  const handleSave = () => {
    if (!form.name || !form.code) { toast.error('Preencha nome e código'); return; }
    const data: any = { ...form };
    if (!data.barcode) delete data.barcode;
    if (!data.expiryDate) delete data.expiryDate;
    if (editingId) {
      updateProduct(editingId, data);
      toast.success('Produto atualizado');
    } else {
      saveProduct(data);
      toast.success('Produto cadastrado');
    }
    setForm(emptyForm);
    setShowForm(false);
    setEditingId(null);
    reload();
  };

  const handleEdit = (p: Product) => {
    setForm({
      name: p.name, code: p.code, barcode: p.barcode || '', price: p.price, cost: p.cost,
      stock: p.stock, unit: p.unit, minStock: p.minStock, expiryDate: p.expiryDate || ''
    });
    setEditingId(p.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Remover este produto?')) {
      deleteProduct(id);
      toast.success('Produto removido');
      reload();
    }
  };

  const handleStockEntry = () => {
    if (!stockEntryProduct || stockEntryQty <= 0) return;
    saveStockEntry({ productId: stockEntryProduct.id, quantity: stockEntryQty });
    toast.success(`${stockEntryQty} ${unitLabels[stockEntryProduct.unit]} adicionado(s)`);
    setStockEntryProduct(null);
    setStockEntryQty(0);
    reload();
  };

  const lowStockCount = products.filter(p => p.stock <= p.minStock).length;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Estoque</h2>
          <p className="text-sm text-muted-foreground">{products.length} produtos cadastrados</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportProductsToExcel(products)} className="btn-pdv-primary !bg-success !text-base !py-3" title="Exportar Excel">
            <Download className="w-5 h-5" /> Exportar
          </button>
          <button onClick={() => setShowImport(true)} className="btn-pdv-primary !bg-accent !text-base !py-3">
            <Upload className="w-5 h-5" /> Importar
          </button>
          <button onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }} className="btn-pdv-primary !text-base !py-3">
            <Plus className="w-5 h-5" /> Novo Produto
          </button>
        </div>
      </div>

      {lowStockCount > 0 && (
        <div className="flex items-center gap-3 bg-warning/10 text-warning rounded-xl px-4 py-3 border border-warning/20">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{lowStockCount} produto(s) com estoque baixo</span>
        </div>
      )}

      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input type="text" placeholder="Buscar produto ou código de barras..." className="input-pdv pl-12" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          {([['all', 'Todos'], ['low', '⚠ Estoque Baixo'], ['ok', '✓ Estoque OK']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setStockFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${stockFilter === key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
              {label}
            </button>
          ))}
          <span className="text-muted-foreground">|</span>
          {([['all', 'Todos'], ['un', 'Unidade'], ['kg', 'Kg'], ['lt', 'Litro']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setUnitFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${unitFilter === key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Product list */}
      <div className="card-pdv overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-muted/50">
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Produto</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase hidden sm:table-cell">Código</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase text-right">Preço</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase text-right">Estoque</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleProducts.map(p => (
                <tr key={p.id} className={`hover:bg-muted/30 transition-colors ${p.stock <= p.minStock ? 'bg-destructive/5' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground sm:hidden">#{p.code}</p>
                    {p.barcode && <p className="text-xs text-muted-foreground">⊟ {p.barcode}</p>}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground hidden sm:table-cell">#{p.code}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-right tabular-nums">{formatCurrency(p.price)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`inline-flex items-center gap-1 text-sm font-medium px-2 py-0.5 rounded-full ${
                      p.stock <= p.minStock ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
                    }`}>
                      {p.stock} {p.unit}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setStockEntryProduct(p)} className="w-8 h-8 rounded-lg flex items-center justify-center text-accent hover:bg-accent/10 transition-all" title="Entrada de estoque">
                        <PackagePlus className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleEdit(p)} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-all" title="Editar">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-destructive hover:bg-destructive/10 transition-all" title="Remover">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">Nenhum produto encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {visibleCount < filtered.length && (
          <div className="p-3 text-center border-t border-border">
            <button onClick={() => setVisibleCount(c => c + 50)} className="text-sm text-primary font-medium hover:underline">
              Mostrar mais ({filtered.length - visibleCount} restantes)
            </button>
          </div>
        )}
      </div>

      {/* Product Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-foreground/30 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowForm(false)}>
          <div className="card-pdv p-6 w-full max-w-md space-y-4 animate-fade-in-up max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">{editingId ? 'Editar Produto' : 'Novo Produto'}</h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Nome *</label>
                <input className="input-pdv" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Ex: Arroz 5kg" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Código *</label>
                  <input className="input-pdv" value={form.code} onChange={e => setForm({...form, code: e.target.value})} placeholder="Ex: 001" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Cód. Barras</label>
                  <input className="input-pdv" value={form.barcode} onChange={e => setForm({...form, barcode: e.target.value})} placeholder="Bipe ou digite" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Unidade</label>
                  <select className="input-pdv" value={form.unit} onChange={e => setForm({...form, unit: e.target.value as ProductUnit})}>
                    <option value="un">Unidade</option>
                    <option value="kg">Kg</option>
                    <option value="lt">Litro</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Validade</label>
                  <input className="input-pdv" type="date" value={form.expiryDate} onChange={e => setForm({...form, expiryDate: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Preço Venda (R$)</label>
                  <input className="input-pdv" type="number" step="0.01" min="0" value={form.price || ''} onChange={e => setForm({...form, price: parseFloat(e.target.value) || 0})} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Custo (R$)</label>
                  <input className="input-pdv" type="number" step="0.01" min="0" value={form.cost || ''} onChange={e => setForm({...form, cost: parseFloat(e.target.value) || 0})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Qtd. Inicial</label>
                  <input className="input-pdv" type="number" step={form.unit === 'un' ? 1 : 0.1} min="0" value={form.stock || ''} onChange={e => setForm({...form, stock: parseFloat(e.target.value) || 0})} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Estoque Mínimo</label>
                  <input className="input-pdv" type="number" step="1" min="0" value={form.minStock || ''} onChange={e => setForm({...form, minStock: parseFloat(e.target.value) || 0})} />
                </div>
              </div>
            </div>
            <button onClick={handleSave} className="btn-pdv-primary w-full">
              {editingId ? 'Salvar Alterações' : 'Cadastrar Produto'}
            </button>
          </div>
        </div>
      )}

      {/* Stock Entry Modal */}
      {stockEntryProduct && (
        <div className="fixed inset-0 bg-foreground/30 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setStockEntryProduct(null)}>
          <div className="card-pdv p-6 w-full max-w-sm space-y-4 animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold">Entrada de Estoque</h3>
            <p className="text-sm text-muted-foreground">{stockEntryProduct.name} — Atual: {stockEntryProduct.stock} {stockEntryProduct.unit}</p>
            <div>
              <label className="text-sm font-medium mb-1 block">Quantidade a adicionar</label>
              <input className="input-pdv" type="number" step={stockEntryProduct.unit === 'un' ? 1 : 0.1} min="0" value={stockEntryQty || ''} onChange={e => setStockEntryQty(parseFloat(e.target.value) || 0)} autoFocus />
            </div>
            <button onClick={handleStockEntry} disabled={stockEntryQty <= 0} className="btn-pdv-primary w-full">
              Confirmar Entrada
            </button>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 bg-foreground/30 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowImport(false)}>
          <div className="card-pdv p-6 w-full max-w-2xl animate-fade-in-up max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Importar Produtos</h3>
              <button onClick={() => setShowImport(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>
            <ImportProducts onDone={() => { setShowImport(false); reload(); }} />
          </div>
        </div>
      )}
    </div>
  );
}
