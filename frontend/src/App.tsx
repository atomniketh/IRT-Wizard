import { Routes, Route } from 'react-router-dom'
import { WizardContainer } from './components/wizard/WizardContainer'

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">IRT Wizard</h1>
          <p className="text-sm text-gray-600">Item Response Theory Analysis</p>
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
