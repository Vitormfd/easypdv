import { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, X, Check, AlertTriangle } from 'lucide-react';
import { read, utils } from 'xlsx';
import type { ProductUnit } from '@/types/pdv';
import { saveProduct, getProducts } from '@/lib/store';
import { toast } from 'sonner';

interface ImportRow {
  name: string;
  code: string;
  barcode?: string;
  price: number;
  cost: number;
  stock: number;
  unit: ProductUnit;
  minStock: number;
  valid: boolean;
  error?: string;
}

interface Props {
  onDone: () => void;
}

const COLUMN_MAP: Record<string, keyof ImportRow> = {
  'nome': 'name', 'produto': 'name', 'descricao': 'name', 'descrição': 'name', 'name': 'name',
  'codigo': 'code', 'código': 'code', 'cod': 'code', 'code': 'code', 'ref': 'code', 'referencia': 'code',
  'barras': 'barcode', 'cod_barras': 'barcode', 'ean': 'barcode', 'barcode': 'barcode', 'gtin': 'barcode',
  'preco': 'price', 'preço': 'price', 'price': 'price', 'valor': 'price', 'preco_venda': 'price',
  'custo': 'cost', 'cost': 'cost', 'preco_custo': 'cost',
  'estoque': 'stock', 'qtd': 'stock', 'quantidade': 'stock', 'stock': 'stock', 'saldo': 'stock',
  'unidade': 'unit', 'un': 'unit', 'unit': 'unit', 'tipo': 'unit',
  'minimo': 'minStock', 'min': 'minStock', 'estoque_minimo': 'minStock', 'min_stock': 'minStock',
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

function parseUnit(val: string | undefined): ProductUnit {
  if (!val) return 'un';
  const v = val.toLowerCase().trim();
  if (v === 'kg' || v.includes('quilo') || v.includes('peso')) return 'kg';
  if (v === 'lt' || v === 'l' || v.includes('litro')) return 'lt';
  return 'un';
}

export default function ImportProducts({ onDone }: Props) {
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

        const existingCodes = new Set(getProducts().map(p => p.code));

        const parsed: ImportRow[] = json.map((row) => {
          const r: Partial<ImportRow> = {};
          for (const [header, field] of Object.entries(mapping)) {
            const val = row[header];
            if (field === 'name') r.name = String(val || '').trim();
            else if (field === 'code') r.code = String(val || '').trim();
            else if (field === 'barcode') r.barcode = val ? String(val).trim() : undefined;
            else if (field === 'price') r.price = parseFloat(val) || 0;
            else if (field === 'cost') r.cost = parseFloat(val) || 0;
            else if (field === 'stock') r.stock = parseFloat(val) || 0;
            else if (field === 'unit') r.unit = parseUnit(String(val));
            else if (field === 'minStock') r.minStock = parseFloat(val) || 5;
          }

          const item: ImportRow = {
            name: r.name || '',
            code: r.code || '',
            barcode: r.barcode,
            price: r.price || 0,
            cost: r.cost || 0,
            stock: r.stock || 0,
            unit: r.unit || 'un',
            minStock: r.minStock ?? 5,
            valid: true,
          };

          if (!item.name) { item.valid = false; item.error = 'Sem nome'; }
          else if (!item.code) { item.valid = false; item.error = 'Sem código'; }
          else if (existingCodes.has(item.code)) { item.valid = false; item.error = 'Código já existe'; }
          else if (item.price <= 0) { item.valid = false; item.error = 'Sem preço'; }

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
        saveProduct({
          name: r.name, code: r.code, barcode: r.barcode || '',
          price: r.price, cost: r.cost, stock: r.stock,
          unit: r.unit, minStock: r.minStock, expiryDate: '',
        });
        count++;
      } catch { /* skip */ }
    });
    toast.success(`${count} produto(s) importado(s) com sucesso!`);
    setStep('done');
    setImporting(false);
    onDone();
  };

  const validCount = rows.filter(r => r.valid).length;
  const invalidCount = rows.filter(r => !r.valid).length;

  if (step === 'upload') {
    return (
      <div className="space-y-4 text-center py-8">
        <FileSpreadsheet className="w-16 h-16 mx-auto text-primary opacity-60" />
        <div>
          <h3 className="text-lg font-bold">Importar Produtos de Planilha</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Envie um arquivo <strong>.xlsx</strong> com as colunas: Nome, Código, Preço, Estoque
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Colunas opcionais: Custo, Código de Barras, Unidade (un/kg/lt), Estoque Mínimo
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
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border max-h-[50vh] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border bg-muted/80">
              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Nome</th>
              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Código</th>
              <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Preço</th>
              <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Estoque</th>
              <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Un.</th>
              <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r, i) => (
              <tr key={i} className={r.valid ? '' : 'bg-destructive/5'}>
                <td className="px-3 py-2">{r.name || '—'}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.code || '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums">R$ {r.price.toFixed(2)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.stock}</td>
                <td className="px-3 py-2 text-center">{r.unit}</td>
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
          <Check className="w-4 h-4" /> Importar {validCount} produto(s)
        </button>
      </div>
    </div>
  );
}
