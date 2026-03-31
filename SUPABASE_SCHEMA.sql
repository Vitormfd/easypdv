-- ============================================================================
-- SCHEMA SQL SUPABASE - Easy PDV
-- Tabelas com multi-tenant pronto para SaaS
-- ============================================================================

-- Extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABELAS DE NEGÓCIO
-- ============================================================================

-- 1. PRODUTOS
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  code TEXT NOT NULL,
  barcode TEXT,
  name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
  stock DECIMAL(10, 3) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'un', -- 'un' | 'kg' | 'lt'
  min_stock DECIMAL(10, 3) NOT NULL DEFAULT 0,
  expiry_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, code)
);

CREATE INDEX idx_products_user_id ON products(user_id);
CREATE INDEX idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_products_name ON products(user_id, name);

-- 2. CLIENTES
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  cpf TEXT UNIQUE,
  notes TEXT,
  credit_limit DECIMAL(10, 2),
  monthly_limit DECIMAL(10, 2),
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'blocked'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_user_id ON customers(user_id);
CREATE INDEX idx_customers_cpf ON customers(cpf) WHERE cpf IS NOT NULL;
CREATE INDEX idx_customers_phone ON customers(phone) WHERE phone IS NOT NULL;

-- 3. VENDAS
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  total DECIMAL(10, 2) NOT NULL,
  fiado_amount DECIMAL(10, 2) DEFAULT 0,
  payment_method TEXT NOT NULL, -- DEPRECATED, use sale_payments
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sales_user_id ON sales(user_id);
CREATE INDEX idx_sales_customer_id ON sales(customer_id);
CREATE INDEX idx_sales_created_at ON sales(user_id, created_at);

-- 4. ITENS DA VENDA
CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  quantity DECIMAL(10, 3) NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  discount DECIMAL(5, 2) DEFAULT 0, -- percentage 0-100
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product_id ON sale_items(product_id);

-- 5. PAGAMENTOS DE VENDA
CREATE TABLE IF NOT EXISTS sale_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  method TEXT NOT NULL, -- 'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito' | 'fiado'
  amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sale_payments_sale_id ON sale_payments(sale_id);

-- 6. PAGAMENTOS DE DÍVIDA
CREATE TABLE IF NOT EXISTS debt_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  amount DECIMAL(10, 2) NOT NULL,
  payment_method TEXT, -- 'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_debt_payments_user_id ON debt_payments(user_id);
CREATE INDEX idx_debt_payments_customer_id ON debt_payments(customer_id);

-- 7. ENTRADAS DE ESTOQUE
CREATE TABLE IF NOT EXISTS stock_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity DECIMAL(10, 3) NOT NULL,
  type TEXT NOT NULL DEFAULT 'entrada', -- 'entrada' | 'saida' | 'ajuste'
  reason TEXT, -- motivo do ajuste
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_entries_user_id ON stock_entries(user_id);
CREATE INDEX idx_stock_entries_product_id ON stock_entries(product_id);
CREATE INDEX idx_stock_entries_created_at ON stock_entries(user_id, created_at);

-- 8. AJUSTES DE VENDA
CREATE TABLE IF NOT EXISTS sale_adjustments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  previous_total DECIMAL(10, 2) NOT NULL,
  new_total DECIMAL(10, 2) NOT NULL,
  difference DECIMAL(10, 2) NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sale_adjustments_user_id ON sale_adjustments(user_id);
CREATE INDEX idx_sale_adjustments_sale_id ON sale_adjustments(sale_id);

-- 9. ITENS DO AJUSTE DE VENDA
CREATE TABLE IF NOT EXISTS adjustment_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  adjustment_id UUID NOT NULL REFERENCES sale_adjustments(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  quantity DECIMAL(10, 3) NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  discount DECIMAL(5, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_adjustment_items_adjustment_id ON adjustment_items(adjustment_id);

-- 10. PAGAMENTOS DO AJUSTE
CREATE TABLE IF NOT EXISTS adjustment_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  adjustment_id UUID NOT NULL REFERENCES sale_adjustments(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_adjustment_payments_adjustment_id ON adjustment_payments(adjustment_id);

-- 11. CAIXA (CASH REGISTER)
CREATE TABLE IF NOT EXISTS cash_registers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE,
  opening_amount DECIMAL(10, 2) NOT NULL,
  closing_amount DECIMAL(10, 2),
  expected_amount DECIMAL(10, 2),
  difference DECIMAL(10, 2),
  total_sales DECIMAL(10, 2) DEFAULT 0,
  total_dinheiro DECIMAL(10, 2) DEFAULT 0,
  total_pix DECIMAL(10, 2) DEFAULT 0,
  total_cartao DECIMAL(10, 2) DEFAULT 0,
  total_fiado DECIMAL(10, 2) DEFAULT 0,
  sales_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'closed'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cash_registers_user_id ON cash_registers(user_id);
CREATE INDEX idx_cash_registers_status ON cash_registers(user_id, status);
CREATE INDEX idx_cash_registers_opened_at ON cash_registers(user_id, opened_at);

-- ============================================================================
-- TABELAS AUXILIARES (SaaS/Admin)
-- ============================================================================

-- 12. CONFIGURAÇÃO DO SISTEMA (por usuário)
CREATE TABLE IF NOT EXISTS system_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE,
  system_name TEXT DEFAULT 'EasyPDV',
  auto_print_enabled BOOLEAN DEFAULT FALSE,
  print_config JSONB DEFAULT '{"showLogo":true,"headerText":"","footerText":"Obrigado!","showCustomer":true,"showPaymentDetails":true,"showDate":true,"fontSize":12}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_system_config_user_id ON system_config(user_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE debt_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE adjustment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE adjustment_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança: cada usuário vê apenas seus dados
CREATE POLICY "Users can view their own products" ON products
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own products" ON products
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own products" ON products
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own products" ON products
  FOR DELETE USING (auth.uid() = user_id);

-- Aplicar mesmo padrão para outras tabelas
CREATE POLICY "Users can view their own customers" ON customers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own customers" ON customers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own customers" ON customers
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own customers" ON customers
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own sales" ON sales
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sales" ON sales
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sales" ON sales
  FOR UPDATE USING (auth.uid() = user_id);

-- sale_items herdadas da sale
CREATE POLICY "Users can view sale items from their sales" ON sale_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sales WHERE sales.id = sale_items.sale_id AND sales.user_id = auth.uid())
  );

CREATE POLICY "Users can insert sale items to their sales" ON sale_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM sales WHERE sales.id = sale_items.sale_id AND sales.user_id = auth.uid())
  );

