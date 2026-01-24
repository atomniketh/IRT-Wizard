import { useEffect } from 'react'
import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { WizardContainer } from './components/wizard/WizardContainer'
import { About } from './components/About'
import { MLflowViewer } from './components/MLflowViewer'
import { ProjectsDashboard } from './components/ProjectsDashboard'
import { ThemeToggle } from './components/common/ThemeToggle'
import { OrganizationSwitcher } from './components/common/OrganizationSwitcher'
import { LoginPage, AuthCallback, ProtectedRoute } from './components/auth'
import { OrgSettings } from './pages/OrgSettings'
import { OrgMembers } from './pages/OrgMembers'
import CreateOrganization from './pages/CreateOrganization'
import { useSettingsStore } from './store'
import { useAuthStore } from './store/authStore'
import { clsx } from 'clsx'

function AppLayout({ children }: { children: React.ReactNode }) {
  const theme = useSettingsStore((s) => s.theme)
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">IRT Wizard</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">Item Response Theory Analysis</p>
            </div>
            {isAuthenticated && (
              <nav className="flex space-x-1">
                <NavLink
                  to="/"
                  end
                  className={({ isActive }) =>
                    clsx(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                    )
                  }
                >
                  Analysis
                </NavLink>
                <NavLink
                  to="/projects"
                  className={({ isActive }) =>
                    clsx(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                    )
                  }
                >
                  Projects
                </NavLink>
                <NavLink
                  to="/experiments"
                  className={({ isActive }) =>
                    clsx(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                    )
                  }
                >
                  Experiments
                </NavLink>
                <NavLink
                  to="/about"
                  className={({ isActive }) =>
                    clsx(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                    )
                  }
                >
                  About
                </NavLink>
              </nav>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            {isAuthenticated && <OrganizationSwitcher />}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/callback" element={<AuthCallback />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout>
              <WizardContainer />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/project/:projectId"
        element={
          <ProtectedRoute>
            <AppLayout>
              <WizardContainer />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ProjectsDashboard />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/experiments"
        element={
          <ProtectedRoute>
            <AppLayout>
              <MLflowViewer />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/about"
        element={
          <ProtectedRoute>
            <AppLayout>
              <About />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/org/new"
        element={
          <ProtectedRoute>
            <AppLayout>
              <CreateOrganization />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/org/:slug/settings"
        element={
          <ProtectedRoute>
            <AppLayout>
              <OrgSettings />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/org/:slug/members"
        element={
          <ProtectedRoute>
            <AppLayout>
              <OrgMembers />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
