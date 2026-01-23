import { useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { clsx } from 'clsx'
import { Button } from '../../common/Button'
import { Tooltip } from '../../common/Tooltip'
import { useCompetencyLevel } from '@/hooks/useCompetencyLevel'
import { analysisApi } from '@/api/analysis'
import type { ModelType } from '@/types'
import type { WizardContext, WizardEvent } from '../WizardMachine'

interface ModelOption {
  type: ModelType
  name: string
  shortDesc: string
  disabled?: boolean
  disabledReason?: string
  category: 'dichotomous' | 'polytomous'
}

const dichotomousModelOptions: ModelOption[] = [
  {
    type: '1PL',
    name: 'One-Parameter (Rasch)',
    shortDesc: 'Estimates difficulty only',
    category: 'dichotomous',
  },
  {
    type: '2PL',
    name: 'Two-Parameter',
    shortDesc: 'Estimates difficulty & discrimination',
    category: 'dichotomous',
  },
  {
    type: '3PL',
    name: 'Three-Parameter',
    shortDesc: 'Adds guessing parameter',
    disabled: true,
    disabledReason: 'Coming soon - requires library update',
    category: 'dichotomous',
  },
]

const polytomousModelOptions: ModelOption[] = [
  {
    type: 'RSM',
    name: 'Rating Scale Model',
    shortDesc: 'For Likert scales with shared structure',
    category: 'polytomous',
  },
  {
    type: 'PCM',
    name: 'Partial Credit Model',
    shortDesc: 'For scales with item-specific structure',
    category: 'polytomous',
  },
]

interface ModelSelectionProps {
  send: (event: WizardEvent) => void
  context: WizardContext
}

// Helper to check if data has polytomous responses
function detectPolytomousData(dataSummary: Record<string, unknown> | null | undefined): boolean {
  if (!dataSummary) return false

  // Check if any column has values > 1 (indicating polytomous data)
  const columnStats = dataSummary.column_stats as Record<string, { max?: number }> | undefined
  if (columnStats) {
    for (const col of Object.values(columnStats)) {
      if (col.max !== undefined && col.max > 1) {
        return true
      }
    }
  }

  // Also check min_value/max_value if present
  const maxValue = dataSummary.max_value as number | undefined
  if (maxValue !== undefined && maxValue > 1) {
    return true
  }

  return false
}

export function ModelSelection({ send, context }: ModelSelectionProps) {
  const { getModelDescription } = useCompetencyLevel()

  const isResearcher = context.competencyLevel === 'researcher'
  const showAdvancedOptions = isResearcher

  // Detect if data is polytomous based on dataset summary
  const hasPolytomousData = detectPolytomousData(context.dataset?.data_summary)

  // Default to appropriate model based on data type
  const defaultModel = hasPolytomousData ? 'RSM' : '2PL'
  const [selectedModel, setSelectedModel] = useState<ModelType>(context.modelType ?? defaultModel)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get available model options based on data type
  const modelOptions = hasPolytomousData ? polytomousModelOptions : dichotomousModelOptions

  const handleSubmit = async () => {
    if (!context.project || !context.dataset) {
      setError(`Missing required data: ${!context.project ? 'project' : ''} ${!context.dataset ? 'dataset' : ''}`.trim())
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const analysis = await analysisApi.create({
        project_id: context.project.id,
        dataset_id: context.dataset.id,
        model_type: selectedModel,
        name: `${selectedModel} Analysis`,
      })

      send({ type: 'SELECT_MODEL', modelType: selectedModel })

      const pollStatus = async () => {
        const status = await analysisApi.getStatus(analysis.id)
        if (status.status === 'completed') {
          const fullAnalysis = await analysisApi.get(analysis.id)
          send({ type: 'ANALYSIS_COMPLETE', analysis: fullAnalysis })
        } else if (status.status === 'failed') {
          send({ type: 'ANALYSIS_FAILED', error: status.message || 'Analysis failed' })
        } else {
          setTimeout(pollStatus, 2000)
        }
      }

      pollStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start analysis')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => send({ type: 'BACK' })}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </div>

      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Select IRT Model</h2>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Choose the model that best fits your data and research needs
        </p>
        {hasPolytomousData && (
          <div className="mt-3 inline-flex items-center px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-sm">
            Polytomous data detected - showing rating scale models
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {modelOptions.map((option) => (
          <button
            key={option.type}
            onClick={() => !option.disabled && setSelectedModel(option.type)}
            disabled={option.disabled}
            className={clsx(
              'p-6 rounded-xl border-2 text-left transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900',
              option.disabled
                ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed dark:border-gray-700 dark:bg-gray-800'
                : selectedModel === option.type
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                  : 'border-gray-200 hover:border-primary-300 dark:border-gray-700 dark:hover:border-primary-600 dark:bg-gray-800'
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className={clsx('text-lg font-semibold', option.disabled ? 'text-gray-500 dark:text-gray-500' : 'text-gray-900 dark:text-white')}>
                {option.name}
              </h3>
              <Tooltip content={getModelDescription(option.type)} />
            </div>
            <p className={clsx('text-sm', option.disabled ? 'text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-300')}>{option.shortDesc}</p>
            {option.disabled && option.disabledReason ? (
              <p className="text-sm text-amber-600 dark:text-amber-500 mt-3">{option.disabledReason}</p>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">{getModelDescription(option.type)}</p>
            )}
          </button>
        ))}
      </div>

      {showAdvancedOptions && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-4">
            Advanced Options
          </h3>
          <div className="space-y-4">
            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <span>Estimation Method</span>
                <Tooltip tooltipKey="estimation_method" />
              </label>
              <select className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg">
                <option value="MML">Marginal Maximum Likelihood</option>
                <option value="MAP">Maximum A Posteriori</option>
              </select>
            </div>
            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <span>Ability Estimation</span>
                <Tooltip tooltipKey="ability_estimation" />
              </label>
              <select className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg">
                <option value="EAP">Expected A Posteriori (EAP)</option>
                <option value="MAP">Maximum A Posteriori (MAP)</option>
                <option value="MLE">Maximum Likelihood (MLE)</option>
              </select>
            </div>
            {isResearcher && (
              <>
                <div>
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <span>Max Iterations</span>
                    <Tooltip tooltipKey="max_iterations" />
                  </label>
                  <input
                    type="number"
                    defaultValue={1000}
                    className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg"
                  />
                </div>
                <div>
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <span>Convergence Threshold</span>
                    <Tooltip tooltipKey="convergence_threshold" />
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    defaultValue={0.0001}
                    className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">{error}</div>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSubmit} isLoading={isSubmitting}>
          Run Analysis
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}
