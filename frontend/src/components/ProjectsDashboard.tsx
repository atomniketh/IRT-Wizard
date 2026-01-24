import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  FolderOpen,
  ChevronRight,
  ArrowLeft,
  Plus,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  Play,
  BarChart3,
  Table,
  LineChart,
  FileText,
  Layers,
  Users,
  Download,
  Trash2,
} from 'lucide-react'
import { Button } from './common/Button'
import { Card, CardHeader, CardBody } from './common/Card'
import { projectsApi } from '@/api/projects'
import { analysisApi, exportsApi } from '@/api/analysis'
import { ItemParametersTable } from './results/ItemParametersTable'
import { PolytomousItemParametersTable } from './results/PolytomousItemParametersTable'
import { ModelFitSummary } from './results/ModelFitSummary'
import { ICCChart } from './charts/ICCChart'
import { IIFChart } from './charts/IIFChart'
import { TIFChart } from './charts/TIFChart'
import { AbilityDistribution } from './charts/AbilityDistribution'
import { CategoryProbabilityCurves } from './charts/CategoryProbabilityCurves'
import { WrightMap } from './charts/WrightMap'
import { FitStatisticsTable } from './charts/FitStatisticsTable'
import { CategoryStructureTable } from './charts/CategoryStructureTable'
import { DIFAnalysisTable } from './charts/DIFAnalysisTable'
import { isPolytomousModel } from '@/types'
import type { Project, Analysis, PolytomousItemParameter } from '@/types'

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString()
}

