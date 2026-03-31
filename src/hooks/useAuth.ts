import { useEffect, useState, useCallback, useRef } from 'react'
import {
  getCurrentUser,
  onAuthStateChange,
  signOut as authSignOut,
  type AuthUser,
} from '@/lib/supabase/services/auth'

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  // Initialize session on mount
  useEffect(() => {
    const initAuth = async () => {
      setLoading(true)
      const currentUser = await getCurrentUser()
      setUser(currentUser)
      setLoading(false)

      // Subscribe to auth changes
      unsubscribeRef.current = onAuthStateChange((authUser) => {
        setUser(authUser)
      })
    }

    initAuth()

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
    }
  }, [])

  const signOut = useCallback(async () => {
    try {
      await authSignOut()
      setUser(null)
    } catch (error) {
      console.error('[Hook] Sign out error:', error)
      throw error
    }
  }, [])

  return {
    user,
    loading,
    isAuthenticated: user !== null,
    signOut,
  }
}
