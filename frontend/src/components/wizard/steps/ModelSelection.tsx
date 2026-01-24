import { useState } from 'react'
import { ArrowLeft, ArrowRight, AlertCircle, CheckCircle, Info } from 'lucide-react'
import { clsx } from 'clsx'
import { Button } from '../../common/Button'
import { Tooltip } from '../../common/Tooltip'
import { useCompetencyLevel } from '@/hooks/useCompetencyLevel'
import { analysisApi } from '@/api/analysis'
import { isPolytomousData, getRecommendedModels } from '@/types'
import type { ModelType, ResponseScale } from '@/types'
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

// Get response scale display text
function getResponseScaleDisplay(
  responseScale: ResponseScale | null,
  minResponse: number | null,
  maxResponse: number | null,
  nCategories: number | null
): { text: string; detail: string } {
  if (responseScale === 'ordinal') {
    const range = minResponse !== null && maxResponse !== null ? `${minResponse}-${maxResponse}` : 'ordinal'
    const cats = nCategories ? `${nCategories} categories` : ''
    return {
      text: 'Polytomous (Likert-scale) data detected',
      detail: `Response range: ${range}${cats ? `, ${cats}` : ''}`,
    }
  } else if (responseScale === 'binary') {
    return {
      text: 'Binary (dichotomous) data detected',
      detail: 'Response values: 0/1',
    }
  } else if (responseScale === 'mixed') {
    return {
      text: 'Mixed response format detected',
      detail: 'Data contains both binary and ordinal responses',
    }
  }
  return {
    text: 'Response scale not detected',
    detail: 'Unable to determine data type',
  }
}

export function ModelSelection({ send, context }: ModelSelectionProps) {
  const { getModelDescription, isStudent } = useCompetencyLevel()

  const isResearcher = context.competencyLevel === 'researcher'
  const showAdvancedOptions = isResearcher

  // Get response scale info from dataset
  const dataset = context.dataset
  const responseScale = dataset?.response_scale || null
  const hasPolytomousData = isPolytomousData(dataset)
  const recommendedModels = getRecommendedModels(responseScale)

  // Get display info for the detected scale
  const scaleDisplay = getResponseScaleDisplay(
    responseScale,
    dataset?.min_response ?? null,
    dataset?.max_response ?? null,
    dataset?.n_categories ?? null
  )

  // Default to appropriate model based on data type
  const defaultModel = hasPolytomousData ? 'RSM' : '2PL'
  const [selectedModel, setSelectedModel] = useState<ModelType>(context.modelType ?? defaultModel)
  const [showAllModels, setShowAllModels] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get available model options based on data type (or show all if toggled)
  const primaryModelOptions = hasPolytomousData ? polytomousModelOptions : dichotomousModelOptions
  const alternativeModelOptions = hasPolytomousData ? dichotomousModelOptions : polytomousModelOptions

  // Check if selected model is appropriate for the data
  const isModelRecommended = recommendedModels.includes(selectedModel)

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

      send({ type: 'SELECT_MODEL', modelType: selectedModel, analysis })
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
      </div>

      {/* Data Detection Banner */}
      {responseScale && (
        <div
          className={clsx(
            'flex items-start space-x-3 p-4 rounded-lg border',
            responseScale === 'ordinal'
              ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
              : responseScale === 'binary'
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
          )}
        >
          <Info
            className={clsx(
              'w-5 h-5 mt-0.5',
              responseScale === 'ordinal'
                ? 'text-purple-600 dark:text-purple-400'
                : responseScale === 'binary'
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-yellow-600 dark:text-yellow-400'
            )}
          />
          <div>
            <p
              className={clsx(
                'font-medium',
                responseScale === 'ordinal'
                  ? 'text-purple-800 dark:text-purple-200'
                  : responseScale === 'binary'
                    ? 'text-blue-800 dark:text-blue-200'
                    : 'text-yellow-800 dark:text-yellow-200'
              )}
            >
              {scaleDisplay.text}
            </p>
            <p
              className={clsx(
                'text-sm',
                responseScale === 'ordinal'
                  ? 'text-purple-600 dark:text-purple-300'
                  : responseScale === 'binary'
                    ? 'text-blue-600 dark:text-blue-300'
                    : 'text-yellow-600 dark:text-yellow-300'
              )}
            >
              {scaleDisplay.detail}
            </p>
            {!isStudent && (
              <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">
                Recommended models: {recommendedModels.join(', ')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Recommended Models */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
          {isStudent ? 'Available Models' : 'Recommended Models'}
        </h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {primaryModelOptions.map((option) => (
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
                <h3
                  className={clsx(
                    'text-lg font-semibold',
                    option.disabled ? 'text-gray-500 dark:text-gray-500' : 'text-gray-900 dark:text-white'
                  )}
                >
                  {option.name}
                </h3>
                <div className="flex items-center space-x-2">
                  {recommendedModels.includes(option.type) && !option.disabled && (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                  <Tooltip content={getModelDescription(option.type)} />
                </div>
              </div>
              <p
                className={clsx(
                  'text-sm',
                  option.disabled ? 'text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-300'
                )}
              >
                {option.shortDesc}
              </p>
              {option.disabled && option.disabledReason ? (
                <p className="text-sm text-amber-600 dark:text-amber-500 mt-3">{option.disabledReason}</p>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">{getModelDescription(option.type)}</p>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Alternative Models (for advanced users) */}
      {!isStudent && (
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setShowAllModels(!showAllModels)}
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            {showAllModels ? '− Hide alternative models' : '+ Show alternative models'}
          </button>

          {showAllModels && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Alternative Models{' '}
                <span className="text-gray-500 dark:text-gray-400 font-normal">
                  (not recommended for your data type)
                </span>
              </h4>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {alternativeModelOptions.map((option) => (
                  <button
                    key={option.type}
                    onClick={() => !option.disabled && setSelectedModel(option.type)}
                    disabled={option.disabled}
                    className={clsx(
                      'p-4 rounded-xl border-2 text-left transition-all duration-200 opacity-75',
                      'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900',
                      option.disabled
                        ? 'border-gray-200 bg-gray-50 opacity-40 cursor-not-allowed dark:border-gray-700 dark:bg-gray-800'
                        : selectedModel === option.type
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 opacity-100'
                          : 'border-gray-200 hover:border-primary-300 dark:border-gray-700 dark:hover:border-primary-600 dark:bg-gray-800 hover:opacity-100'
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-gray-900 dark:text-white">{option.name}</h3>
                      <Tooltip content={getModelDescription(option.type)} />
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{option.shortDesc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Warning if non-recommended model selected */}
      {!isModelRecommended && !isStudent && (
        <div className="flex items-start space-x-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-200">
              Model may not be ideal for your data
            </p>
            <p className="text-sm text-amber-600 dark:text-amber-300">
              {selectedModel} is designed for {selectedModel === 'RSM' || selectedModel === 'PCM' ? 'polytomous' : 'binary'} data,
              but your dataset appears to contain {responseScale} responses.
              Results may not be meaningful.
            </p>
          </div>
        </div>
      )}

      {showAdvancedOptions && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-4">Advanced Options</h3>
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

      {(error || context.error) && (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
          {error || context.error}
        </div>
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
