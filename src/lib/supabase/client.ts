// src/lib/supabase/client.ts
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const FALLBACK_SUPABASE_URL = 'https://example.supabase.co'
const FALLBACK_SUPABASE_ANON_KEY = 'local-dev-anon-key'

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('Supabase não está configurado. Sistema operará em modo local.')
}

export const supabase = createClient(
  SUPABASE_URL || FALLBACK_SUPABASE_URL,
  SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY
)

// Verificar se Supabase está ativado
export const isSupabaseEnabled = () => !!SUPABASE_URL && !!SUPABASE_ANON_KEY

// Obter usuário autenticado
export const getCurrentUser = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  } catch {
    return null
  }
}

// Obter ID do usuário
export const getCurrentUserId = async () => {
  const user = await getCurrentUser()
  return user?.id || null
}
