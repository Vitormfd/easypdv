import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Search, Plus, Minus, Trash2, ShoppingCart, DollarSign, Smartphone, CreditCard, BookOpen, Check, Wallet, AlertTriangle, Printer, PlusCircle, Percent } from 'lucide-react';
import type { CartItem, PaymentMethod, PaymentEntry, Customer, ProductUnit } from '@/types/pdv';
import { getProducts, saveSale, getCustomers, getCustomerDebt, getOpenCashRegister, saveProduct, isAutoPrintEnabled, setAutoPrintEnabled as persistAutoPrintEnabled } from '@/lib/store';
import { formatCurrency, paymentMethodLabels } from '@/lib/format';
import { playSaleSound, playBeepSound } from '@/lib/sounds';
import { validateFiadoSale } from '@/lib/credit';
import { toast } from 'sonner';
import SalesHistory from '@/components/pdv/SalesHistory';
import CashRegisterBar from '@/components/pdv/CashRegisterBar';
import ReceiptPrint, { printReceipt } from '@/components/pdv/ReceiptPrint';
import type { Sale } from '@/types/pdv';

const paymentMethods: { method: PaymentMethod; label: string; icon: typeof DollarSign }[] = [
  { method: 'dinheiro', label: 'Dinheiro', icon: DollarSign },
  { method: 'pix', label: 'PIX', icon: Smartphone },
  { method: 'cartao_credito', label: 'Crédito', icon: CreditCard },
  { method: 'cartao_debito', label: 'Débito', icon: Wallet },
  { method: 'fiado', label: 'Fiado', icon: BookOpen },
];

