import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, OrganizationListItem } from '@/types/auth'
import { organizationsApi } from '@/api/organizations'

interface AuthState {
  user: User | null
  accessToken: string | null
  organizations: OrganizationListItem[]
  currentOrganization: OrganizationListItem | null
  isAuthenticated: boolean
  isLoading: boolean

  setUser: (user: User | null) => void
  setAccessToken: (token: string | null) => void
  setOrganizations: (organizations: OrganizationListItem[]) => void
  setCurrentOrganization: (org: OrganizationListItem | null) => void
  setIsLoading: (loading: boolean) => void
  login: (user: User, token: string) => void
  logout: () => void
  getAuthHeader: () => Record<string, string>
  fetchOrganizations: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      organizations: [],
      currentOrganization: null,
      isAuthenticated: false,
      isLoading: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setOrganizations: (organizations) => set({ organizations }),
      setCurrentOrganization: (currentOrganization) => set({ currentOrganization }),
      setIsLoading: (isLoading) => set({ isLoading }),

      login: (user, token) =>
        set({
          user,
          accessToken: token,
          isAuthenticated: true,
          isLoading: false,
        }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          organizations: [],
          currentOrganization: null,
          isAuthenticated: false,
          isLoading: false,
        }),

      getAuthHeader: () => {
        const { accessToken, currentOrganization } = get()
        const headers: Record<string, string> = {}

        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`
        }

        if (currentOrganization) {
          headers['X-Organization-ID'] = currentOrganization.id
        }

        return headers
      },

      fetchOrganizations: async () => {
        try {
          const orgs = await organizationsApi.list()
          set({ organizations: orgs })
        } catch {
          set({ organizations: [] })
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        accessToken: state.accessToken,
        currentOrganization: state.currentOrganization,
      }),
    }
  )
)