function formatDateTime(dateString: string | null): string {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString()
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: typeof CheckCircle; className: string }> = {
    completed: { icon: CheckCircle, className: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30' },
    running: { icon: Play, className: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30' },
    failed: { icon: XCircle, className: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30' },
    pending: { icon: Clock, className: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30' },
  }

  const statusConfig = config[status] || config.pending
  const Icon = statusConfig.icon

  return (
    <span className={clsx('inline-flex items-center px-2 py-1 rounded text-xs font-medium', statusConfig.className)}>
      <Icon className="w-3 h-3 mr-1" />
      {status}
    </span>
  )
}

function ProjectsList({
  projects,
  onSelect,
  isLoading,
  onRefresh,
}: {
  projects: Project[]
  onSelect: (project: Project) => void
  isLoading: boolean
  onRefresh: () => void
}) {
  const navigate = useNavigate()

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center">
          <FolderOpen className="w-4 h-4 mr-2" />
          Projects
        </h3>
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isLoading}>
            <RefreshCw className={clsx('w-4 h-4', isLoading && 'animate-spin')} />
          </Button>
          <Button size="sm" onClick={() => navigate('/')}>
            <Plus className="w-4 h-4 mr-1" />
            New Project
          </Button>
        </div>
      </div>
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {projects.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
            No projects found. Create a project to get started.
          </div>
        ) : (
          projects.map((project) => (
            <button
              key={project.id}
              onClick={() => onSelect(project)}
              className="w-full px-4 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{project.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {project.description || 'No description'}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Created {formatDate(project.created_at)}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

function ProjectDetail({
  project,
  analyses,
  isLoading,
  onBack,
  onSelectAnalysis,
  onDeleteAnalysis,
  onRefresh,
}: {
  project: Project
  analyses: Analysis[]
  isLoading: boolean
  onBack: () => void
  onSelectAnalysis: (analysis: Analysis) => void
  onDeleteAnalysis: (analysisId: string) => void
  onRefresh: () => void
}) {
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Button variant="ghost" size="sm" onClick={onBack} className="mr-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{project.name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{project.description || 'No description'}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isLoading}>
            <RefreshCw className={clsx('w-4 h-4', isLoading && 'animate-spin')} />
          </Button>
          <Button size="sm" onClick={() => navigate(`/project/${project.id}`)}>
            <Plus className="w-4 h-4 mr-1" />
            New Analysis
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Analyses ({analyses.length})
          </h3>
        </div>

        {analyses.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
            No analyses yet. Run an analysis to see results here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Model</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Items</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Created</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {analyses.map((analysis) => (
                  <tr key={analysis.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onSelectAnalysis(analysis)}
                        className={clsx(
                          'font-medium',
                          analysis.status === 'completed'
                            ? 'text-primary-600 dark:text-primary-400 hover:underline'
                            : 'text-gray-600 dark:text-gray-400 cursor-not-allowed'
                        )}
                        disabled={analysis.status !== 'completed'}
                      >
                        {analysis.name || `Analysis ${analysis.id.slice(0, 8)}`}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {analysis.model_type}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={analysis.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {analysis.model_fit?.n_items || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {formatDateTime(analysis.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteAnalysis(analysis.id)}
                        className="text-red-600 hover:text-red-700 dark:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

type ResultsTabId = 'summary' | 'parameters' | 'visualizations' | 'fit' | 'category-analysis' | 'group-comparisons'

function AnalysisResults({
  analysis,
  onBack,
}: {
  analysis: Analysis
  onBack: () => void
}) {
  const [activeTab, setActiveTab] = useState<ResultsTabId>('summary')

  const isPolytomous = isPolytomousModel(analysis.model_type)

  const baseTabs = [
    { id: 'summary' as const, label: 'Summary', icon: FileText },
    { id: 'parameters' as const, label: 'Item Parameters', icon: Table },
    { id: 'visualizations' as const, label: 'Visualizations', icon: LineChart },
    { id: 'fit' as const, label: 'Model Fit', icon: BarChart3 },
  ]

  const polytomousTabs = [
    { id: 'summary' as const, label: 'Summary', icon: FileText },
    { id: 'parameters' as const, label: 'Item Parameters', icon: Table },
    { id: 'category-analysis' as const, label: 'Category Analysis', icon: Layers, polytomousOnly: true },
    { id: 'group-comparisons' as const, label: 'Group Comparisons', icon: Users, polytomousOnly: true },
    { id: 'visualizations' as const, label: 'Visualizations', icon: LineChart },
    { id: 'fit' as const, label: 'Model Fit', icon: BarChart3 },
  ]

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
              items={(analysis.item_parameters?.items || []) as unknown as PolytomousItemParameter[]}
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
        return (
          <div className="space-y-8">
            <CategoryStructureTable analysisId={analysis.id} />
            <FitStatisticsTable analysisId={analysis.id} />
          </div>
        )

      case 'group-comparisons':
        return <DIFAnalysisTable analysisId={analysis.id} />

      case 'visualizations':
        if (isPolytomous) {
          return (
            <div className="space-y-8">
              <CategoryProbabilityCurves analysisId={analysis.id} />
              <WrightMap analysisId={analysis.id} />
            </div>
          )
        }
        return (
          <div className="space-y-8">
            <ICCChart analysisId={analysis.id} />
            <IIFChart analysisId={analysis.id} />
            <TIFChart analysisId={analysis.id} />
            <AbilityDistribution analysisId={analysis.id} />
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
        <div className="flex items-center">
          <Button variant="ghost" size="sm" onClick={onBack} className="mr-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Project
          </Button>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {analysis.name || `Analysis ${analysis.id.slice(0, 8)}`}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {analysis.model_type} • Completed {formatDateTime(analysis.completed_at)}
            </p>
          </div>
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
                {'polytomousOnly' in tab && tab.polytomousOnly && (
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

type ViewState =
  | { type: 'projects' }
  | { type: 'project'; project: Project }
  | { type: 'results'; project: Project; analysis: Analysis }

export function ProjectsDashboard() {
  const [viewState, setViewState] = useState<ViewState>({ type: 'projects' })
  const [projects, setProjects] = useState<Project[]>([])
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadProjects = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await projectsApi.list()
      setProjects(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects')
    } finally {
      setIsLoading(false)
    }
  }

  const loadAnalyses = async (projectId: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await projectsApi.listAnalyses(projectId)
      setAnalyses(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analyses')
    } finally {
      setIsLoading(false)
    }
  }

  const loadFullAnalysis = async (analysisId: string, project: Project) => {
    setIsLoading(true)
    setError(null)
    try {
      const fullAnalysis = await analysisApi.get(analysisId)
      setViewState({ type: 'results', project, analysis: fullAnalysis })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analysis')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectProject = (project: Project) => {
    setViewState({ type: 'project', project })
    loadAnalyses(project.id)
  }

  const handleSelectAnalysis = (analysis: Analysis, project: Project) => {
    if (analysis.status !== 'completed') return
    loadFullAnalysis(analysis.id, project)
  }

  const handleDeleteAnalysis = async (analysisId: string) => {
    if (!confirm('Are you sure you want to delete this analysis?')) return
    try {
      await analysisApi.delete(analysisId)
      setAnalyses(analyses.filter((a) => a.id !== analysisId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete analysis')
    }
  }

  useEffect(() => {
    loadProjects()
  }, [])

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-700 dark:text-red-400">{error}</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={() => setError(null)}>
          Dismiss
        </Button>
      </div>
    )
  }

  if (viewState.type === 'results') {
    return (
      <AnalysisResults
        analysis={viewState.analysis}
        onBack={() => {
          setViewState({ type: 'project', project: viewState.project })
          loadAnalyses(viewState.project.id)
        }}
      />
    )
  }

  if (viewState.type === 'project') {
    return (
      <ProjectDetail
        project={viewState.project}
        analyses={analyses}
        isLoading={isLoading}
        onBack={() => setViewState({ type: 'projects' })}
        onSelectAnalysis={(analysis) => handleSelectAnalysis(analysis, viewState.project)}
        onDeleteAnalysis={handleDeleteAnalysis}
        onRefresh={() => loadAnalyses(viewState.project.id)}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Projects Dashboard</h2>
        <p className="text-gray-600 dark:text-gray-400">
          View all your projects and their IRT analyses
        </p>
      </div>

      <ProjectsList
        projects={projects}
        onSelect={handleSelectProject}
        isLoading={isLoading}
        onRefresh={loadProjects}
      />
    </div>
  )
}
