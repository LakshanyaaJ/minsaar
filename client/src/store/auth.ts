import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  isAuthenticated: boolean
  user: { name: string; email: string } | null
  login: (email: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      login: (email) => set({ isAuthenticated: true, user: { name: 'Admin User', email } }),
      logout: () => set({ isAuthenticated: false, user: null }),
    }),
    {
      name: 'minsaar-auth',
    }
  )
)