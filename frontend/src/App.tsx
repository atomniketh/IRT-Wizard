import { useEffect } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import { WizardContainer } from './components/wizard/WizardContainer'
import { About } from './components/About'
import { MLflowViewer } from './components/MLflowViewer'
import { ProjectsDashboard } from './components/ProjectsDashboard'
import { ThemeToggle } from './components/common/ThemeToggle'
import { useSettingsStore } from './store'
import { clsx } from 'clsx'

function App() {
  const theme = useSettingsStore((s) => s.theme)

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
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<WizardContainer />} />
          <Route path="/project/:projectId" element={<WizardContainer />} />
          <Route path="/projects" element={<ProjectsDashboard />} />
          <Route path="/experiments" element={<MLflowViewer />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
