import { useState, useEffect } from 'react'
import { ArrowLeft, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react'
import { Button } from '../../common/Button'
import { datasetsApi, type DatasetPreview as DatasetPreviewType } from '@/api/datasets'
import type { WizardContext, WizardEvent } from '../WizardMachine'

interface DataPreviewProps {
  send: (event: WizardEvent) => void
  context: WizardContext
}

export function DataPreview({ send, context }: DataPreviewProps) {
  const [preview, setPreview] = useState<DatasetPreviewType | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const dataset = context.dataset

  useEffect(() => {
    if (!dataset) return

    const fetchPreview = async () => {
      try {
        const data = await datasetsApi.preview(dataset.id)
        setPreview(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load preview')
      } finally {
        setIsLoading(false)
      }
    }

    fetchPreview()
  }, [dataset])

  if (!dataset) {
    return <div>No dataset available</div>
  }

  const isValid = dataset.validation_status === 'valid'
  const validationErrors = dataset.validation_errors || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => send({ type: 'BACK' })}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </div>

      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Data Preview</h2>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Review your data before running the analysis
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{dataset.row_count || 0}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Respondents</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{dataset.column_count || 0}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Items</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {((dataset.file_size || 0) / 1024).toFixed(1)} KB
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">File Size</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center space-x-2">
            {isValid ? (
              <CheckCircle className="w-6 h-6 text-green-500" />
            ) : (
              <AlertCircle className="w-6 h-6 text-red-500" />
            )}
            <span className={isValid ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>
              {isValid ? 'Valid' : 'Issues'}
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
        </div>
      </div>

      {!isValid && validationErrors.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-2">Validation Warnings</h3>
          <ul className="list-disc list-inside space-y-1">
            {validationErrors.slice(0, 5).map((err, idx) => (
              <li key={idx} className="text-sm text-yellow-700 dark:text-yellow-400">
                {err.message}
              </li>
            ))}
            {validationErrors.length > 5 && (
              <li className="text-sm text-yellow-700 dark:text-yellow-400">
                ... and {validationErrors.length - 5} more
              </li>
            )}
          </ul>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">{error}</div>
      ) : preview ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {preview.columns.slice(0, 10).map((col) => (
                  <th
                    key={col}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    {col}
                  </th>
                ))}
                {preview.columns.length > 10 && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    +{preview.columns.length - 10} more
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {preview.rows.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  {preview.columns.slice(0, 10).map((col) => (
                    <td key={col} className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {String(row[col] ?? '')}
                    </td>
                  ))}
                  {preview.columns.length > 10 && (
                    <td className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500">...</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">
            Showing first 10 rows of {preview.total_rows}
          </p>
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button onClick={() => send({ type: 'VALIDATE_DATA' })} disabled={!isValid}>
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}
