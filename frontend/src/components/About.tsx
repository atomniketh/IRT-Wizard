import { BookOpen, BarChart3, Brain, FileSpreadsheet, Download, Layers } from 'lucide-react'

interface FeatureCardProps {
  icon: React.ReactNode
  title: string
  description: string
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0 w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center text-primary-600 dark:text-primary-400">
          {icon}
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{description}</p>
        </div>
      </div>
    </div>
  )
}

interface ModelCardProps {
  name: string
  formula: string
  parameters: string[]
  description: string
  available: boolean
}

function ModelCard({ name, formula, parameters, description, available }: ModelCardProps) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border ${available ? 'border-gray-200 dark:border-gray-700' : 'border-amber-300 dark:border-amber-700 opacity-75'}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{name}</h3>
        {!available && (
          <span className="text-xs font-medium px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">
            Coming Soon
          </span>
        )}
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{description}</p>
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 mb-4">
        <code className="text-sm font-mono text-gray-800 dark:text-gray-200">{formula}</code>
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-500 uppercase mb-2">Parameters</p>
        <div className="flex flex-wrap gap-2">
          {parameters.map((param) => (
            <span
              key={param}
              className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
            >
              {param}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export function About() {
  return (
    <div className="space-y-12">
      <section>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">About IRT Wizard</h2>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl">
          IRT Wizard is a web-based application for Item Response Theory analysis, designed for
          air-gapped deployment with adaptive UI based on user competency levels. It provides
          comprehensive tools for analyzing dichotomous response data using classical IRT models.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Features</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<Layers className="w-5 h-5" />}
            title="Adaptive Interface"
            description="Three user modes (Student, Educator, Researcher) with tailored complexity levels and explanations."
          />
          <FeatureCard
            icon={<FileSpreadsheet className="w-5 h-5" />}
            title="Flexible Data Import"
            description="Upload CSV or TSV files directly, or fetch data from a URL. Automatic validation of response matrices."
          />
          <FeatureCard
            icon={<Brain className="w-5 h-5" />}
            title="IRT Model Fitting"
            description="Fit 1PL (Rasch), 2PL, and 3PL models using marginal maximum likelihood estimation."
          />
          <FeatureCard
            icon={<BarChart3 className="w-5 h-5" />}
            title="Interactive Visualizations"
            description="Item Characteristic Curves (ICC), Item Information Functions (IIF), Test Information Function (TIF), and ability distributions."
          />
          <FeatureCard
            icon={<Download className="w-5 h-5" />}
            title="Export Results"
            description="Download item parameters, ability estimates, and fit statistics as CSV files for further analysis."
          />
          <FeatureCard
            icon={<BookOpen className="w-5 h-5" />}
            title="MLflow Integration"
            description="All analyses are tracked in MLflow for experiment management, reproducibility, and model comparison."
          />
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Implemented Models</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <ModelCard
            name="1PL (Rasch) Model"
            formula="P(X=1|θ) = 1 / (1 + exp(-(θ - b)))"
            parameters={['b (difficulty)']}
            description="The simplest IRT model, assuming all items have equal discrimination. Estimates only item difficulty parameters."
            available={true}
          />
          <ModelCard
            name="2PL Model"
            formula="P(X=1|θ) = 1 / (1 + exp(-a(θ - b)))"
            parameters={['a (discrimination)', 'b (difficulty)']}
            description="Extends the Rasch model by allowing items to vary in how well they discriminate between ability levels."
            available={true}
          />
          <ModelCard
            name="3PL Model"
            formula="P(X=1|θ) = c + (1-c) / (1 + exp(-a(θ - b)))"
            parameters={['a (discrimination)', 'b (difficulty)', 'c (guessing)']}
            description="Adds a lower asymptote parameter to account for guessing on multiple-choice items."
            available={false}
          />
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Parameter Descriptions</h2>
        <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Parameter</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Symbol</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Typical Range</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              <tr>
                <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">Difficulty</td>
                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 font-mono">b</td>
                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">-3 to +3</td>
                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">Location on the ability scale where P(correct) = 0.5 (for 1PL/2PL)</td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">Discrimination</td>
                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 font-mono">a</td>
                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">0.5 to 2.5</td>
                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">Slope of the ICC at the difficulty point; higher = better differentiation</td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">Guessing</td>
                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 font-mono">c</td>
                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">0 to 0.35</td>
                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">Probability of correct response at very low ability (lower asymptote)</td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">Ability</td>
                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 font-mono">θ</td>
                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">-3 to +3</td>
                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">Latent trait estimate for each person; standardized with mean=0, SD=1</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Technology Stack</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Backend</h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li>• FastAPI (Python) - Async REST API</li>
              <li>• girth - IRT model fitting library</li>
              <li>• PostgreSQL - Data persistence</li>
              <li>• SeaweedFS - S3-compatible file storage</li>
              <li>• MLflow - Experiment tracking</li>
            </ul>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Frontend</h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li>• React 18 + TypeScript</li>
              <li>• Vite - Build tooling</li>
              <li>• Tailwind CSS - Styling</li>
              <li>• Recharts - Data visualization</li>
              <li>• XState - Wizard state management</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="pb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Data Requirements</h2>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <ul className="space-y-3 text-gray-600 dark:text-gray-400">
            <li className="flex items-start">
              <span className="text-primary-600 dark:text-primary-400 mr-2">•</span>
              <span><strong className="text-gray-900 dark:text-white">Format:</strong> CSV or TSV files with items as columns and respondents as rows</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary-600 dark:text-primary-400 mr-2">•</span>
              <span><strong className="text-gray-900 dark:text-white">Response values:</strong> Binary (0/1) for dichotomous items</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary-600 dark:text-primary-400 mr-2">•</span>
              <span><strong className="text-gray-900 dark:text-white">Minimum items:</strong> At least 2 binary columns required</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary-600 dark:text-primary-400 mr-2">•</span>
              <span><strong className="text-gray-900 dark:text-white">Recommended sample size:</strong> 200+ respondents for stable parameter estimates</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary-600 dark:text-primary-400 mr-2">•</span>
              <span><strong className="text-gray-900 dark:text-white">Missing data:</strong> Missing values are treated as incorrect (0)</span>
            </li>
          </ul>
        </div>
      </section>
    </div>
  )
}
