import { supabase } from '../client'
import type { User } from '@supabase/supabase-js'

export interface AuthUser {
  id: string
  email: string
  name: string
}

export interface SignUpData {
  email: string
  password: string
  name: string
}

export interface SignInData {
  email: string
  password: string
}

function getEmailRedirectTo(): string {
  const configuredUrl = (import.meta.env.VITE_APP_URL || '').trim()
  const baseUrl = configuredUrl || window.location.origin
  return `${baseUrl}/login`
}

/**
 * Sign up new user with email and password
 */
export async function signUp(data: SignUpData): Promise<AuthUser> {
  try {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: getEmailRedirectTo(),
        data: {
          name: data.name,
        },
      },
    })

    if (authError) throw authError
    if (!authData.user) throw new Error('Falha ao criar usuário')

    return {
      id: authData.user.id,
      email: authData.user.email || '',
      name: data.name,
    }
  } catch (error) {
    console.error('[Auth] Sign up error:', error)
    throw error
  }
}

/**
 * Sign in user with email and password
 */
export async function signIn(data: SignInData): Promise<AuthUser> {
  try {
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })

    if (error) throw error
    if (!authData.user) throw new Error('Falha ao fazer login')

    return {
      id: authData.user.id,
      email: authData.user.email || '',
      name: authData.user.user_metadata?.name || authData.user.email || 'Usuário',
    }
  } catch (error) {
    console.error('[Auth] Sign in error:', error)
    throw error
  }
}

/**
 * Sign out current user
 */
export async function signOut(): Promise<void> {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  } catch (error) {
    console.error('[Auth] Sign out error:', error)
    throw error
  }
}

/**
 * Get current authenticated user
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) return null

    return {
      id: user.id,
      email: user.email || '',
      name: user.user_metadata?.name || user.email || 'Usuário',
    }
  } catch (error) {
    console.error('[Auth] Get current user error:', error)
    return null
  }
}

/**
 * Get current session
 */
export async function getCurrentSession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error) throw error
    return session
  } catch (error) {
    console.error('[Auth] Get session error:', error)
    return null
  }
}

/**
 * Listen to auth state changes
 */
export function onAuthStateChange(
  callback: (user: AuthUser | null) => void
): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (session?.user) {
        callback({
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.name || session.user.email || 'Usuário',
        })
      } else {
        callback(null)
      }
    }
  )

  return () => {
    subscription?.unsubscribe()
  }
}

/**
 * Update user metadata (name, etc)
 */
export async function updateUserProfile(updates: { name?: string }): Promise<AuthUser> {
  try {
    const { data, error } = await supabase.auth.updateUser({
      data: updates,
    })

    if (error) throw error
    if (!data.user) throw new Error('Falha ao atualizar perfil')

    return {
      id: data.user.id,
      email: data.user.email || '',
      name: updates.name || data.user.user_metadata?.name || 'Usuário',
    }
  } catch (error) {
    console.error('[Auth] Update profile error:', error)
    throw error
  }
}
