import { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Check, AlertTriangle } from 'lucide-react';
import { read, utils } from 'xlsx';
import type { CustomerStatus } from '@/types/pdv';
import { saveCustomer, getCustomers, saveSale } from '@/lib/store';
import { formatCurrency } from '@/lib/format';
import { toast } from 'sonner';

interface ImportRow {
  name: string;
  phone: string;
  address: string;
  cpf: string;
  notes: string;
  creditLimit: number;
  debt: number;
  status: CustomerStatus;
  valid: boolean;
  error?: string;
}

interface Props {
  onDone: () => void;
}

const COLUMN_MAP: Record<string, keyof ImportRow> = {
  'nome': 'name', 'cliente': 'name', 'name': 'name', 'razao_social': 'name', 'razao': 'name',
  'telefone': 'phone', 'phone': 'phone', 'celular': 'phone', 'tel': 'phone', 'fone': 'phone', 'whatsapp': 'phone',
  'endereco': 'address', 'endereço': 'address', 'address': 'address', 'rua': 'address', 'logradouro': 'address',
  'cpf': 'cpf', 'cnpj': 'cpf', 'documento': 'cpf', 'doc': 'cpf',
  'observacao': 'notes', 'observacoes': 'notes', 'obs': 'notes', 'notas': 'notes', 'notes': 'notes',
  'limite': 'creditLimit', 'limite_credito': 'creditLimit', 'credit_limit': 'creditLimit',
  'debito': 'debt', 'divida': 'debt', 'saldo': 'debt', 'saldo_devedor': 'debt', 'devendo': 'debt',
  'credito': 'debt', 'fiado': 'debt', 'debt': 'debt', 'balance': 'debt', 'pendente': 'debt',
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

export default function ImportCustomers({ onDone }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [importing, setImporting] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = read(evt.target?.result, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = utils.sheet_to_json<Record<string, any>>(sheet);

        if (json.length === 0) { toast.error('Planilha vazia'); return; }

        const headers = Object.keys(json[0]);
        const mapping: Record<string, keyof ImportRow> = {};
        headers.forEach(h => {
          const norm = normalizeHeader(h);
          for (const [key, field] of Object.entries(COLUMN_MAP)) {
            if (norm === key || norm.includes(key)) { mapping[h] = field; break; }
          }
        });

        const existingNames = new Set(getCustomers().map(c => c.name.toLowerCase()));

        const parsed: ImportRow[] = json.map((row) => {
          const r: Partial<ImportRow> = {};
          for (const [header, field] of Object.entries(mapping)) {
            const val = row[header];
            const strVal = (val != null && val !== '') ? String(val).trim() : '';
            if (field === 'name') r.name = strVal;
            else if (field === 'phone') r.phone = strVal;
            else if (field === 'address') r.address = strVal;
            else if (field === 'cpf') r.cpf = strVal;
            else if (field === 'notes') r.notes = strVal;
            else if (field === 'creditLimit') r.creditLimit = parseFloat(val) || 0;
            else if (field === 'debt') r.debt = parseFloat(val) || 0;
          }

          const item: ImportRow = {
            name: r.name || '',
            phone: r.phone || '',
            address: r.address || '',
            cpf: r.cpf || '',
            notes: r.notes || '',
            creditLimit: r.creditLimit || 0,
            debt: r.debt || 0,
            status: 'active',
            valid: true,
          };

          if (!item.name) { item.valid = false; item.error = 'Sem nome'; }
          else if (existingNames.has(item.name.toLowerCase())) { item.valid = false; item.error = 'Já existe'; }

          return item;
        });

        setRows(parsed);
        setStep('preview');
      } catch {
        toast.error('Erro ao ler planilha. Verifique o formato.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = () => {
    setImporting(true);
    const valid = rows.filter(r => r.valid);
    let count = 0;
    valid.forEach(r => {
      try {
        const customer = saveCustomer({
          name: r.name,
          phone: r.phone,
          address: r.address || undefined,
          cpf: r.cpf || undefined,
          notes: r.notes || undefined,
          creditLimit: r.creditLimit || undefined,
          status: 'active',
        });

        // Register initial debt as a fiado sale with past date to avoid polluting today's sales
        if (r.debt > 0) {
          saveSale({
            items: [{ productId: 'import', productName: 'Saldo importado (importação)', quantity: 1, unitPrice: r.debt, subtotal: r.debt }],
            total: r.debt,
            payments: [{ method: 'fiado', amount: r.debt }],
            paymentMethod: 'fiado',
            customerId: customer.id,
            customerName: customer.name,
            fiadoAmount: r.debt,
            createdAt: '2000-01-01T00:00:00.000Z',
          });
        }

        count++;
      } catch { /* skip */ }
    });
    const debtCount = valid.filter(r => r.debt > 0).length;
    const msg = debtCount > 0
      ? `${count} cliente(s) importado(s), ${debtCount} com saldo devedor!`
      : `${count} cliente(s) importado(s) com sucesso!`;
    toast.success(msg);
    setStep('done');
    setImporting(false);
    onDone();
  };

  const validCount = rows.filter(r => r.valid).length;
  const invalidCount = rows.filter(r => !r.valid).length;
  const totalDebt = rows.filter(r => r.valid).reduce((a, r) => a + r.debt, 0);

  if (step === 'upload') {
    return (
      <div className="space-y-4 text-center py-8">
        <FileSpreadsheet className="w-16 h-16 mx-auto text-primary opacity-60" />
        <div>
          <h3 className="text-lg font-bold">Importar Clientes de Planilha</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Envie um arquivo <strong>.xlsx</strong> com a coluna: Nome
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Colunas opcionais: Telefone, Endereço, CPF/CNPJ, Observações, Débito/Saldo Devedor, Limite de Crédito
          </p>
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
        <button onClick={() => fileRef.current?.click()} className="btn-pdv-primary !text-base !py-3 mx-auto">
          <Upload className="w-5 h-5" /> Selecionar Planilha
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Pré-visualização da Importação</h3>
        <div className="flex items-center gap-3 text-sm">
          {validCount > 0 && (
            <span className="inline-flex items-center gap-1 text-success font-medium">
              <Check className="w-4 h-4" /> {validCount} válidos
            </span>
          )}
          {invalidCount > 0 && (
            <span className="inline-flex items-center gap-1 text-destructive font-medium">
              <AlertTriangle className="w-4 h-4" /> {invalidCount} com erro
            </span>
          )}
          {totalDebt > 0 && (
            <span className="inline-flex items-center gap-1 text-warning font-medium">
              Débitos: {formatCurrency(totalDebt)}
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border max-h-[50vh] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border bg-muted/80">
              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Nome</th>
              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Telefone</th>
              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">CPF/CNPJ</th>
              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Obs.</th>
              <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Débito</th>
              <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r, i) => (
              <tr key={i} className={r.valid ? '' : 'bg-destructive/5'}>
                <td className="px-3 py-2">{r.name || '—'}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.phone || '—'}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.cpf || '—'}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.notes || '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.debt > 0 ? <span className="text-destructive font-medium">{formatCurrency(r.debt)}</span> : '—'}
                </td>
                <td className="px-3 py-2 text-center">
                  {r.valid ? (
                    <Check className="w-4 h-4 text-success mx-auto" />
                  ) : (
                    <span className="text-xs text-destructive">{r.error}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-3 justify-end">
        <button onClick={() => { setRows([]); setStep('upload'); }} className="px-4 py-2 rounded-xl border border-border text-sm hover:bg-muted transition-colors">
          Cancelar
        </button>
        <button onClick={handleImport} disabled={validCount === 0 || importing} className="btn-pdv-primary">
          <Check className="w-4 h-4" /> Importar {validCount} cliente(s)
        </button>
      </div>
    </div>
  );
}
