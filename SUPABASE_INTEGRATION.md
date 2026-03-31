# INTEGRAÇÃO SUPABASE - GUIA COMPLETO

## 🚀 SETUP INICIAL

### 1. Criar Projeto Supabase
- Acesse https://app.supabase.com/
- Clique em "New Project"
- Preencha os dados (nome, senha do banco)
- Aguarde a criação (5-10 min)

### 2. Executar SQL Schema
Na aba "SQL Editor" do Supabase:
1. Copie TODO o conteúdo de `SUPABASE_SCHEMA.sql`
2. Execute o script

Isso criará:
- Todas as tabelas
- Índices para performance
- RLS (Row Level Security)
- Views úteis para relatórios

### 3. Copiar Credenciais
Em "Project Settings" > "API":
- Copie `URL` do projeto
- Copie `anon public` key

### 4. Configurar Environment Variables
```bash
# Copie .env.example para .env.local
cp .env.example .env.local

# Preencha com suas credenciais
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima
```

### 5. Inicializar Sistema
Edite `src/main.tsx`:
```typescript
import { initializeSync } from '@/lib/supabase/sync'

// No startup do app:
initializeSync()
```

---

## 🔄 COMO FUNCIONA

### Arquitetura Hybrid (Offline-First)
```
┌─────────────────────────────────────────┐
│          Frontend React                  │
│     (continua funcionando igual)        │
│  ✓ Sem mudanças nas páginas            │
│  ✓ Sem mudanças nos componentes        │
└─────────────────────────────────────────┘
           ↓ getProducts()
           ↓ saveSale()
           ↓ etc...
┌─────────────────────────────────────────┐
│        src/lib/store.ts (LOCAL)         │
│   - Lê/escreve em localStorage          │
│   - Rápido (offline funciona)           │
│   - Chama sync() em background          │
└─────────────────────────────────────────┘
           ↓ sync em background
┌─────────────────────────────────────────┐
│    src/lib/supabase/services/         │
│   (Sincronização com backend)           │
│   - Supabase Database                   │
│   - RLS protection (cada user seus dados)
│   - Backup automático                   │
│   - Multi-device sync                   │
└─────────────────────────────────────────┘
```

### Timeline de Uma Venda
```
1. Usuário clica "Finalizar Venda"
   ↓
2. saveSale() em store.ts
   ├─ Salva em localStorage (INSTANT)
   ├─ Retorna sucesso ao usuário
   └─ Chama saveSaleToSupabase() em background
   
3. saveSaleToSupabase() (5-30s depois)
   ├─ Cria sales registro
   ├─ Cria sale_items
   ├─ Cria sale_payments
   └─ Atualiza estoque
   
4. Dados persistidos:
   - LocalStorage: para usar offline
   - Supabase: para sincronizar entre devices
```

---

## 🛠️ INTEGRAÇÃO COM CÓDIGO EXISTENTE

### SEM MUDANÇAS NECESSÁRIAS!

O código existente continua funcionando:
```typescript
// Isso já funciona normalmente
import { getProducts, saveSale } from '@/lib/store'

const products = getProducts()  // Lê localStorage
saveSale(saleData)              // Escreve localStorage + sync Supabase
```

### SE QUISER USAR SUPABASE DIRETAMENTE (opcional)

Para features que precisam dados do backend:
```typescript
import { getSalesFromSupabase } from '@/lib/supabase/services/sales'

// Buscar vendas do backend (útil para multi-device)
const salesFromBackend = await getSalesFromSupabase()
```

---

## 📊 DADOS PERSISTIDOS

### Tabelas Principais

#### products
```
id: UUID (chave primária)
user_id: UUID (multi-tenant)
code: string
barcode: string (opcional)
name: string
price: decimal
cost: decimal
stock: decimal (kg ou unidade)
unit: 'un' | 'kg' | 'lt'
min_stock: decimal
expiry_date: date (opcional)
created_at: timestamp
updated_at: timestamp
```

#### sales
```
id: UUID
user_id: UUID (multi-tenant)
customer_id: UUID (referência)
customer_name: string
total: decimal
fiado_amount: decimal
payment_method: string (deprecated)
created_at: timestamp
```

#### sale_items
```
id: UUID
sale_id: UUID (FK)
product_id: UUID (FK)
product_name: string
quantity: decimal
unit_price: decimal
subtotal: decimal
discount: decimal (%)
```

#### sale_payments
```
id: UUID
sale_id: UUID (FK)
method: 'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito' | 'fiado'
amount: decimal
```

Idem para:
- **customers**: clientes com limites de crédito
- **debt_payments**: pagamentos de dívida
- **stock_entries**: movimentações de estoque
- **cash_registers**: abertura/fechamento de caixas
- **sale_adjustments**: ajustes de venda
- **system_config**: configurações por usuário

---

## 🔐 SEGURANÇA (RLS)

Cada tabela tem políticas que garantem:
- User vê apenas seus dados
- Inserção validada por user_id
- Update/Delete apenas do próprio user

Exemplo de política:
```sql
CREATE POLICY "Users can view their own products" ON products
  FOR SELECT USING (auth.uid() = user_id);
```

---

## 🚦 ESTADOS DO SISTEMA

### Modo Local (sem Supabase)
- ✅ Funciona 100%
- ✅ Todos os dados em localStorage
- ❌ Sem sincronização entre devices
- ❌ Sem backup automático
- ❌ Perde dados ao desinstalar app

### Modo Hybrid (com Supabase)
- ✅ Funciona 100% (mesmo sem internet)
- ✅ Sincroniza quando online
- ✅ Backup automático
- ✅ Multi-device sync
- ✅ Preparado para SaaS
- ✅ Auditoria com timestamps

---

## 📈 PRÓXIMOS PASSOS PARA SAAS

Com essa estrutura pronta:

1. **Autenticação**
   - Adicionar login/logout
   - Criar usuários programaticamente
   - Validar token JWT

2. **Multi-Tenant**
   - Dados já separados por user_id
   - Apenas adicionar gestão de workspaces

3. **Planos**
   - Limitar produtos por plano
   - Limitar usuários por plano
   - Limitar armazenamento

4. **Dashboard Admin**
   - Gerenciar usuários
   - Ver estatísticas
   - Cobrar via Stripe

5. **API Pública**
   - Integração com sistemas externos
   - Webhooks para eventos
   - GraphQL (opcional)

---

## 🐛 TROUBLESHOOTING

### "Supabase não está configurado"
- Verifique `.env.local`
- Confirme URLs e keys
- Restart deve ser feito após mudar .env

### "Erro ao sincronizar"
- Verifique internet
- Confirme que RLS policies estão ativas
- Veja console do navegador (F12)

### "Dados não aparecem no Supabase"
- Confirme que está logado em auth.supabase.com
- Verifique a aba "Authentication" > Users
- Confirme RLS policies via SQL Editor

### "Erro de CORS"
- Adicione seu domínio em "Settings" > "API"
- Em localhost, geralmente funciona automaticamente

---

## 📝 CHECKLIST DE DEPLOYMENT

- [ ] Supabase projeto criado
- [ ] SQL schema executado
- [ ] Credenciais copiadas para `.env.local`
- [ ] Testar modo local
- [ ] Testar sincronização
- [ ] Testar RLS (logar com user diferente)
- [ ] Testar offline (desativar internet)
- [ ] Testar multi-device (abrir em outro navegador)
- [ ] Backup configurado no Supabase
- [ ] Deploy em produção

---

## 📞 SUPORTE

Se precisar, consulte:
- https://supabase.com/docs
- https://supabase.com/docs/guides/database/overview
- Console do navegador (F12) para erros
