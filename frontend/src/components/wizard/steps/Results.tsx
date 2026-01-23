import { useState } from 'react'
import { Download, RefreshCw, BarChart3, Table, LineChart, FileText, Layers } from 'lucide-react'
import { Button } from '../../common/Button'
import { Card, CardHeader, CardBody } from '../../common/Card'
import { exportsApi } from '@/api/analysis'
import { ItemParametersTable } from '../../results/ItemParametersTable'
import { PolytomousItemParametersTable } from '../../results/PolytomousItemParametersTable'
import { ModelFitSummary } from '../../results/ModelFitSummary'
import { ICCChart } from '../../charts/ICCChart'
import { CategoryProbabilityCurves } from '../../charts/CategoryProbabilityCurves'
import { WrightMap } from '../../charts/WrightMap'
import { FitStatisticsTable } from '../../charts/FitStatisticsTable'
import { CategoryStructureTable } from '../../charts/CategoryStructureTable'
import { DIFAnalysisTable } from '../../charts/DIFAnalysisTable'
import { isPolytomousModel } from '@/types'
import type { WizardContext, WizardEvent } from '../WizardMachine'

type TabId = 'summary' | 'parameters' | 'abilities' | 'visualizations' | 'fit' | 'category-analysis'

interface Tab {
  id: TabId
  label: string
  icon: typeof BarChart3
  polytomousOnly?: boolean
}

const baseTabs: Tab[] = [
  { id: 'summary', label: 'Summary', icon: FileText },
  { id: 'parameters', label: 'Item Parameters', icon: Table },
  { id: 'visualizations', label: 'Visualizations', icon: LineChart },
  { id: 'fit', label: 'Model Fit', icon: BarChart3 },
]

const polytomousTabs: Tab[] = [
  { id: 'summary', label: 'Summary', icon: FileText },
  { id: 'parameters', label: 'Item Parameters', icon: Table },
  { id: 'category-analysis', label: 'Category Analysis', icon: Layers, polytomousOnly: true },
  { id: 'visualizations', label: 'Visualizations', icon: LineChart },
  { id: 'fit', label: 'Model Fit', icon: BarChart3 },
]

interface ResultsProps {
  send: (event: WizardEvent) => void
  context: WizardContext
}

