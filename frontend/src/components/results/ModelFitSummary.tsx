import { Tooltip } from '../common/Tooltip'
import { useCompetencyLevel } from '@/hooks/useCompetencyLevel'
import type { ModelFitResult } from '@/types'

interface ModelFitSummaryProps {
  modelFit: ModelFitResult | null
  detailed?: boolean
}

export function ModelFitSummary({ modelFit, detailed = false }: ModelFitSummaryProps) {
  const { isStudent, isResearcher } = useCompetencyLevel()

  if (!modelFit) {
    return <div className="text-gray-500">No fit statistics available</div>
  }

  const formatNumber = (value: number | null | undefined, decimals = 2): string => {
    if (value === null || value === undefined) return '-'
    return value.toFixed(decimals)
  }

  const getAICInterpretation = (_aic: number): string => {
    if (isStudent) return 'Lower is better'
    return 'Use for comparing models on the same data'
  }

  const getBICInterpretation = (_bic: number): string => {
    if (isStudent) return 'Lower is better'
    return 'More conservative than AIC for large samples'
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
        {isStudent ? 'How Well the Model Fits' : 'Model Fit Statistics'}
      </h3>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {!isStudent && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Log-Likelihood</span>
              <Tooltip tooltipKey="log_likelihood" />
            </div>
            <p className="text-xl font-semibold text-gray-900 dark:text-white">
              {formatNumber(modelFit.log_likelihood)}
            </p>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">{isStudent ? 'AIC Score' : 'AIC'}</span>
            <Tooltip tooltipKey="aic" />
          </div>
          <p className="text-xl font-semibold text-gray-900 dark:text-white">{formatNumber(modelFit.aic)}</p>
          {detailed && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{getAICInterpretation(modelFit.aic)}</p>}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">{isStudent ? 'BIC Score' : 'BIC'}</span>
            <Tooltip tooltipKey="bic" />
          </div>
          <p className="text-xl font-semibold text-gray-900 dark:text-white">{formatNumber(modelFit.bic)}</p>
          {detailed && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{getBICInterpretation(modelFit.bic)}</p>}
        </div>

        {!isStudent && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Parameters</span>
            </div>
            <p className="text-xl font-semibold text-gray-900 dark:text-white">{modelFit.n_parameters}</p>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">{isStudent ? 'Questions' : 'Items'}</span>
          </div>
          <p className="text-xl font-semibold text-gray-900 dark:text-white">{modelFit.n_items}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">{isStudent ? 'Students' : 'Persons'}</span>
          </div>
          <p className="text-xl font-semibold text-gray-900 dark:text-white">{modelFit.n_persons}</p>
        </div>
      </div>

      {detailed && isResearcher && (
        <div className="mt-6 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">Technical Notes</h4>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <li>AIC = 2k - 2ln(L), where k = {modelFit.n_parameters}</li>
            <li>BIC = k*ln(n) - 2ln(L), where n = {modelFit.n_persons}</li>
            <li>Lower values indicate better model-data fit relative to complexity</li>
            <li>Compare AIC/BIC across different models to select the best one</li>
          </ul>
        </div>
      )}
    </div>
  )
}
