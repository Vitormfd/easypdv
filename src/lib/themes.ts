export interface ThemeConfig {
  id: string;
  name: string;
  description: string;
  colors: {
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    muted: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    destructive: string;
    success: string;
    warning: string;
    border: string;
    input: string;
    ring: string;
  };
}

export const themes: ThemeConfig[] = [
  {
    id: 'padrao',
    name: '🌿 Padrão',
    description: 'Verde natural — o tema clássico',
    colors: {
      background: '40 20% 97%',
      foreground: '30 10% 15%',
      card: '0 0% 100%',
      cardForeground: '30 10% 15%',
      primary: '142 50% 38%',
      primaryForeground: '0 0% 100%',
      secondary: '35 80% 52%',
      secondaryForeground: '0 0% 100%',
      muted: '40 15% 92%',
      mutedForeground: '30 8% 50%',
      accent: '210 60% 50%',
      accentForeground: '0 0% 100%',
      destructive: '0 65% 52%',
      success: '142 50% 38%',
      warning: '35 80% 52%',
      border: '35 15% 85%',
      input: '35 15% 85%',
      ring: '142 50% 38%',
    },
  },
  {
    id: 'noturno',
    name: '🌙 Noturno',
    description: 'Escuro e suave para trabalhar à noite',
    colors: {
      background: '220 20% 10%',
      foreground: '220 10% 90%',
      card: '220 18% 14%',
      cardForeground: '220 10% 90%',
      primary: '210 70% 55%',
      primaryForeground: '0 0% 100%',
      secondary: '45 80% 55%',
      secondaryForeground: '0 0% 10%',
      muted: '220 15% 18%',
      mutedForeground: '220 10% 55%',
      accent: '280 60% 60%',
      accentForeground: '0 0% 100%',
      destructive: '0 60% 55%',
      success: '150 60% 45%',
      warning: '45 80% 55%',
      border: '220 15% 22%',
      input: '220 15% 22%',
      ring: '210 70% 55%',
    },
  },
  {
    id: 'oceano',
    name: '🌊 Oceano',
    description: 'Azul profundo — moderno e elegante',
    colors: {
      background: '210 25% 96%',
      foreground: '210 15% 12%',
      card: '0 0% 100%',
      cardForeground: '210 15% 12%',
      primary: '210 80% 45%',
      primaryForeground: '0 0% 100%',
      secondary: '190 70% 42%',
      secondaryForeground: '0 0% 100%',
      muted: '210 20% 91%',
      mutedForeground: '210 10% 45%',
      accent: '260 55% 55%',
      accentForeground: '0 0% 100%',
      destructive: '0 65% 52%',
      success: '160 55% 40%',
      warning: '40 75% 50%',
      border: '210 18% 84%',
      input: '210 18% 84%',
      ring: '210 80% 45%',
    },
  },
  {
    id: 'terracota',
    name: '🏜️ Terracota',
    description: 'Tons terrosos — aconchegante e rústico',
    colors: {
      background: '30 25% 96%',
      foreground: '20 15% 15%',
      card: '30 20% 99%',
      cardForeground: '20 15% 15%',
      primary: '15 65% 48%',
      primaryForeground: '0 0% 100%',
      secondary: '35 60% 50%',
      secondaryForeground: '0 0% 100%',
      muted: '30 18% 90%',
      mutedForeground: '20 10% 45%',
      accent: '350 50% 50%',
      accentForeground: '0 0% 100%',
      destructive: '0 60% 50%',
      success: '155 45% 40%',
      warning: '40 70% 50%',
      border: '30 15% 82%',
      input: '30 15% 82%',
      ring: '15 65% 48%',
    },
  },
  {
    id: 'lavanda',
    name: '💜 Lavanda',
    description: 'Roxo suave — delicado e sofisticado',
    colors: {
      background: '270 20% 97%',
      foreground: '270 10% 15%',
      card: '0 0% 100%',
      cardForeground: '270 10% 15%',
      primary: '270 55% 55%',
      primaryForeground: '0 0% 100%',
      secondary: '320 50% 55%',
      secondaryForeground: '0 0% 100%',
      muted: '270 15% 92%',
      mutedForeground: '270 8% 48%',
      accent: '200 60% 50%',
      accentForeground: '0 0% 100%',
      destructive: '0 60% 52%',
      success: '150 50% 40%',
      warning: '40 70% 52%',
      border: '270 12% 85%',
      input: '270 12% 85%',
      ring: '270 55% 55%',
    },
  },
  {
    id: 'meia_noite',
    name: '🖤 Meia-Noite',
    description: 'Preto total — alto contraste',
    colors: {
      background: '0 0% 5%',
      foreground: '0 0% 92%',
      card: '0 0% 9%',
      cardForeground: '0 0% 92%',
      primary: '145 70% 50%',
      primaryForeground: '0 0% 5%',
      secondary: '40 80% 55%',
      secondaryForeground: '0 0% 5%',
      muted: '0 0% 14%',
      mutedForeground: '0 0% 50%',
      accent: '200 70% 55%',
      accentForeground: '0 0% 5%',
      destructive: '0 65% 55%',
      success: '145 70% 50%',
      warning: '40 80% 55%',
      border: '0 0% 18%',
      input: '0 0% 18%',
      ring: '145 70% 50%',
    },
  },
];

const THEME_KEY = 'pdv_theme';

export function getStoredThemeId(): string {
  return localStorage.getItem(THEME_KEY) || 'padrao';
}

export function setStoredThemeId(id: string) {
  localStorage.setItem(THEME_KEY, id);
}

export function applyTheme(themeId: string) {
  const theme = themes.find(t => t.id === themeId) || themes[0];
  const root = document.documentElement;

  const cssVarMap: Record<string, string> = {
    '--background': theme.colors.background,
    '--foreground': theme.colors.foreground,
    '--card': theme.colors.card,
    '--card-foreground': theme.colors.cardForeground,
    '--popover': theme.colors.card,
    '--popover-foreground': theme.colors.cardForeground,
    '--primary': theme.colors.primary,
    '--primary-foreground': theme.colors.primaryForeground,
    '--secondary': theme.colors.secondary,
    '--secondary-foreground': theme.colors.secondaryForeground,
    '--muted': theme.colors.muted,
    '--muted-foreground': theme.colors.mutedForeground,
    '--accent': theme.colors.accent,
    '--accent-foreground': theme.colors.accentForeground,
    '--destructive': theme.colors.destructive,
    '--destructive-foreground': theme.colors.primaryForeground,
    '--success': theme.colors.success,
    '--success-foreground': theme.colors.primaryForeground,
    '--warning': theme.colors.warning,
    '--warning-foreground': theme.colors.primaryForeground,
    '--border': theme.colors.border,
    '--input': theme.colors.input,
    '--ring': theme.colors.ring,
    '--sidebar-background': theme.colors.muted,
    '--sidebar-foreground': theme.colors.foreground,
    '--sidebar-primary': theme.colors.primary,
    '--sidebar-primary-foreground': theme.colors.primaryForeground,
    '--sidebar-accent': theme.colors.muted,
    '--sidebar-accent-foreground': theme.colors.foreground,
    '--sidebar-border': theme.colors.border,
    '--sidebar-ring': theme.colors.ring,
  };

  Object.entries(cssVarMap).forEach(([prop, val]) => {
    root.style.setProperty(prop, val);
  });

  setStoredThemeId(themeId);
}

export function initTheme() {
  applyTheme(getStoredThemeId());
}
