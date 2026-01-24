import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/api/auth'
import { organizationsApi } from '@/api/organizations'

export function AuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login, setOrganizations, setIsLoading } = useAuthStore()

  useEffect(() => {
    const handleCallback = async () => {
      setIsLoading(true)

      try {
        const token = searchParams.get('token')
        const error = searchParams.get('error')

        if (error) {
          console.error('Auth error:', error)
          navigate('/login')
          return
        }

        if (!token) {
          console.error('No token in callback')
          navigate('/login')
          return
        }

        useAuthStore.setState({ accessToken: token })

        const user = await authApi.getCurrentUser()
        login(user, token)

        const orgs = await organizationsApi.list()
        setOrganizations(orgs)

        navigate('/')
      } catch (err) {
        console.error('Callback error:', err)
        useAuthStore.setState({ accessToken: null })
        navigate('/login')
      } finally {
        setIsLoading(false)
      }
    }

    handleCallback()
  }, [navigate, searchParams, login, setOrganizations, setIsLoading])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Signing you in...</p>
      </div>
    </div>
  )
}
