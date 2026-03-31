import { useState, useEffect, useMemo } from 'react';
import { Plus, Phone, X, DollarSign, MessageCircle, Send, AlertTriangle, Clock, Filter, ChevronDown, ChevronUp, Edit2, Ban, CheckCircle, User, MapPin, FileText, Upload, Smartphone, CreditCard, Wallet, Search, Download, Eye, EyeOff } from 'lucide-react';
import type { Customer, CustomerStatus, PaymentMethod } from '@/types/pdv';
import { getCustomers, saveCustomer, updateCustomer, getSales, getDebtPayments, saveDebtPayment, getCustomerDebt } from '@/lib/store';
import { formatCurrency, formatDate, paymentMethodLabels } from '@/lib/format';
import { generateDebtMessage, openWhatsApp, getDaysSinceLastPurchase, getCollectionThresholds, setCollectionThresholds } from '@/lib/whatsapp';
import { getCreditStatusColor, getMonthlyFiadoTotal } from '@/lib/credit';
import { toast } from 'sonner';
import { canAccess } from '@/lib/plans';
import ImportCustomers from '@/components/ImportCustomers';
import { exportCustomersToExcel } from '@/lib/exportExcel';

export default function ClientesPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    name: '', phone: '', address: '', cpf: '', notes: '',
    creditLimit: '', monthlyLimit: '', status: 'active' as CustomerStatus,
  });
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [debtPaymentMethod, setDebtPaymentMethod] = useState<PaymentMethod>('dinheiro');
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [whatsAppMessage, setWhatsAppMessage] = useState('');
  const [whatsAppCustomer, setWhatsAppCustomer] = useState<Customer | null>(null);
  const [showThresholds, setShowThresholds] = useState(false);
  const [thresholdDays, setThresholdDays] = useState(7);
  const [thresholdAmount, setThresholdAmount] = useState(100);
  const [filter, setFilter] = useState<'all' | 'debtors' | 'recommended' | 'blocked'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(50);
  const [showImport, setShowImport] = useState(false);
  const [collectionExpanded, setCollectionExpanded] = useState(false);
  const [hideValues, setHideValues] = useState(false);
  const [hideCardValues, setHideCardValues] = useState(false);
  const mask = (val: string) => hideValues ? '••••' : val;
  const maskCard = (val: string) => hideCardValues ? '••••' : val;

  const reload = () => setCustomers(getCustomers());
  useEffect(() => {
    reload();
    const t = getCollectionThresholds();
    setThresholdDays(t.days);
    setThresholdAmount(t.amount);
  }, []);
  useEffect(() => {
    const handleDataUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ key?: string }>;
      const key = customEvent.detail?.key;
      if (key === 'pdv_customers' || key === 'pdv_sales' || key === 'pdv_debt_payments') {
        reload();
      }
    };

    window.addEventListener('pdv:data-updated', handleDataUpdated as EventListener);
    return () => window.removeEventListener('pdv:data-updated', handleDataUpdated as EventListener);
  }, []);

  const resetForm = () => {
    setFormData({ name: '', phone: '', address: '', cpf: '', notes: '', creditLimit: '', monthlyLimit: '', status: 'active' });
    setEditingCustomer(null);
    setShowForm(false);
  };

  const openNewForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (c: Customer) => {
    setFormData({
      name: c.name, phone: c.phone, address: c.address || '', cpf: c.cpf || '',
      notes: c.notes || '', creditLimit: c.creditLimit?.toString() || '',
      monthlyLimit: c.monthlyLimit?.toString() || '', status: c.status || 'active',
    });
    setEditingCustomer(c);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!formData.name.trim()) { toast.error('Informe o nome'); return; }
    const data = {
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      address: formData.address.trim() || undefined,
      cpf: formData.cpf.trim() || undefined,
      notes: formData.notes.trim() || undefined,
      creditLimit: formData.creditLimit ? parseFloat(formData.creditLimit) : undefined,
      monthlyLimit: formData.monthlyLimit ? parseFloat(formData.monthlyLimit) : undefined,
      status: formData.status,
    };
    if (editingCustomer) {
      updateCustomer(editingCustomer.id, data);
      toast.success('Cliente atualizado');
    } else {
      saveCustomer(data);
      toast.success('Cliente cadastrado');
    }
    resetForm();
    reload();
  };

  const toggleStatus = (c: Customer) => {
    const newStatus: CustomerStatus = c.status === 'active' ? 'blocked' : 'active';
    updateCustomer(c.id, { status: newStatus });
    toast.success(newStatus === 'blocked' ? 'Cliente bloqueado' : 'Cliente desbloqueado');
    reload();
    if (selectedCustomer?.id === c.id) setSelectedCustomer({ ...c, status: newStatus });
  };

  const handlePayment = () => {
    if (!selectedCustomer || paymentAmount <= 0) return;
    const debt = getCustomerDebt(selectedCustomer.id);
    const amount = Math.min(paymentAmount, debt);
    saveDebtPayment({ customerId: selectedCustomer.id, amount, paymentMethod: debtPaymentMethod });
    toast.success(`Pagamento de ${formatCurrency(amount)} (${paymentMethodLabels[debtPaymentMethod]}) registrado`);
    setPaymentAmount(0);
    reload();
  };

  const handlePayFull = () => {
    if (!selectedCustomer) return;
    const debt = getCustomerDebt(selectedCustomer.id);
    if (debt <= 0) return;
    saveDebtPayment({ customerId: selectedCustomer.id, amount: debt, paymentMethod: debtPaymentMethod });
    toast.success(`Dívida de ${formatCurrency(debt)} quitada (${paymentMethodLabels[debtPaymentMethod]})!`);
    setPaymentAmount(0);
    reload();
  };

  const handleOpenWhatsApp = (customer: Customer) => {
    if (!canAccess('whatsapp')) {
      toast.error('Disponível apenas no plano Completo ou superior');
      return;
    }
    const debt = getCustomerDebt(customer.id);
    setWhatsAppCustomer(customer);
    setWhatsAppMessage(generateDebtMessage(customer.name, debt, customer.id));
    setShowWhatsApp(true);
  };

  const handleSendWhatsApp = () => {
    if (!whatsAppCustomer?.phone) { toast.error('Cliente sem telefone'); return; }
    openWhatsApp(whatsAppCustomer.phone, whatsAppMessage);
    setShowWhatsApp(false);
    toast.success('WhatsApp aberto');
  };

  const handleCobrarTodos = () => {
    const targets = recommendedCustomers.filter(c => c.phone);
    if (targets.length === 0) { toast.error('Nenhum cliente com telefone'); return; }
    const first = targets[0];
    openWhatsApp(first.phone, generateDebtMessage(first.name, first.debt, first.id));
    if (targets.length > 1) toast.info(`Abrindo 1 de ${targets.length} cobranças.`);
    else toast.success('Cobrança enviada!');
  };

  const saveThresholds = () => {
    setCollectionThresholds(thresholdDays, thresholdAmount);
    setShowThresholds(false);
    toast.success('Limites atualizados');
  };

  const getCustomerSales = (customerId: string) =>
    getSales().filter(s => s.customerId === customerId && (s.paymentMethod === 'fiado' || (s.fiadoAmount != null && s.fiadoAmount > 0)))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const getCustomerPayments = (customerId: string) =>
    getDebtPayments().filter(p => p.customerId === customerId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const getCustomerTotalPurchased = (customerId: string) =>
    getSales().filter(s => s.customerId === customerId).reduce((a, s) => a + s.total, 0);

  const getCustomerTotalPaid = (customerId: string) =>
    getDebtPayments().filter(p => p.customerId === customerId).reduce((a, p) => a + p.amount, 0);

  const getLastPaymentDate = (customerId: string) => {
    const payments = getDebtPayments().filter(p => p.customerId === customerId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return payments.length > 0 ? payments[0].createdAt : null;
  };

  const debtors = useMemo(() =>
    customers.filter(c => getCustomerDebt(c.id) > 0)
      .map(c => ({ ...c, debt: getCustomerDebt(c.id), daysSince: getDaysSinceLastPurchase(c.id) }))
      .sort((a, b) => b.debt - a.debt),
    [customers]
  );

  const recommendedCustomers = useMemo(() =>
    debtors.filter(c => {
      const overdue = c.daysSince !== null && c.daysSince >= thresholdDays;
      const highValue = c.debt >= thresholdAmount;
      return overdue || highValue;
    }),
    [debtors, thresholdDays, thresholdAmount]
  );

  const blockedCustomers = useMemo(() => customers.filter(c => c.status === 'blocked'), [customers]);

  const displayedCustomers = useMemo(() => {
    let list;
    if (filter === 'debtors') list = debtors;
    else if (filter === 'recommended') list = recommendedCustomers;
    else if (filter === 'blocked') list = blockedCustomers.map(c => ({ ...c, debt: getCustomerDebt(c.id), daysSince: getDaysSinceLastPurchase(c.id) }));
    else list = customers.map(c => ({ ...c, debt: getCustomerDebt(c.id), daysSince: getDaysSinceLastPurchase(c.id) }));
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(c => 
        c.name.toLowerCase().includes(q) || 
        c.phone?.toLowerCase().includes(q) ||
        c.cpf?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [filter, customers, debtors, recommendedCustomers, blockedCustomers, searchQuery]);

  const totalDebt = debtors.reduce((acc, c) => acc + c.debt, 0);

  const creditStatusClasses = {
    green: 'bg-success/10 text-success border-success/30',
    yellow: 'bg-warning/10 text-warning border-warning/30',
    red: 'bg-destructive/10 text-destructive border-destructive/30',
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Clientes & Fiado</h2>
          <p className="text-sm text-muted-foreground">
            {customers.length} clientes • {debtors.length} devendo • Total: {mask(formatCurrency(totalDebt))}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setHideValues(v => !v)}
            className="w-11 h-11 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition-all active:scale-95"
            title={hideValues ? 'Mostrar valores' : 'Ocultar valores'}
          >
            {hideValues ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
          <button onClick={() => exportCustomersToExcel(customers)} className="px-4 py-3 rounded-xl bg-success text-success-foreground text-sm font-medium hover:bg-success/90 transition-colors flex items-center gap-2">
            <Download className="w-5 h-5" /> Exportar
          </button>
          <button onClick={() => setShowImport(true)} className="px-4 py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2">
            <Upload className="w-5 h-5" /> Importar
          </button>
          <button onClick={openNewForm} className="btn-pdv-primary !text-base !py-3">
            <Plus className="w-5 h-5" /> Novo Cliente
          </button>
        </div>
      </div>

      {/* Import modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowImport(false)}>
          <div className="bg-card rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Importar Clientes</h3>
              <button onClick={() => setShowImport(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted"><X className="w-5 h-5" /></button>
            </div>
            <ImportCustomers onDone={() => { setShowImport(false); reload(); }} />
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="card-pdv p-4 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Clientes</p>
          <p className="text-2xl font-extrabold tabular-nums">{customers.length}</p>
        </div>
        <div className="card-pdv p-4 text-center border-destructive/20">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Devedores</p>
          <p className="text-2xl font-extrabold tabular-nums text-destructive">{debtors.length}</p>
        </div>
        <div className="card-pdv p-4 text-center border-destructive/20">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total em Dívidas</p>
          <p className="text-2xl font-extrabold tabular-nums text-destructive">{mask(formatCurrency(totalDebt))}</p>
        </div>
        <div className="card-pdv p-4 text-center border-warning/20">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Cobrança Recomendada</p>
          <p className="text-2xl font-extrabold tabular-nums text-warning">{recommendedCustomers.length}</p>
        </div>
        <div className="card-pdv p-4 text-center border-destructive/20">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Bloqueados</p>
          <p className="text-2xl font-extrabold tabular-nums text-destructive">{blockedCustomers.length}</p>
        </div>
      </div>

      {/* Smart collection banner */}
      {recommendedCustomers.length > 0 && (
        <div className="card-pdv p-4 border-warning/40 bg-warning/5 space-y-3">
          <div className="flex items-center justify-between">
            <button onClick={() => setCollectionExpanded(!collectionExpanded)} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <AlertTriangle className="w-5 h-5 text-warning" />
              <h3 className="text-sm font-bold text-warning uppercase tracking-wide">
                Cobrança Recomendada ({recommendedCustomers.length})
              </h3>
              {collectionExpanded ? <ChevronUp className="w-4 h-4 text-warning" /> : <ChevronDown className="w-4 h-4 text-warning" />}
            </button>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowThresholds(!showThresholds)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                <Filter className="w-3 h-3" /> Limites
              </button>
              <button onClick={handleCobrarTodos} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-success text-success-foreground text-sm font-medium hover:bg-success/90 transition-all active:scale-95">
                <MessageCircle className="w-4 h-4" /> Cobrar Todos
              </button>
            </div>
          </div>

          {collectionExpanded && (
            <>
              {showThresholds && (
                <div className="flex flex-wrap items-end gap-3 p-3 bg-card rounded-lg animate-fade-in">
                  <div className="flex-1 min-w-[120px]">
                    <label className="text-xs font-medium block mb-1">Dias sem pagar</label>
                    <input type="number" className="input-pdv !py-2 !text-sm" value={thresholdDays} onChange={e => setThresholdDays(parseInt(e.target.value) || 1)} min={1} />
                  </div>
                  <div className="flex-1 min-w-[120px]">
                    <label className="text-xs font-medium block mb-1">Valor mínimo (R$)</label>
                    <input type="number" className="input-pdv !py-2 !text-sm" value={thresholdAmount} onChange={e => setThresholdAmount(parseFloat(e.target.value) || 0)} min={0} step="10" />
                  </div>
                  <button onClick={saveThresholds} className="btn-pdv-primary !py-2 !text-sm !px-4">Salvar</button>
                </div>
              )}

              <div className="space-y-1.5">
                {recommendedCustomers.map(c => (
                  <div key={c.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${c.debt >= thresholdAmount * 2 ? 'bg-destructive/10 border border-destructive/20' : 'bg-card/60'}`}>
                    <button onClick={() => setSelectedCustomer(c)} className="flex-1 flex items-center justify-between text-left hover:opacity-80 transition-opacity">
                      <div className="min-w-0">
                        <span className="font-medium truncate block">{c.name}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {c.daysSince !== null ? `${c.daysSince} dias atrás` : 'Sem compras'}
                          {c.phone && <> • <Phone className="w-3 h-3" /> {c.phone}</>}
                        </span>
                      </div>
                      <span className="font-bold text-destructive tabular-nums whitespace-nowrap ml-2">{mask(formatCurrency(c.debt))}</span>
                    </button>
                    <button onClick={() => handleOpenWhatsApp(c)} className="w-10 h-10 rounded-lg flex items-center justify-center bg-success/10 text-success hover:bg-success/20 transition-all active:scale-95 flex-shrink-0" title="Cobrar via WhatsApp">
                      <MessageCircle className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar por nome, telefone ou CPF..."
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setVisibleCount(50); }}
          className="input-pdv !pl-10 !py-2.5"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all' as const, label: 'Todos', count: customers.length },
          { key: 'debtors' as const, label: 'Devedores', count: debtors.length },
          { key: 'recommended' as const, label: 'Cobrar', count: recommendedCustomers.length },
          { key: 'blocked' as const, label: 'Bloqueados', count: blockedCustomers.length },
        ].map(tab => (
          <button key={tab.key} onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === tab.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}>
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Customer list */}
      <div className="card-pdv divide-y divide-border">
        {displayedCustomers.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            {filter === 'all' ? 'Nenhum cliente cadastrado' : 'Nenhum cliente neste filtro'}
          </div>
        ) : (
          displayedCustomers.slice(0, visibleCount).map(c => {
            const statusColor = getCreditStatusColor(c);
            const isBlocked = c.status === 'blocked';
            const limit = c.creditLimit;
            const remaining = limit ? Math.max(0, limit - c.debt) : null;
            return (
              <div key={c.id} className={`flex items-center gap-2 ${isBlocked ? 'opacity-60' : ''}`}>
                <button onClick={() => setSelectedCustomer(c)}
                  className="flex-1 flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{c.name}</p>
                      {isBlocked && (
                        <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-medium">Bloqueado</span>
                      )}
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                        statusColor === 'green' ? 'bg-success' : statusColor === 'yellow' ? 'bg-warning' : 'bg-destructive'
                      }`} title={statusColor === 'green' ? 'Dentro do limite' : statusColor === 'yellow' ? 'Próximo do limite' : 'Ultrapassou'} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      {c.phone && <span><Phone className="w-3 h-3 inline mr-0.5" />{c.phone}</span>}
                      {c.daysSince !== null && <span><Clock className="w-3 h-3 inline mr-0.5" />{c.daysSince}d</span>}
                      {limit != null && limit > 0 && (
                        <span className={`font-medium ${statusColor === 'red' ? 'text-destructive' : statusColor === 'yellow' ? 'text-warning' : 'text-muted-foreground'}`}>
                          Limite: {mask(formatCurrency(remaining ?? 0))} restante
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`font-semibold tabular-nums whitespace-nowrap ${c.debt > 0 ? 'text-destructive' : 'text-success'}`}>
                    {c.debt > 0 ? mask(formatCurrency(c.debt)) : 'Em dia'}
                  </span>
                </button>
                <div className="flex items-center gap-1 mr-2 flex-shrink-0">
                  <button onClick={() => openEditForm(c)} className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-all" title="Editar">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {c.debt > 0 && (
                    <button onClick={() => handleOpenWhatsApp(c)} className="w-9 h-9 rounded-lg flex items-center justify-center bg-success/10 text-success hover:bg-success/20 transition-all" title="WhatsApp">
                      <MessageCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
        {visibleCount < displayedCustomers.length && (
          <div className="p-3 text-center border-t border-border">
            <button onClick={() => setVisibleCount(c => c + 50)} className="text-sm text-primary font-medium hover:underline">
              Mostrar mais ({displayedCustomers.length - visibleCount} restantes)
            </button>
          </div>
        )}
      </div>

      {/* New / Edit customer modal */}
      {showForm && (
        <div className="fixed inset-0 bg-foreground/30 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={resetForm}>
          <div className="card-pdv p-6 w-full max-w-md space-y-4 animate-fade-in-up max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">{editingCustomer ? 'Editar Cliente' : 'Novo Cliente'}</h3>
              <button onClick={resetForm} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Nome completo *</label>
                <input className="input-pdv" value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} placeholder="Nome completo" autoFocus />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Telefone (WhatsApp) *</label>
                <input className="input-pdv" value={formData.phone} onChange={e => setFormData(f => ({ ...f, phone: e.target.value }))} placeholder="(99) 99999-9999" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">CPF</label>
                <input className="input-pdv" value={formData.cpf} onChange={e => setFormData(f => ({ ...f, cpf: e.target.value }))} placeholder="000.000.000-00" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Endereço</label>
                <input className="input-pdv" value={formData.address} onChange={e => setFormData(f => ({ ...f, address: e.target.value }))} placeholder="Rua, número, bairro" />
              </div>

              <div className="border-t border-border pt-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Controle de Crédito</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Limite de crédito (R$)</label>
                    <input className="input-pdv" type="number" value={formData.creditLimit} onChange={e => setFormData(f => ({ ...f, creditLimit: e.target.value }))} placeholder="Sem limite" min={0} step={10} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Limite mensal (R$)</label>
                    <input className="input-pdv" type="number" value={formData.monthlyLimit} onChange={e => setFormData(f => ({ ...f, monthlyLimit: e.target.value }))} placeholder="Sem limite" min={0} step={10} />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Observações</label>
                <textarea className="input-pdv !text-sm min-h-[60px] resize-y" value={formData.notes} onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))} placeholder="Anotações sobre o cliente" />
              </div>

              {editingCustomer && (
                <div>
                  <label className="text-sm font-medium mb-1 block">Status</label>
                  <div className="flex gap-2">
                    <button onClick={() => setFormData(f => ({ ...f, status: 'active' }))}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                        formData.status === 'active' ? 'border-success bg-success/10 text-success' : 'border-border text-muted-foreground'
                      }`}>
                      <CheckCircle className="w-4 h-4" /> Ativo
                    </button>
                    <button onClick={() => setFormData(f => ({ ...f, status: 'blocked' }))}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                        formData.status === 'blocked' ? 'border-destructive bg-destructive/10 text-destructive' : 'border-border text-muted-foreground'
                      }`}>
                      <Ban className="w-4 h-4" /> Bloqueado
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button onClick={handleSave} className="btn-pdv-primary w-full">
              {editingCustomer ? 'Salvar Alterações' : 'Cadastrar'}
            </button>
          </div>
        </div>
      )}

      {/* Customer detail modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-foreground/30 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedCustomer(null)}>
          <div className="card-pdv p-6 w-full max-w-lg space-y-4 animate-fade-in-up max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold">{selectedCustomer.name}</h3>
                  {selectedCustomer.status === 'blocked' && (
                    <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-medium">Bloqueado</span>
                  )}
                </div>
                {selectedCustomer.phone && <p className="text-sm text-muted-foreground">{selectedCustomer.phone}</p>}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setHideCardValues(v => !v)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-all"
                  title={hideCardValues ? 'Mostrar valores' : 'Ocultar valores'}
                >
                  {hideCardValues ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button onClick={() => { setSelectedCustomer(null); openEditForm(selectedCustomer); }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted" title="Editar">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => toggleStatus(selectedCustomer)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted ${selectedCustomer.status === 'blocked' ? 'text-success' : 'text-destructive'}`}
                  title={selectedCustomer.status === 'blocked' ? 'Desbloquear' : 'Bloquear'}>
                  {selectedCustomer.status === 'blocked' ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                </button>
                <button onClick={() => setSelectedCustomer(null)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Customer info */}
            {(selectedCustomer.address || selectedCustomer.cpf || selectedCustomer.notes) && (
              <div className="text-sm space-y-1 text-muted-foreground">
                {selectedCustomer.cpf && <p className="flex items-center gap-1"><FileText className="w-3 h-3" /> CPF: {selectedCustomer.cpf}</p>}
                {selectedCustomer.address && <p className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {selectedCustomer.address}</p>}
                {selectedCustomer.notes && <p className="italic">📝 {selectedCustomer.notes}</p>}
              </div>
            )}

            {/* Financial summary */}
            {(() => {
              const debt = getCustomerDebt(selectedCustomer.id);
              const days = getDaysSinceLastPurchase(selectedCustomer.id);
              const totalPurchased = getCustomerTotalPurchased(selectedCustomer.id);
              const totalPaid = getCustomerTotalPaid(selectedCustomer.id);
              const monthlyTotal = getMonthlyFiadoTotal(selectedCustomer.id);
              const lastPayment = getLastPaymentDate(selectedCustomer.id);
              const statusColor = getCreditStatusColor(selectedCustomer);
              const limit = selectedCustomer.creditLimit;
              const mLimit = selectedCustomer.monthlyLimit;

              return (
                <div className="space-y-3">
                  {/* Debt card */}
                  <div className={`flex items-center gap-3 p-4 rounded-xl border ${creditStatusClasses[statusColor]}`}>
                    <DollarSign className="w-8 h-8" />
                    <div className="flex-1">
                      <p className="text-xs opacity-80">Saldo Devedor</p>
                      <p className="text-2xl font-extrabold tabular-nums">
                        {debt > 0 ? maskCard(formatCurrency(debt)) : 'Em dia ✓'}
                      </p>
                      {days !== null && (
                        <p className="text-xs opacity-70 mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Última compra fiado: {days === 0 ? 'hoje' : `${days} dias atrás`}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Credit limits */}
                  {(limit != null && limit > 0 || mLimit != null && mLimit > 0) && (
                    <div className="grid grid-cols-2 gap-2">
                      {limit != null && limit > 0 && (
                        <div className="p-3 rounded-lg bg-muted/50 text-center">
                          <p className="text-xs text-muted-foreground">Limite de Crédito</p>
                          <p className="text-sm font-bold tabular-nums">{maskCard(formatCurrency(limit))}</p>
                          <p className={`text-xs font-semibold tabular-nums ${debt >= limit ? 'text-destructive' : debt >= limit * 0.7 ? 'text-warning' : 'text-success'}`}>
                            Restante: {maskCard(formatCurrency(Math.max(0, limit - debt)))}
                          </p>
                        </div>
                      )}
                      {mLimit != null && mLimit > 0 && (
                        <div className="p-3 rounded-lg bg-muted/50 text-center">
                          <p className="text-xs text-muted-foreground">Limite Mensal</p>
                          <p className="text-sm font-bold tabular-nums">{maskCard(formatCurrency(mLimit))}</p>
                          <p className={`text-xs font-semibold tabular-nums ${monthlyTotal >= mLimit ? 'text-destructive' : monthlyTotal >= mLimit * 0.7 ? 'text-warning' : 'text-success'}`}>
                            Restante: {maskCard(formatCurrency(Math.max(0, mLimit - monthlyTotal)))}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground">Total Comprado</p>
                      <p className="text-sm font-bold tabular-nums">{maskCard(formatCurrency(totalPurchased))}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground">Total Pago</p>
                      <p className="text-sm font-bold tabular-nums text-success">{maskCard(formatCurrency(totalPaid))}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground">Último Pgto</p>
                      <p className="text-sm font-bold">{lastPayment ? formatDate(lastPayment) : '—'}</p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Payment + WhatsApp */}
            {getCustomerDebt(selectedCustomer.id) > 0 && (
              <div className="space-y-2">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Forma de pagamento</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {([
                      { method: 'dinheiro' as PaymentMethod, label: 'Dinheiro', icon: DollarSign },
                      { method: 'pix' as PaymentMethod, label: 'PIX', icon: Smartphone },
                      { method: 'cartao_credito' as PaymentMethod, label: 'Crédito', icon: CreditCard },
                      { method: 'cartao_debito' as PaymentMethod, label: 'Débito', icon: Wallet },
                    ]).map(({ method, label, icon: Icon }) => (
                      <button
                        key={method}
                        onClick={() => setDebtPaymentMethod(method)}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all text-xs ${
                          debtPaymentMethod === method
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-border hover:border-muted-foreground/30 text-muted-foreground'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="font-medium">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <input className="input-pdv flex-1" type="number" step="0.01" min="0"
                    value={paymentAmount || ''} onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)} placeholder="Valor pago" />
                  <button onClick={handlePayment} disabled={paymentAmount <= 0} className="btn-pdv-primary !px-4">Parcial</button>
                  <button onClick={handlePayFull} className="px-4 py-2 rounded-lg bg-success text-success-foreground font-medium hover:bg-success/90 transition-all active:scale-95">Quitar Tudo</button>
                </div>
                <button onClick={() => handleOpenWhatsApp(selectedCustomer)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-success/10 text-success font-medium hover:bg-success/20 transition-all active:scale-[0.97]">
                  <MessageCircle className="w-5 h-5" /> Cobrar via WhatsApp
                </button>
              </div>
            )}

            {/* Sales history */}
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Compras Fiado</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {getCustomerSales(selectedCustomer.id).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma compra fiado</p>
                ) : (
                  getCustomerSales(selectedCustomer.id).map(s => (
                    <div key={s.id} className="p-2.5 rounded-lg bg-muted/30 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{formatDate(s.createdAt)}</span>
                        <span className="font-bold tabular-nums">{maskCard(formatCurrency(s.fiadoAmount ?? s.total))}</span>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {s.items.map((item, i) => (
                          <div key={i} className="flex justify-between">
                            <span>{item.productName} × {item.quantity}</span>
                            <span className="tabular-nums">{maskCard(formatCurrency(item.subtotal))}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Payments history */}
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Pagamentos</h4>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {getCustomerPayments(selectedCustomer.id).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum pagamento registrado</p>
                ) : (
                  getCustomerPayments(selectedCustomer.id).map(p => (
                    <div key={p.id} className="flex justify-between text-sm px-2 py-1.5 rounded bg-success/5">
                      <span className="text-muted-foreground">{formatDate(p.createdAt)}</span>
                      <span className="font-medium text-success tabular-nums">+{maskCard(formatCurrency(p.amount))}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp message editor modal */}
      {showWhatsApp && whatsAppCustomer && (
        <div className="fixed inset-0 bg-foreground/30 z-[60] flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowWhatsApp(false)}>
          <div className="card-pdv p-6 w-full max-w-md space-y-4 animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2"><MessageCircle className="w-5 h-5 text-success" /> Cobrar via WhatsApp</h3>
              <button onClick={() => setShowWhatsApp(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-muted-foreground">
              Para: <span className="font-medium text-foreground">{whatsAppCustomer.name}</span>
              {whatsAppCustomer.phone && <span> • {whatsAppCustomer.phone}</span>}
            </p>
            <div>
              <label className="text-sm font-medium mb-1 block">Mensagem</label>
              <textarea className="input-pdv !text-sm min-h-[140px] resize-y" value={whatsAppMessage} onChange={e => setWhatsAppMessage(e.target.value)} />
            </div>
            {!whatsAppCustomer.phone && <p className="text-sm text-destructive">⚠ Cliente sem telefone cadastrado.</p>}
            <button onClick={handleSendWhatsApp} disabled={!whatsAppCustomer.phone} className="btn-pdv-primary w-full !bg-success">
              <Send className="w-5 h-5" /> Abrir WhatsApp
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