-- Idem para outras tabelas que referenciam sales ou products/customers
CREATE POLICY "Users can view sale payments from their sales" ON sale_payments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sales WHERE sales.id = sale_payments.sale_id AND sales.user_id = auth.uid())
  );

CREATE POLICY "Users can insert sale payments to their sales" ON sale_payments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM sales WHERE sales.id = sale_payments.sale_id AND sales.user_id = auth.uid())
  );

CREATE POLICY "Users can view their own debt payments" ON debt_payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own debt payments" ON debt_payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own stock entries" ON stock_entries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stock entries" ON stock_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own sale adjustments" ON sale_adjustments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sale adjustments" ON sale_adjustments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- adjustment_items herdadas do adjustment
CREATE POLICY "Users can view adjustment items from their adjustments" ON adjustment_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sale_adjustments WHERE sale_adjustments.id = adjustment_items.adjustment_id AND sale_adjustments.user_id = auth.uid())
  );

CREATE POLICY "Users can insert adjustment items to their adjustments" ON adjustment_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM sale_adjustments WHERE sale_adjustments.id = adjustment_items.adjustment_id AND sale_adjustments.user_id = auth.uid())
  );

CREATE POLICY "Users can view adjustment payments from their adjustments" ON adjustment_payments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sale_adjustments WHERE sale_adjustments.id = adjustment_payments.adjustment_id AND sale_adjustments.user_id = auth.uid())
  );

CREATE POLICY "Users can insert adjustment payments to their adjustments" ON adjustment_payments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM sale_adjustments WHERE sale_adjustments.id = adjustment_payments.adjustment_id AND sale_adjustments.user_id = auth.uid())
  );

CREATE POLICY "Users can view their own cash registers" ON cash_registers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cash registers" ON cash_registers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cash registers" ON cash_registers
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own config" ON system_config
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own config" ON system_config
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own config" ON system_config
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================================
-- FUNÇÕES AUXILIARES
-- ============================================================================

-- Função para atualizar timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para products
CREATE TRIGGER trigger_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Trigger para customers
CREATE TRIGGER trigger_customers_updated_at
BEFORE UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Trigger para sales
CREATE TRIGGER trigger_sales_updated_at
BEFORE UPDATE ON sales
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Trigger para system_config
CREATE TRIGGER trigger_system_config_updated_at
BEFORE UPDATE ON system_config
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- VIEWS ÚTEIS
-- ============================================================================

-- View: Vendas com itens (denormalizados para relatórios)
CREATE OR REPLACE VIEW v_sales_detailed AS
SELECT 
  s.id,
  s.user_id,
  s.customer_id,
  s.customer_name,
  s.total,
  s.fiado_amount,
  s.created_at,
  json_agg(json_build_object(
    'product_id', si.product_id,
    'product_name', si.product_name,
    'quantity', si.quantity,
    'unit_price', si.unit_price,
    'subtotal', si.subtotal,
    'discount', si.discount
  )) as items,
  json_agg(json_build_object(
    'method', sp.method,
    'amount', sp.amount
  )) FILTER (WHERE sp.id IS NOT NULL) as payments
FROM sales s
LEFT JOIN sale_items si ON s.id = si.sale_id
LEFT JOIN sale_payments sp ON s.id = sp.sale_id
GROUP BY s.id, s.user_id, s.customer_id, s.customer_name, s.total, s.fiado_amount, s.created_at;

-- View: Dívida por cliente
CREATE OR REPLACE VIEW v_customer_debt AS
SELECT 
  c.id,
  c.user_id,
  c.name,
  COALESCE(SUM(s.fiado_amount), 0) as total_debt,
  COALESCE(SUM(dp.amount), 0) as total_paid,
  COALESCE(SUM(s.fiado_amount), 0) - COALESCE(SUM(dp.amount), 0) as remaining_debt
FROM customers c
LEFT JOIN sales s ON c.id = s.customer_id AND s.fiado_amount > 0
LEFT JOIN debt_payments dp ON c.id = dp.customer_id
GROUP BY c.id, c.user_id, c.name;

-- View: Estoque por produto
CREATE OR REPLACE VIEW v_stock_summary AS
SELECT 
  p.id,
  p.user_id,
  p.code,
  p.name,
  p.stock,
  p.min_stock,
  CASE WHEN p.stock <= p.min_stock THEN 'baixo' ELSE 'ok' END as status
FROM products p
ORDER BY p.stock ASC;