export default function PDVPage() {
  const getInitialHideRegisterValues = () => localStorage.getItem('pdv_hide_cash_values') === 'true';
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [salesRefreshKey, setSalesRefreshKey] = useState(0);
  const [registerRefreshKey, setRegisterRefreshKey] = useState(0);
  const [hideRegisterValues, setHideRegisterValues] = useState(getInitialHideRegisterValues);
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerSelect, setShowCustomerSelect] = useState(false);
  const [saleComplete, setSaleComplete] = useState(false);
  const [cashTendered, setCashTendered] = useState('');
  const [creditWarning, setCreditWarning] = useState<{ reasons: string[]; override: boolean } | null>(null);
  const [nextQuantity, setNextQuantity] = useState(1);
  const [quantityMode, setQuantityMode] = useState(false);
  const [quantityBuffer, setQuantityBuffer] = useState('');
  const [weightMode, setWeightMode] = useState(false);
  const [weightBuffer, setWeightBuffer] = useState('');
  const [nextWeight, setNextWeight] = useState(0);
  const [weightModalProduct, setWeightModalProduct] = useState<string | null>(null);
  const [weightModalInput, setWeightModalInput] = useState('');
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [autoPrintEnabled, setAutoPrintEnabledState] = useState(isAutoPrintEnabled());
  const [showQuickRegister, setShowQuickRegister] = useState(false);
  const [quickForm, setQuickForm] = useState({ name: '', price: 0, barcode: '', unit: 'un' as ProductUnit });
  const [customerSearch, setCustomerSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  const isOpen = !!getOpenCashRegister();

  const [productsData, setProductsData] = useState(() => getProducts());
  const [customersData, setCustomersData] = useState(() => getCustomers());
  const products = productsData;
  const customers = customersData;

  // Refresh products/customers when sales change (e.g., stock updated) 1
  useEffect(() => { setProductsData(getProducts()); }, [salesRefreshKey]);
  useEffect(() => { setCustomersData(getCustomers()); }, [salesRefreshKey]);
  useEffect(() => {
    const handleDataUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ key?: string }>;
      const key = customEvent.detail?.key;

      if (key === 'pdv_products') {
        setProductsData(getProducts());
      }
      if (key === 'pdv_customers') {
        setCustomersData(getCustomers());
      }
      if (key === 'pdv_sales' || key === 'pdv_sale_adjustments' || key === 'pdv_cash_registers') {
        setProductsData(getProducts());
        setCustomersData(getCustomers());
        setSalesRefreshKey(k => k + 1);
        setRegisterRefreshKey(k => k + 1);
      }
    };

    window.addEventListener('pdv:data-updated', handleDataUpdated as EventListener);
    return () => window.removeEventListener('pdv:data-updated', handleDataUpdated as EventListener);
  }, []);

  const filteredProducts = search.trim()
    ? products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.code.toLowerCase().includes(search.toLowerCase()) ||
        (p.barcode && p.barcode.trim().toLowerCase().includes(search.toLowerCase()))
      ).slice(0, 8)
    : [];

  const total = cart.reduce((acc, item) => acc + item.subtotal, 0);
  const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);
  const remaining = Math.max(0, +(total - totalPaid).toFixed(2));
  const hasFiado = payments.some(p => p.method === 'fiado');
  const fiadoAmount = payments.filter(p => p.method === 'fiado').reduce((a, p) => a + p.amount, 0);
  const cashPayment = payments.find(p => p.method === 'dinheiro');
  const cashTenderedNum = parseFloat(cashTendered) || 0;
  const cashChange = cashPayment ? Math.max(0, cashTenderedNum - cashPayment.amount) : 0;

  const addToCartWithQty = useCallback((productId: string, overrideWeight?: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    // For kg products: use overrideWeight, nextWeight (from = shortcut), or prompt modal
    if (product.unit === 'kg') {
      const weight = overrideWeight ?? (nextWeight > 0 ? nextWeight : 0);
      if (weight <= 0) {
        // Open weight modal
        setWeightModalProduct(productId);
        setWeightModalInput('');
        setSearch('');
        return;
      }
      const roundedWeight = Math.round(weight * 1000) / 1000;
      if (roundedWeight <= 0) { toast.error('Peso inválido'); return; }
      setCart(prev => {
        const existing = prev.find(i => i.product.id === productId);
        if (existing) {
          const newQty = Math.round((existing.quantity + roundedWeight) * 1000) / 1000;
          const base = newQty * existing.product.price;
          return prev.map(i =>
            i.product.id === productId
              ? { ...i, quantity: newQty, subtotal: +(base * (1 - existing.discount / 100)).toFixed(2) }
              : i
          );
        }
        return [...prev, { product, quantity: roundedWeight, discount: 0, subtotal: roundedWeight * product.price }];
      });
    } else {
      const qty = nextQuantity;
      setCart(prev => {
        const existing = prev.find(i => i.product.id === productId);
        if (existing) {
          const newQty = existing.quantity + qty;
          const base = newQty * existing.product.price;
          return prev.map(i =>
            i.product.id === productId
              ? { ...i, quantity: newQty, subtotal: +(base * (1 - existing.discount / 100)).toFixed(2) }
              : i
          );
        }
        return [...prev, { product, quantity: qty, discount: 0, subtotal: qty * product.price }];
      });
    }

    setLastAddedId(productId);
    setTimeout(() => setLastAddedId(null), 600);
    playBeepSound();
    setSearch('');
    setNextQuantity(1);
    setQuantityMode(false);
    setQuantityBuffer('');
    setNextWeight(0);
    setWeightMode(false);
    setWeightBuffer('');
    searchRef.current?.focus();
  }, [products, nextQuantity, nextWeight]);

  const addToCart = useCallback((productId: string) => {
    addToCartWithQty(productId);
  }, [addToCartWithQty]);

  const updateQuantity = (productId: string, qty: number) => {
    if (qty <= 0) {
      setCart(prev => prev.filter(i => i.product.id !== productId));
      return;
    }
    setCart(prev => prev.map(i =>
      i.product.id === productId
        ? { ...i, quantity: qty, subtotal: +(qty * i.product.price * (1 - i.discount / 100)).toFixed(2) }
        : i
    ));
  };

  const updateDiscount = (productId: string, discount: number) => {
    const d = Math.max(0, Math.min(100, discount));
    setCart(prev => prev.map(i =>
      i.product.id === productId
        ? { ...i, discount: d, subtotal: +(i.quantity * i.product.price * (1 - d / 100)).toFixed(2) }
        : i
    ));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(i => i.product.id !== productId));
  };

  const addPayment = (method: PaymentMethod) => {
    if (remaining <= 0) return;
    if (method === 'fiado') setShowCustomerSelect(true);
    setPayments(prev => {
      const existing = prev.find(p => p.method === method);
      if (existing) {
        return prev.map(p => p.method === method ? { ...p, amount: +(p.amount + remaining).toFixed(2) } : p);
      }
      return [...prev, { method, amount: +remaining.toFixed(2) }];
    });
  };

  const updatePaymentAmount = (method: PaymentMethod, amount: number) => {
    const maxAllowed = +(remaining + (payments.find(p => p.method === method)?.amount || 0)).toFixed(2);
    const clamped = Math.min(Math.max(0, amount), maxAllowed);
    setPayments(prev => prev.map(p => p.method === method ? { ...p, amount: clamped } : p));
  };

  const removePayment = (method: PaymentMethod) => {
    setPayments(prev => prev.filter(p => p.method !== method));
    if (method === 'fiado') {
      setShowCustomerSelect(false);
      setSelectedCustomer(null);
    }
  };

  const finalizeSale = () => {
    if (cart.length === 0 || remaining > 0.01) return;
    if (hasFiado && !selectedCustomer) {
      toast.error('Selecione um cliente para a parte fiado');
      return;
    }

    // Credit validation for fiado
    if (hasFiado && selectedCustomer && !creditWarning?.override) {
      const validation = validateFiadoSale(selectedCustomer, fiadoAmount);
      if (!validation.allowed) {
        setCreditWarning({ reasons: validation.reasons, override: false });
        return;
      }
      // Validation passed, clear warning and continue
      setCreditWarning(null);
    }

    const primaryMethod = payments.reduce((a, b) => a.amount >= b.amount ? a : b).method;

    const newSale = saveSale({
      items: cart.map(i => ({
        productId: i.product.id,
        productName: i.product.name,
        quantity: i.quantity,
        unitPrice: i.product.price,
        subtotal: i.subtotal,
      })),
      total,
      payments,
      paymentMethod: primaryMethod,
      customerId: hasFiado ? selectedCustomer?.id : undefined,
      customerName: hasFiado ? selectedCustomer?.name : undefined,
      fiadoAmount: hasFiado ? fiadoAmount : undefined,
    });

    setLastSale(newSale);
    setSaleComplete(true);
    playSaleSound();
    toast.success('Venda finalizada com sucesso!');
    setSalesRefreshKey(k => k + 1);
    setRegisterRefreshKey(k => k + 1);

    // Auto-print if enabled
    if (autoPrintEnabled) {
      setTimeout(() => printReceipt(receiptRef), 300);
    }

    setTimeout(() => {
      setCart([]);
      setPayments([]);
      setSelectedCustomer(null);
      setShowCustomerSelect(false);
      setSaleComplete(false);
      setCashTendered('');
      setCreditWarning(null);
      searchRef.current?.focus();
    }, 2000);
  };


  // Barcode scanner detection: rapid input ending with Enter
  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && search.trim()) {
      e.preventDefault();
      const query = search.trim();
      // Trim stored barcodes to avoid whitespace mismatches; case-insensitive code fallback
      const product =
        products.find(p => p.barcode?.trim() === query) ||
        products.find(p => p.code.toLowerCase() === query.toLowerCase());
      if (product) {
        addToCartWithQty(product.id);
      } else {
        // Fallback: if the search narrows down to exactly one product, add it
        const matches = products.filter(p =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.code.toLowerCase().includes(query.toLowerCase()) ||
          (p.barcode && p.barcode.trim().includes(query))
        );
        if (matches.length === 1) {
          addToCartWithQty(matches[0].id);
        } else {
          setQuickForm({ name: '', price: 0, barcode: query, unit: 'un' as ProductUnit });
          setShowQuickRegister(true);
        }
      }
      setSearch('');
    }
  }, [search, products, addToCartWithQty]);

  // Keyboard shortcuts with refs to avoid stale closures
  const cartRef = useRef(cart);
  const remainingRef = useRef(remaining);
  const finalizeSaleRef = useRef(finalizeSale);
  cartRef.current = cart;
  remainingRef.current = remaining;
  finalizeSaleRef.current = finalizeSale;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isSearchInput = target === searchRef.current;
      const isOtherInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

      if (e.key === 'F2') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'F4' && cartRef.current.length > 0 && remainingRef.current <= 0.01) { e.preventDefault(); finalizeSaleRef.current(); }

      // Weight mode shortcut: =
      if (e.key === '=' && (isSearchInput || !isOtherInput)) {
        e.preventDefault();
        setWeightMode(true);
        setWeightBuffer('');
        setNextWeight(0);
        setQuantityMode(false);
        setQuantityBuffer('');
        return;
      }

      if (e.key === '*' && (isSearchInput || !isOtherInput)) {
        e.preventDefault();
        setQuantityMode(true);
        setQuantityBuffer('');
        setWeightMode(false);
        setWeightBuffer('');
        return;
      }

      // Weight mode input: digits and dot
      if (weightMode) {
        if (/^\d$/.test(e.key) || (e.key === '.' && !weightBuffer.includes('.'))) {
          e.preventDefault();
          setWeightBuffer(prev => {
            const next = prev + e.key;
            setNextWeight(parseFloat(next) || 0);
            return next;
          });
          return;
        }
        if (e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault();
          if (e.key === 'Escape') {
            setNextWeight(0);
            setWeightMode(false);
            setWeightBuffer('');
          } else {
            setWeightMode(false);
            searchRef.current?.focus();
          }
          return;
        }
      }

      if (quantityMode) {
        if (/^\d$/.test(e.key)) {
          e.preventDefault();
          const now = Date.now();
          setQuantityBuffer(prev => {
            const next = prev + e.key;
            // If buffer reaches 4+ digits, it's likely a barcode scan
            // Redirect accumulated digits to search field
            if (next.length >= 4) {
              setNextQuantity(1);
              setQuantityMode(false);
              setSearch(next);
              setTimeout(() => searchRef.current?.focus(), 0);
              return '';
            }
            setNextQuantity(parseInt(next) || 1);
            return next;
          });
          return;
        }
        if (e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault();
          if (e.key === 'Escape') {
            setNextQuantity(1);
            setQuantityMode(false);
            setQuantityBuffer('');
          } else {
            setQuantityMode(false);
            searchRef.current?.focus();
          }
          return;
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [quantityMode, weightMode, weightBuffer]);

  useEffect(() => {
    localStorage.setItem('pdv_hide_cash_values', hideRegisterValues ? 'true' : 'false');
  }, [hideRegisterValues]);

  const handleQuickRegister = () => {
    if (!quickForm.name || quickForm.price <= 0) {
      toast.error('Preencha nome e preço');
      return;
    }
    const product = saveProduct({
      name: quickForm.name,
      code: quickForm.barcode || Date.now().toString().slice(-6),
      barcode: quickForm.barcode || undefined,
      price: quickForm.price,
      cost: 0,
      stock: 100,
      unit: quickForm.unit,
      minStock: 5,
    });
    setProductsData(getProducts());
    toast.success('Produto cadastrado!');
    setShowQuickRegister(false);
    addToCartWithQty(product.id);
  };

  if (saleComplete && lastSale) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in-up">
        <div className="w-20 h-20 rounded-full bg-success flex items-center justify-center mb-4">
          <Check className="w-10 h-10 text-success-foreground" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Venda Finalizada!</h2>
        <p className="text-muted-foreground text-lg">{formatCurrency(total)}</p>
        <div className="text-sm text-muted-foreground mt-1 space-y-0.5 text-center">
          {payments.map(p => (
            <p key={p.method}>{paymentMethodLabels[p.method]}: {formatCurrency(p.amount)}</p>
          ))}
          {cashChange > 0 && <p className="text-primary font-semibold">Troco: {formatCurrency(cashChange)}</p>}
        </div>
        <button
          onClick={() => printReceipt(receiptRef)}
          className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-muted text-foreground font-medium hover:bg-muted/80 transition-all"
        >
          <Printer className="w-4 h-4" /> Imprimir Comprovante
        </button>
        {autoPrintEnabled && (
          <p className="text-xs text-muted-foreground mt-1">✓ Impressão automática ativada</p>
        )}
        <ReceiptPrint ref={receiptRef} sale={lastSale} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-4">
      {/* Cash Register Bar */}
      <CashRegisterBar
        refreshKey={registerRefreshKey}
        onStatusChange={() => setRegisterRefreshKey(k => k + 1)}
        hideValues={hideRegisterValues}
        onToggleHideValues={() => setHideRegisterValues(v => !v)}
      />

      {!isOpen ? (
        <div className="py-12 text-center text-muted-foreground">
          <ShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">Abra o caixa para começar a vender</p>
        </div>
      ) : (
      <div>
      {/* Weight indicator */}
      {(nextWeight > 0 || weightMode) && (
        <div className="flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-accent/15 border-2 border-accent/40 animate-fade-in mb-2">
          <span className="text-lg font-bold text-accent">
            ⚖ Peso atual: {weightMode && weightBuffer === '' ? '_' : nextWeight.toFixed(3)} kg
          </span>
          {weightMode && <span className="text-sm text-accent/70 animate-pulse">Digite o peso...</span>}
          <button onClick={() => { setNextWeight(0); setWeightMode(false); setWeightBuffer(''); }}
            className="text-xs text-accent hover:underline ml-2">Resetar</button>
        </div>
      )}

      {/* Quantity indicator */}
      {(nextQuantity > 1 || quantityMode) && !weightMode && (
        <div className="flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-secondary/15 border-2 border-secondary/40 animate-fade-in">
          <span className="text-lg font-bold text-secondary">
            Qtd atual: {quantityMode && quantityBuffer === '' ? '_' : nextQuantity}
          </span>
          {quantityMode && <span className="text-sm text-secondary/70 animate-pulse">Digite a quantidade...</span>}
          <button onClick={() => { setNextQuantity(1); setQuantityMode(false); setQuantityBuffer(''); }}
            className="text-xs text-secondary hover:underline ml-2">Resetar</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6">
        {/* Left: Product search + results */}
        <div className="lg:col-span-3 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Buscar ou bipar código (F2) • * = qtd • = = peso"
              className="input-pdv pl-12 !text-xl !py-4"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              autoFocus
            />
          </div>

          {filteredProducts.length > 0 && (
            <div className="card-pdv divide-y divide-border animate-fade-in">
              {filteredProducts.map(p => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 hover:bg-muted transition-colors text-left ${
                    lastAddedId === p.id ? 'bg-success/10' : ''
                  }`}
                >
                  <div>
                    <span className="font-medium text-base">{p.name}</span>
                    {p.unit === 'kg' && <span className="ml-1 text-xs bg-accent/15 text-accent px-1.5 py-0.5 rounded-full font-medium">⚖ kg</span>}
                    <span className="text-sm text-muted-foreground ml-2">#{p.code}</span>
                    {p.barcode && <span className="text-xs text-muted-foreground ml-1">⊟ {p.barcode}</span>}
                    {p.stock <= p.minStock && (
                      <span className="ml-2 text-xs bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full">
                        Estoque baixo
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-base">{formatCurrency(p.price)}{p.unit === 'kg' ? '/kg' : ''}</p>
                    <p className="text-xs text-muted-foreground">{p.stock} em estoque</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {search.trim() && filteredProducts.length === 0 && (
            <div className="card-pdv p-8 text-center text-muted-foreground">
              <p>Nenhum produto encontrado</p>
              <button onClick={() => { setQuickForm({ name: '', price: 0, barcode: search.trim(), unit: 'un' as ProductUnit }); setShowQuickRegister(true); }}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:brightness-110 transition-all">
                <PlusCircle className="w-4 h-4" /> Cadastrar Rapidamente
              </button>
            </div>
          )}

          {/* Multi-payment section */}
          {cart.length > 0 && (
            <div className="space-y-3 animate-fade-in-up">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Formas de Pagamento</h3>
              
              {/* Payment method buttons */}
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {paymentMethods.map(({ method, label, icon: Icon }) => {
                  const isActive = payments.some(p => p.method === method);
                  return (
                    <button
                      key={method}
                      onClick={() => addPayment(method)}
                      disabled={remaining <= 0 && !isActive}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all active:scale-95 ${
                        isActive
                          ? 'border-primary bg-primary/5'
                          : remaining <= 0
                            ? 'border-border opacity-40 cursor-not-allowed'
                            : 'border-border hover:border-muted-foreground/30'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className={`text-xs font-medium ${isActive ? 'text-primary' : 'text-foreground'}`}>{label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Active payments list */}
              {payments.length > 0 && (
                <div className="space-y-2">
                  {payments.map(p => (
                    <div key={p.method} className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                      <span className="text-sm font-medium flex-1">{paymentMethodLabels[p.method]}</span>
                      <span className="text-xs text-muted-foreground mr-1">R$</span>
                      <input
                        type="number"
                        value={p.amount === 0 ? '' : p.amount}
                        onChange={e => {
                          const val = e.target.value;
                          updatePaymentAmount(p.method, val === '' ? 0 : parseFloat(val) || 0);
                        }}
                        className="w-28 text-right text-sm font-bold bg-card border border-border rounded-lg px-3 py-2 tabular-nums"
                        min={0}
                        step={0.01}
                        placeholder="0,00"
                      />
                      <button
                        onClick={() => removePayment(p.method)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-destructive hover:bg-destructive/10 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {/* Cash change calculation */}
                  {cashPayment && (
                    <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                      <span className="text-sm font-medium flex-1">Valor recebido (dinheiro)</span>
                      <span className="text-xs text-muted-foreground mr-1">R$</span>
                      <input
                        type="number"
                        value={cashTendered}
                        onChange={e => setCashTendered(e.target.value)}
                        placeholder={cashPayment.amount.toFixed(2)}
                        className="w-28 text-right text-sm font-bold bg-card border border-border rounded-lg px-3 py-2 tabular-nums"
                        min={0}
                        step={0.01}
                      />
                      {cashChange > 0 && (
                        <span className="text-sm font-bold text-primary tabular-nums ml-1">
                          Troco: {formatCurrency(cashChange)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Summary bar */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted text-sm">
                    <span>Pago: <strong className="tabular-nums">{formatCurrency(totalPaid)}</strong></span>
                    {remaining > 0.01 ? (
                      <span className="text-destructive font-semibold tabular-nums">Falta: {formatCurrency(remaining)}</span>
                    ) : (
                      <span className="text-success font-semibold">✓ Valor completo</span>
                    )}
                  </div>
                </div>
              )}

              {/* Customer select for fiado */}
              {showCustomerSelect && (
                <div className="card-pdv p-4 space-y-2 animate-fade-in">
                  <p className="text-sm font-medium">Selecionar Cliente (fiado de {formatCurrency(fiadoAmount)}):</p>
                  {selectedCustomer?.notes && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20 animate-fade-in">
                      <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-warning">📝 {selectedCustomer.notes}</p>
                    </div>
                  )}
                  {customers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum cliente cadastrado. Vá em Clientes para cadastrar.</p>
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Buscar cliente..."
                          className="input-pdv pl-9 !py-2 !text-sm"
                          value={customerSearch}
                          onChange={e => setCustomerSearch(e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                        {customers.filter(c => c.status !== 'blocked')
                          .filter(c => !customerSearch.trim() || c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone?.includes(customerSearch))
                          .map(c => {
                          const debt = getCustomerDebt(c.id);
                          const limit = c.creditLimit;
                          const isOverLimit = limit != null && limit > 0 && debt >= limit;
                          return (
                            <button
                              key={c.id}
                              onClick={() => { setSelectedCustomer(c); setCreditWarning(null); }}
                              className={`text-left px-3 py-2 rounded-lg border transition-all text-sm ${
                                selectedCustomer?.id === c.id
                                  ? 'border-primary bg-primary/5'
                                  : isOverLimit
                                    ? 'border-destructive/40 bg-destructive/5 hover:bg-destructive/10'
                                    : 'border-border hover:bg-muted'
                              }`}
                            >
                              <span className="font-medium block">{c.name}</span>
                              {debt > 0 && (
                                <span className={`text-xs font-semibold ${isOverLimit ? 'text-destructive' : 'text-warning'}`}>
                                  ⚠ Deve {formatCurrency(debt)}
                                  {limit != null && limit > 0 && ` / Limite: ${formatCurrency(limit)}`}
                                </span>
                              )}
                              {c.notes && <span className="block text-[10px] text-muted-foreground truncate">📝 {c.notes}</span>}
                            </button>
                          );
                        })}
                        {customers.filter(c => c.status === 'blocked').length > 0 && (
                          <p className="text-xs text-muted-foreground col-span-full mt-1">
                            {customers.filter(c => c.status === 'blocked').length} cliente(s) bloqueado(s) oculto(s)
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Cart */}
        <div className="lg:col-span-2">
          <div className="card-pdv p-4 lg:sticky lg:top-24">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingCart className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold">Carrinho</h2>
              <span className="text-sm text-muted-foreground ml-auto">{cart.length} {cart.length === 1 ? 'item' : 'itens'}</span>
            </div>

            {cart.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Busque e adicione produtos</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[40vh] overflow-y-auto mb-4">
                {cart.map(item => (
                  <div key={item.product.id} className={`flex items-center gap-2 p-3 rounded-lg transition-all ${
                    lastAddedId === item.product.id ? 'bg-success/15 ring-2 ring-success/30' : 'bg-muted/50'
                  }`}>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.product.unit === 'kg'
                          ? `${item.quantity.toFixed(3)} kg × ${formatCurrency(item.product.price)}/kg`
                          : `${formatCurrency(item.product.price)} / ${item.product.unit}`
                        }
                        {item.discount > 0 && (
                          <span className="text-success ml-1">(-{item.discount}%)</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)} className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center hover:bg-muted active:scale-95 transition-all">
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.product.id, parseFloat(e.target.value) || 0)}
                        className="w-14 text-center text-sm font-medium bg-card border border-border rounded-lg py-1"
                        step={item.product.unit === 'un' ? 1 : 0.1}
                        min={0}
                      />
                      <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)} className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center hover:bg-muted active:scale-95 transition-all">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <Percent className="w-3 h-3 text-muted-foreground" />
                      <input
                        type="number"
                        value={item.discount || ''}
                        onChange={(e) => updateDiscount(item.product.id, parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="w-12 text-center text-sm bg-card border border-border rounded-lg py-1"
                        min={0}
                        max={100}
                      />
                    </div>
                    <p className="w-20 text-right font-bold text-sm tabular-nums">{formatCurrency(item.subtotal)}</p>
                    <button onClick={() => removeFromCart(item.product.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-destructive hover:bg-destructive/10 transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Total */}
            <div className="border-t border-border pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold">Total</span>
                <span className="text-2xl font-extrabold tabular-nums">{formatCurrency(total)}</span>
              </div>

              {/* Auto print toggle */}
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoPrintEnabled}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setAutoPrintEnabledState(checked);
                    persistAutoPrintEnabled(checked);
                  }}
                  className="rounded"
                />
                <Printer className="w-3.5 h-3.5" /> Imprimir ao finalizar
              </label>

              <button
                onClick={finalizeSale}
                disabled={cart.length === 0 || remaining > 0.01}
                className="btn-pdv-primary w-full !text-xl !py-5"
              >
                Finalizar Venda (F4)
              </button>

            </div>
          </div>
        </div>
      </div>

      {/* Sales History */}
      <div className="mt-6 border-t border-border pt-6">
        <SalesHistory refreshKey={salesRefreshKey} />
      </div>
      </div>
      )}

      {/* Credit warning modal */}
      {creditWarning && !creditWarning.override && (
        <div className="fixed inset-0 bg-foreground/30 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setCreditWarning(null)}>
          <div className="card-pdv p-6 w-full max-w-sm space-y-4 animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-warning" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Limite Ultrapassado</h3>
                <p className="text-sm text-muted-foreground">Cliente fora dos limites permitidos</p>
              </div>
            </div>
            <div className="space-y-2">
              {creditWarning.reasons.map((r, i) => (
                <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                  <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">{r}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setCreditWarning(null)} className="flex-1 px-4 py-3 rounded-lg bg-muted text-foreground font-medium hover:bg-muted/80 transition-all">
                Cancelar
              </button>
              <button onClick={() => { setCreditWarning({ ...creditWarning, override: true }); setTimeout(finalizeSale, 50); }}
                className="flex-1 px-4 py-3 rounded-lg bg-warning text-warning-foreground font-medium hover:bg-warning/90 transition-all">
                Permitir Mesmo Assim
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Register Modal */}
      {showQuickRegister && (
        <div className="fixed inset-0 bg-foreground/30 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowQuickRegister(false)}>
          <div className="card-pdv p-6 w-full max-w-sm space-y-4 animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold">Cadastro Rápido</h3>
            {quickForm.barcode && (
              <p className="text-sm text-muted-foreground">Código: <strong>{quickForm.barcode}</strong></p>
            )}
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Nome do Produto *</label>
                <input className="input-pdv" value={quickForm.name} onChange={e => setQuickForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Arroz 5kg" autoFocus />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Preço (R$) *</label>
                <input className="input-pdv" type="number" step="0.01" min="0" value={quickForm.price || ''} onChange={e => setQuickForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Tipo de venda</label>
                <select className="input-pdv" value={quickForm.unit} onChange={e => setQuickForm(f => ({ ...f, unit: e.target.value as ProductUnit }))}>
                  <option value="un">Unidade</option>
                  <option value="kg">Peso (kg)</option>
                  <option value="lt">Litro</option>
                </select>
              </div>
            </div>
            <button onClick={handleQuickRegister} className="btn-pdv-primary w-full">
              Cadastrar e Adicionar
            </button>
          </div>
        </div>
      )}

      {/* Weight Modal */}
      {weightModalProduct && (
        <div className="fixed inset-0 bg-foreground/30 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setWeightModalProduct(null)}>
          <div className="card-pdv p-6 w-full max-w-sm space-y-4 animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold">⚖ Digite o Peso (kg)</h3>
            <p className="text-sm text-muted-foreground">
              {products.find(p => p.id === weightModalProduct)?.name} — {formatCurrency(products.find(p => p.id === weightModalProduct)?.price || 0)}/kg
            </p>
            <input
              className="input-pdv !text-2xl text-center"
              type="number"
              step="0.001"
              min="0.001"
              placeholder="Ex: 1.500"
              value={weightModalInput}
              onChange={e => setWeightModalInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const w = parseFloat(weightModalInput);
                  if (w > 0) {
                    addToCartWithQty(weightModalProduct!, w);
                    setWeightModalProduct(null);
                    setWeightModalInput('');
                  } else {
                    toast.error('Digite um peso válido');
                  }
                }
              }}
              autoFocus
            />
            <button
              onClick={() => {
                const w = parseFloat(weightModalInput);
                if (w > 0) {
                  addToCartWithQty(weightModalProduct!, w);
                  setWeightModalProduct(null);
                  setWeightModalInput('');
                } else {
                  toast.error('Digite um peso válido');
                }
              }}
              className="btn-pdv-primary w-full"
            >
              Adicionar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