export function Results({ send, context }: ResultsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('summary')

  const analysis = context.analysis

  if (!analysis) {
    return <div>No analysis results available</div>
  }

  const isPolytomous = isPolytomousModel(analysis.model_type)
  const tabs = isPolytomous ? polytomousTabs : baseTabs

  const handleExport = (format: 'csv' | 'excel' | 'pdf-summary' | 'pdf-detailed') => {
    let url: string

    switch (format) {
      case 'csv':
        url = exportsApi.downloadCsv(analysis.id)
        break
      case 'excel':
        url = exportsApi.downloadExcel(analysis.id)
        break
      case 'pdf-summary':
        url = exportsApi.downloadPdf(analysis.id, 'summary')
        break
      case 'pdf-detailed':
        url = exportsApi.downloadPdf(analysis.id, 'detailed')
        break
    }

    window.open(url, '_blank')
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'summary':
        return (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="bg-primary-50 dark:bg-primary-900/30 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-primary-700 dark:text-primary-300">{analysis.model_type}</p>
                <p className="text-sm text-primary-600 dark:text-primary-400">Model Type</p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-green-700 dark:text-green-300">
                  {analysis.model_fit?.n_items || 0}
                </p>
                <p className="text-sm text-green-600 dark:text-green-400">Items Analyzed</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                  {analysis.model_fit?.n_persons || 0}
                </p>
                <p className="text-sm text-blue-600 dark:text-blue-400">Respondents</p>
              </div>
            </div>

            {/* Additional summary stats for polytomous models */}
            {isPolytomous && analysis.model_fit && 'n_categories' in analysis.model_fit && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">
                    {(analysis.model_fit as { n_categories?: number }).n_categories || '-'}
                  </p>
                  <p className="text-sm text-purple-600 dark:text-purple-400">Response Categories</p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/30 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-orange-700 dark:text-orange-300">
                    {analysis.model_type === 'RSM' ? 'Shared' : 'Unique'}
                  </p>
                  <p className="text-sm text-orange-600 dark:text-orange-400">Threshold Structure</p>
                </div>
              </div>
            )}

            <ModelFitSummary modelFit={analysis.model_fit} />

            {analysis.item_parameters?.items && (
              <Card>
                <CardHeader>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Item Parameters Preview</h3>
                </CardHeader>
                <CardBody>
                  <ItemParametersTable
                    items={analysis.item_parameters.items.slice(0, 5)}
                    modelType={analysis.model_type}
                  />
                  {analysis.item_parameters.items.length > 5 && (
                    <p className="text-sm text-gray-500 mt-2 text-center">
                      Showing 5 of {analysis.item_parameters.items.length} items.
                      <button
                        onClick={() => setActiveTab('parameters')}
                        className="text-primary-600 hover:underline ml-1"
                      >
                        View all
                      </button>
                    </p>
                  )}
                </CardBody>
              </Card>
            )}
          </div>
        )

      case 'parameters':
        if (isPolytomous) {
          return (
            <PolytomousItemParametersTable
              items={analysis.item_parameters?.items || []}
              modelType={analysis.model_type}
            />
          )
        }
        return (
          <ItemParametersTable
            items={analysis.item_parameters?.items || []}
            modelType={analysis.model_type}
          />
        )

      case 'category-analysis':
        // Polytomous-specific category analysis
        return (
          <div className="space-y-8">
            <CategoryStructureTable analysisId={analysis.id} />
            <FitStatisticsTable analysisId={analysis.id} />
            <DIFAnalysisTable analysisId={analysis.id} />
          </div>
        )

      case 'visualizations':
        if (isPolytomous) {
          // Polytomous visualizations
          return (
            <div className="space-y-8">
              <CategoryProbabilityCurves analysisId={analysis.id} />
              <WrightMap analysisId={analysis.id} />
            </div>
          )
        }
        // Dichotomous visualizations
        return (
          <div className="space-y-8">
            <ICCChart analysisId={analysis.id} />
          </div>
        )

      case 'fit':
        if (isPolytomous) {
          return (
            <div className="space-y-8">
              <ModelFitSummary modelFit={analysis.model_fit} detailed />
              <FitStatisticsTable analysisId={analysis.id} />
            </div>
          )
        }
        return <ModelFitSummary modelFit={analysis.model_fit} detailed />

      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Analysis Results</h2>
          <p className="text-gray-600 dark:text-gray-400">{analysis.name}</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => send({ type: 'RESET' })}>
            <RefreshCw className="w-4 h-4 mr-2" />
            New Analysis
          </Button>
        </div>
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap
                  ${
                    isActive
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200'
                  }
                `}
              >
                <Icon className="w-4 h-4 mr-2" />
                {tab.label}
                {tab.polytomousOnly && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded">
                    Polytomous
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      <div>{renderTabContent()}</div>

      <Card>
        <CardHeader>
          <h3 className="font-semibold text-gray-900 dark:text-white">Export Results</h3>
        </CardHeader>
        <CardBody>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => handleExport('csv')}>
              <Download className="w-4 h-4 mr-2" />
              CSV
            </Button>
            <Button variant="outline" onClick={() => handleExport('excel')}>
              <Download className="w-4 h-4 mr-2" />
              Excel
            </Button>
            <Button variant="outline" onClick={() => handleExport('pdf-summary')}>
              <Download className="w-4 h-4 mr-2" />
              PDF (Summary)
            </Button>
            <Button variant="outline" onClick={() => handleExport('pdf-detailed')}>
              <Download className="w-4 h-4 mr-2" />
              PDF (Detailed)
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
