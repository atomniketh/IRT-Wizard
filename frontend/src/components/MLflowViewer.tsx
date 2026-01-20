import { useState, useEffect } from 'react'
import { clsx } from 'clsx'
import {
  FlaskConical,
  Play,
  Clock,
  CheckCircle,
  XCircle,
  ChevronRight,
  ArrowLeft,
  GitCompare,
  Trash2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react'
import { Button } from './common/Button'
import { mlflowApi, type MLflowExperiment, type MLflowRun, type MLflowRunDetail, type MLflowComparison } from '@/api/mlflow'

function formatTimestamp(ts: number | null): string {
  if (!ts) return '-'
  return new Date(ts).toLocaleString()
}

function formatDuration(start: number, end: number | null): string {
  if (!end) return 'Running...'
  const duration = end - start
  if (duration < 1000) return `${duration}ms`
  if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`
  return `${(duration / 60000).toFixed(1)}m`
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    FINISHED: { icon: CheckCircle, className: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30' },
    RUNNING: { icon: Play, className: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30' },
    FAILED: { icon: XCircle, className: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30' },
  }[status] || { icon: Clock, className: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30' }

  const Icon = config.icon

  return (
    <span className={clsx('inline-flex items-center px-2 py-1 rounded text-xs font-medium', config.className)}>
      <Icon className="w-3 h-3 mr-1" />
      {status}
    </span>
  )
}

function ExperimentList({
  experiments,
  selectedId,
  onSelect,
  isLoading,
  onRefresh,
}: {
  experiments: MLflowExperiment[]
  selectedId: string | null
  onSelect: (id: string) => void
  isLoading: boolean
  onRefresh: () => void
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center">
          <FlaskConical className="w-4 h-4 mr-2" />
          Experiments
        </h3>
        <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className={clsx('w-4 h-4', isLoading && 'animate-spin')} />
        </Button>
      </div>
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {experiments.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
            No experiments found. Run an analysis to create one.
          </div>
        ) : (
          experiments.map((exp) => (
            <button
              key={exp.experiment_id}
              onClick={() => onSelect(exp.experiment_id)}
              className={clsx(
                'w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors',
                selectedId === exp.experiment_id && 'bg-primary-50 dark:bg-primary-900/20'
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{exp.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {exp.run_count} run{exp.run_count !== 1 ? 's' : ''}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

function RunList({
  runs,
  experimentName,
  selectedRuns,
  onSelectRun,
  onToggleCompare,
  onBack,
  onCompare,
  onDelete,
}: {
  runs: MLflowRun[]
  experimentName: string
  selectedRuns: Set<string>
  onSelectRun: (runId: string) => void
  onToggleCompare: (runId: string) => void
  onBack: () => void
  onCompare: () => void
  onDelete: (runId: string) => void
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Button variant="ghost" size="sm" onClick={onBack} className="mr-2">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{experimentName}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{runs.length} runs</p>
            </div>
          </div>
          {selectedRuns.size >= 2 && (
            <Button size="sm" onClick={onCompare}>
              <GitCompare className="w-4 h-4 mr-2" />
              Compare ({selectedRuns.size})
            </Button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Compare</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Run Name</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Model</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">AIC</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">BIC</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Started</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Duration</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {runs.map((run) => (
              <tr key={run.run_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedRuns.has(run.run_id)}
                    onChange={() => onToggleCompare(run.run_id)}
                    className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                  />
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => onSelectRun(run.run_id)}
                    className="text-primary-600 dark:text-primary-400 hover:underline font-medium"
                  >
                    {run.run_name || run.run_id.slice(0, 8)}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={run.status} />
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                  {run.params.model_type || '-'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 font-mono">
                  {run.metrics.aic?.toFixed(2) || '-'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 font-mono">
                  {run.metrics.bic?.toFixed(2) || '-'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                  {formatTimestamp(run.start_time)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                  {formatDuration(run.start_time, run.end_time)}
                </td>
                <td className="px-4 py-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(run.run_id)}
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
    </div>
  )
}

function RunDetail({
  run,
  onBack,
}: {
  run: MLflowRunDetail
  onBack: () => void
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <Button variant="ghost" size="sm" onClick={onBack} className="mr-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Runs
        </Button>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{run.run_name || run.run_id}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Run ID: {run.run_id}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Run Information</h3>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500 dark:text-gray-400">Status</dt>
              <dd><StatusBadge status={run.status} /></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500 dark:text-gray-400">Started</dt>
              <dd className="text-sm text-gray-900 dark:text-white">{formatTimestamp(run.start_time)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500 dark:text-gray-400">Duration</dt>
              <dd className="text-sm text-gray-900 dark:text-white">{formatDuration(run.start_time, run.end_time)}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Parameters</h3>
          <dl className="space-y-2">
            {Object.entries(run.params).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <dt className="text-sm text-gray-500 dark:text-gray-400">{key.replace('config_', '')}</dt>
                <dd className="text-sm font-mono text-gray-900 dark:text-white">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Metrics</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(run.metrics).map(([key, value]) => (
            <div key={key} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{key}</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white font-mono">
                {typeof value === 'number' ? value.toFixed(4) : value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {run.tags['mlflow.note.content'] && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Description</h3>
          <p className="text-gray-700 dark:text-gray-300">{run.tags['mlflow.note.content']}</p>
        </div>
      )}
    </div>
  )
}

function ComparisonView({
  comparison,
  onBack,
}: {
  comparison: MLflowComparison
  onBack: () => void
}) {
  const [highlightBest, setHighlightBest] = useState(true)

  const getBestValue = (metricKey: string): number | null => {
    const values = comparison.runs.map(r => r.metrics[metricKey]).filter(v => v != null)
    if (values.length === 0) return null
    if (['aic', 'bic'].includes(metricKey)) {
      return Math.min(...values)
    }
    return Math.max(...values)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Button variant="ghost" size="sm" onClick={onBack} className="mr-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Model Comparison</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Comparing {comparison.runs.length} runs</p>
          </div>
        </div>
        <label className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
          <input
            type="checkbox"
            checked={highlightBest}
            onChange={(e) => setHighlightBest(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
          />
          <span>Highlight best values</span>
        </label>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">Parameters</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Parameter</th>
                {comparison.runs.map((run) => (
                  <th key={run.run_id} className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {run.run_name || run.run_id.slice(0, 8)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {comparison.param_keys.map((key) => (
                <tr key={key}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{key}</td>
                  {comparison.runs.map((run) => (
                    <td key={run.run_id} className="px-4 py-3 text-sm font-mono text-gray-700 dark:text-gray-300">
                      {run.params[key] || '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">Metrics</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Metric</th>
                {comparison.runs.map((run) => (
                  <th key={run.run_id} className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {run.run_name || run.run_id.slice(0, 8)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {comparison.metric_keys.map((key) => {
                const bestValue = getBestValue(key)
                return (
                  <tr key={key}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{key}</td>
                    {comparison.runs.map((run) => {
                      const value = run.metrics[key]
                      const isBest = highlightBest && value != null && value === bestValue
                      return (
                        <td
                          key={run.run_id}
                          className={clsx(
                            'px-4 py-3 text-sm font-mono',
                            isBest
                              ? 'text-green-700 dark:text-green-400 font-semibold bg-green-50 dark:bg-green-900/20'
                              : 'text-gray-700 dark:text-gray-300'
                          )}
                        >
                          {value != null ? value.toFixed(4) : '-'}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

type ViewState =
  | { type: 'experiments' }
  | { type: 'runs'; experimentId: string; experimentName: string }
  | { type: 'runDetail'; runId: string }
  | { type: 'compare' }

export function MLflowViewer() {
  const [viewState, setViewState] = useState<ViewState>({ type: 'experiments' })
  const [experiments, setExperiments] = useState<MLflowExperiment[]>([])
  const [runs, setRuns] = useState<MLflowRun[]>([])
  const [runDetail, setRunDetail] = useState<MLflowRunDetail | null>(null)
  const [comparison, setComparison] = useState<MLflowComparison | null>(null)
  const [selectedRuns, setSelectedRuns] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadExperiments = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await mlflowApi.getExperiments()
      setExperiments(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load experiments')
    } finally {
      setIsLoading(false)
    }
  }

  const loadRuns = async (experimentId: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await mlflowApi.getRuns(experimentId)
      setRuns(data)
      setSelectedRuns(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load runs')
    } finally {
      setIsLoading(false)
    }
  }

  const loadRunDetail = async (runId: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await mlflowApi.getRun(runId)
      setRunDetail(data)
      setViewState({ type: 'runDetail', runId })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load run details')
    } finally {
      setIsLoading(false)
    }
  }

  const loadComparison = async () => {
    if (selectedRuns.size < 2) return
    setIsLoading(true)
    setError(null)
    try {
      const data = await mlflowApi.compareRuns(Array.from(selectedRuns))
      setComparison(data)
      setViewState({ type: 'compare' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compare runs')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteRun = async (runId: string) => {
    if (!confirm('Are you sure you want to delete this run?')) return
    try {
      await mlflowApi.deleteRun(runId)
      setRuns(runs.filter((r) => r.run_id !== runId))
      setSelectedRuns((prev) => {
        const next = new Set(prev)
        next.delete(runId)
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete run')
    }
  }

  const handleSelectExperiment = (experimentId: string) => {
    const exp = experiments.find((e) => e.experiment_id === experimentId)
    setViewState({ type: 'runs', experimentId, experimentName: exp?.name || 'Experiment' })
    loadRuns(experimentId)
  }

  const toggleRunSelection = (runId: string) => {
    setSelectedRuns((prev) => {
      const next = new Set(prev)
      if (next.has(runId)) {
        next.delete(runId)
      } else {
        next.add(runId)
      }
      return next
    })
  }

  useEffect(() => {
    loadExperiments()
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

  if (viewState.type === 'compare' && comparison) {
    return (
      <ComparisonView
        comparison={comparison}
        onBack={() => {
          setComparison(null)
          if (viewState.type === 'compare') {
            const exp = experiments[0]
            if (exp) {
              setViewState({ type: 'runs', experimentId: exp.experiment_id, experimentName: exp.name })
            } else {
              setViewState({ type: 'experiments' })
            }
          }
        }}
      />
    )
  }

  if (viewState.type === 'runDetail' && runDetail) {
    return (
      <RunDetail
        run={runDetail}
        onBack={() => {
          setRunDetail(null)
          const exp = experiments.find(e => e.experiment_id === runDetail.experiment_id)
          if (exp) {
            setViewState({ type: 'runs', experimentId: exp.experiment_id, experimentName: exp.name })
          } else {
            setViewState({ type: 'experiments' })
          }
        }}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Experiment Tracking</h2>
          <p className="text-gray-600 dark:text-gray-400">
            View and compare your IRT analysis runs tracked in MLflow
          </p>
        </div>
        <a
          href="http://localhost:5002"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-sm text-primary-600 dark:text-primary-400 hover:underline"
        >
          Open MLflow UI
          <ExternalLink className="w-4 h-4 ml-1" />
        </a>
      </div>

      {viewState.type === 'experiments' && (
        <ExperimentList
          experiments={experiments}
          selectedId={null}
          onSelect={handleSelectExperiment}
          isLoading={isLoading}
          onRefresh={loadExperiments}
        />
      )}

      {viewState.type === 'runs' && (
        <RunList
          runs={runs}
          experimentName={viewState.experimentName}
          selectedRuns={selectedRuns}
          onSelectRun={loadRunDetail}
          onToggleCompare={toggleRunSelection}
          onBack={() => setViewState({ type: 'experiments' })}
          onCompare={loadComparison}
          onDelete={handleDeleteRun}
        />
      )}
    </div>
  )
}
