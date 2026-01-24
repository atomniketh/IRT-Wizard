import { apiClient } from './client'
import type { User } from '@/types/auth'

export const authApi = {
  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get('/users/me')
    return response.data
  },

  updateProfile: async (data: { display_name?: string; avatar_url?: string }): Promise<User> => {
    const response = await apiClient.put('/users/me', data)
    return response.data
  },
}
