import axios from 'axios'
import { useAuthStore } from '@/store/authStore'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use(
  (config) => {
    const { accessToken, currentOrganization } = useAuthStore.getState()

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`
    }

    if (currentOrganization) {
      config.headers['X-Organization-ID'] = currentOrganization.id
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.error('API Error:', error.response.data)

      if (error.response.status === 401) {
        const { logout } = useAuthStore.getState()
        logout()
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)
