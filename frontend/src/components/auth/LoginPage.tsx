import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/api/auth'
import { organizationsApi } from '@/api/organizations'
import { Button } from '@/components/common/Button'
import { Card } from '@/components/common/Card'

export function LoginPage() {
  const navigate = useNavigate()
  const { login, setOrganizations, setIsLoading } = useAuthStore()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  const handleDevLogin = async () => {
    if (!email.trim()) {
      setError('Email is required')
      return
    }

    setIsLoggingIn(true)
    setError(null)

    try {
      const devToken = `${email.split('@')[0]}:${email}:${email.split('@')[0]}`

      useAuthStore.setState({ accessToken: devToken })

      const user = await authApi.getCurrentUser()
      login(user, devToken)

      const orgs = await organizationsApi.list()
      setOrganizations(orgs)

      navigate('/')
    } catch (err) {
      console.error('Login error:', err)
      setError('Login failed. Please try again.')
      useAuthStore.setState({ accessToken: null })
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleAuth0Login = () => {
    setError('Auth0 login not yet configured')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            IRT Wizard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Item Response Theory Analysis
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              onKeyDown={(e) => e.key === 'Enter' && handleDevLogin()}
            />
          </div>

          <Button
            onClick={handleDevLogin}
            disabled={isLoggingIn}
            className="w-full"
          >
            {isLoggingIn ? 'Signing in...' : 'Sign in (Development)'}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">
                or
              </span>
            </div>
          </div>

          <Button
            variant="secondary"
            onClick={handleAuth0Login}
            className="w-full"
          >
            Sign in with Auth0
          </Button>
        </div>

        <p className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
          Development mode: Enter any email to create or access an account
        </p>
      </Card>
    </div>
  )
}
