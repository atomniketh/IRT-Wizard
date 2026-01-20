import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { WizardContainer } from './components/wizard/WizardContainer'
import { ThemeToggle } from './components/common/ThemeToggle'
import { useSettingsStore } from './store'

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
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">IRT Wizard</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Item Response Theory Analysis</p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<WizardContainer />} />
          <Route path="/project/:projectId" element={<WizardContainer />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
