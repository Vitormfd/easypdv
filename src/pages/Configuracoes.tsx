import { useState } from 'react';
import { Palette, Settings2, ArrowLeft, Check, Printer, Crown } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Link } from 'react-router-dom';
import { themes, getStoredThemeId, applyTheme } from '@/lib/themes';
import { isSoundEnabled, setSoundEnabled } from '@/lib/sounds';
import { getSystemName, setSystemName, isAutoPrintEnabled, setAutoPrintEnabled, isBackupOnCloseEnabled, setBackupOnCloseEnabled } from '@/lib/store';
import { getCurrentPlan, getPlanInfo } from '@/lib/plans';

export default function ConfiguracoesPage() {
  const [activeTheme, setActiveTheme] = useState(getStoredThemeId());
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const [autoPrint, setAutoPrint] = useState(isAutoPrintEnabled());
  const [backupOnClose, setBackupOnClose] = useState(isBackupOnCloseEnabled());
  const [storeName, setStoreName] = useState(getSystemName());

  const handleNameChange = (name: string) => {
    setStoreName(name);
    setSystemName(name);
  };

  const handleTheme = (id: string) => {
    applyTheme(id);
    setActiveTheme(id);
  };

  const toggleSound = (checked: boolean) => {
    setSoundOn(checked);
    setSoundEnabled(checked);
  };

  const toggleAutoPrint = (checked: boolean) => {
    setAutoPrint(checked);
    setAutoPrintEnabled(checked);
  };

  const toggleBackupOnClose = (checked: boolean) => {
    setBackupOnClose(checked);
    setBackupOnCloseEnabled(checked);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Link to="/" className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-muted transition-all">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Settings2 className="w-6 h-6 text-primary" /> Configurações
          </h2>
          <p className="text-sm text-muted-foreground">Personalize seu sistema</p>
        </div>
      </div>

      {/* Nome do sistema */}
      <div className="card-pdv p-5 space-y-3">
        <p className="font-semibold">🏪 Nome do Estabelecimento</p>
        <p className="text-sm text-muted-foreground">Aparece no topo do sistema e nos comprovantes</p>
        <input
          className="input-pdv"
          value={storeName}
          onChange={e => handleNameChange(e.target.value)}
          placeholder="Ex: EasyCleanPDV"
        />
      </div>

      {/* Som */}
      <div className="card-pdv p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">🔊 Som ao finalizar venda</p>
            <p className="text-sm text-muted-foreground">Toca um bipe de confirmação</p>
          </div>
          <Switch checked={soundOn} onCheckedChange={toggleSound} />
        </div>
      </div>

      {/* Impressão automática */}
      <div className="card-pdv p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">🖨️ Imprimir automaticamente ao finalizar</p>
            <p className="text-sm text-muted-foreground">O comprovante será impresso sem precisar clicar no botão</p>
          </div>
          <Switch checked={autoPrint} onCheckedChange={toggleAutoPrint} />
        </div>
      </div>

      {/* Layout de Impressão */}
      <Link to="/impressao" className="card-pdv p-5 flex items-center justify-between hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-3">
          <Printer className="w-5 h-5 text-primary" />
          <div>
            <p className="font-semibold">Layout de Impressão</p>
            <p className="text-sm text-muted-foreground">Configure o comprovante da impressora térmica</p>
          </div>
        </div>
        <ArrowLeft className="w-4 h-4 rotate-180 text-muted-foreground" />
      </Link>

      {/* Backup ao fechar caixa */}
      <div className="card-pdv p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">📊 Backup ao fechar caixa</p>
            <p className="text-sm text-muted-foreground">Mostrar opção de salvar backup em Excel ao fechar o caixa</p>
          </div>
          <Switch checked={backupOnClose} onCheckedChange={toggleBackupOnClose} />
        </div>
      </div>

      {/* Planos */}
      <Link to="/planos" className="card-pdv p-5 flex items-center justify-between hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-3">
          <Crown className="w-5 h-5 text-primary" />
          <div>
            <p className="font-semibold">Meu Plano</p>
            <p className="text-sm text-muted-foreground">
              Plano atual: {getPlanInfo(getCurrentPlan()).badge} {getPlanInfo(getCurrentPlan()).name}
            </p>
          </div>
        </div>
        <ArrowLeft className="w-4 h-4 rotate-180 text-muted-foreground" />
      </Link>
      {/* Temas */}
      <div className="card-pdv p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Palette className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-bold">Temas</h3>
        </div>
        <p className="text-sm text-muted-foreground">Escolha a aparência do sistema</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {themes.map(theme => {
            const isActive = activeTheme === theme.id;
            const bg = theme.colors.background;
            const primary = theme.colors.primary;
            const card = theme.colors.card;
            const fg = theme.colors.foreground;
            const muted = theme.colors.muted;

            return (
              <button
                key={theme.id}
                onClick={() => handleTheme(theme.id)}
                className={`relative text-left rounded-xl border-2 p-4 transition-all hover:scale-[1.02] ${
                  isActive ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-muted-foreground/30'
                }`}
              >
                {isActive && (
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 text-primary-foreground" />
                  </div>
                )}

                {/* Color preview */}
                <div className="flex gap-1.5 mb-3">
                  <div className="w-8 h-8 rounded-lg" style={{ background: `hsl(${bg})` }} />
                  <div className="w-8 h-8 rounded-lg" style={{ background: `hsl(${primary})` }} />
                  <div className="w-8 h-8 rounded-lg" style={{ background: `hsl(${card})` }} />
                  <div className="w-8 h-8 rounded-lg" style={{ background: `hsl(${fg})` }} />
                  <div className="w-8 h-8 rounded-lg" style={{ background: `hsl(${muted})` }} />
                </div>

                <p className="font-semibold text-sm">{theme.name}</p>
                <p className="text-xs text-muted-foreground">{theme.description}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
