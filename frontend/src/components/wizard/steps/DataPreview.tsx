import { useState, useEffect } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react'
import { Button } from '../../common/Button'
import { datasetsApi, type DatasetPreview as DatasetPreviewType } from '@/api/datasets'
import type { WizardContext, WizardEvent } from '../WizardMachine'
import type { ValidationError } from '@/types'

interface IssueInfo {
  title: string
  explanation: string
  fix: string
  severity: 'error' | 'warning' | 'info'
}

const issueDetails: Record<string, IssueInfo> = {
  empty_data: {
    title: 'Empty Dataset',
    explanation: 'The uploaded file contains no data rows.',
    fix: 'Please upload a file with at least one row of response data.',
    severity: 'error',
  },
  insufficient_items: {
    title: 'Insufficient Items',
    explanation: 'IRT analysis requires at least 2 binary item columns (containing only 0 and 1 values).',
    fix: 'Ensure your data has at least 2 columns with binary (0/1) response data. Check that item responses are coded as 0 (incorrect) and 1 (correct).',
    severity: 'error',
  },
  all_missing: {
    title: 'All Values Missing',
    explanation: 'One or more columns contain only missing/empty values.',
    fix: 'Remove or fill in the affected columns. Columns with no data cannot be analyzed.',
    severity: 'error',
  },
  id_columns_detected: {
    title: 'ID Columns Detected',
    explanation: 'Columns that appear to be identifiers (IDs, indices) were found and will be automatically excluded from analysis.',
    fix: 'No action needed. These columns will be ignored during analysis. If a column was incorrectly identified as an ID, rename it to avoid terms like "id", "index", "respondent", "person", or "subject".',
    severity: 'info',
  },
  non_binary_columns: {
    title: 'Non-Binary Columns Found',
    explanation: 'Some columns contain values other than 0 and 1. These will be excluded from dichotomous IRT analysis.',
    fix: 'If these columns should be included, recode them to binary (0/1) format. For polytomous responses (0, 1, 2, ...), polytomous IRT models will be supported in a future version.',
    severity: 'warning',
  },
  insufficient_respondents: {
    title: 'Low Sample Size',
    explanation: 'The dataset has fewer than 10 respondents. IRT parameter estimates may be unstable with small samples.',
    fix: 'For reliable results, collect data from at least 100-200 respondents (preferably 500+ for 3PL models). You can proceed, but interpret results with caution.',
    severity: 'warning',
  },
  no_variance: {
    title: 'No Variance in Item',
    explanation: 'One or more items have no variance (all respondents answered the same way).',
    fix: 'Items with no variance provide no information and may cause estimation problems. Consider removing these items or collecting more diverse response data.',
    severity: 'warning',
  },
  high_missing_rate: {
    title: 'High Missing Data Rate',
    explanation: 'More than 50% of item responses are missing.',
    fix: 'High missing rates can bias parameter estimates. Consider using imputation techniques or collecting more complete data. Missing values will be treated as incorrect (0) during analysis.',
    severity: 'warning',
  },
  grouping_columns_detected: {
    title: 'Group Variables Available',
    explanation: 'Demographic grouping columns were detected and can be used for Differential Item Functioning (DIF) analysis.',
    fix: 'No action needed. You can use these columns for group comparisons after analysis.',
    severity: 'info',
  },
  non_response_columns: {
    title: 'Non-Response Columns Excluded',
    explanation: 'Some columns do not appear to be response items and will be excluded from the IRT analysis.',
    fix: 'No action needed. These columns will be ignored during parameter estimation.',
    severity: 'info',
  },
  polytomous_data_detected: {
    title: 'Polytomous Data Detected',
    explanation: 'Your data contains ordinal responses with multiple categories (e.g., Likert scale).',
    fix: 'No action needed. Use RSM or PCM models for polytomous data analysis.',
    severity: 'info',
  },
  binary_data_detected: {
    title: 'Binary Data Detected',
    explanation: 'Your data contains binary (0/1) responses suitable for dichotomous IRT models.',
    fix: 'No action needed. Use 1PL, 2PL, or 3PL models for binary data analysis.',
    severity: 'info',
  },
  empty_rows_removed: {
    title: 'Empty Rows Removed',
    explanation: '', // Will use dynamic message from backend
    fix: 'No action needed. The cleaned data will be used for analysis.',
    severity: 'info',
  },
}

function getIssueInfo(issue: ValidationError): IssueInfo {
  return issueDetails[issue.type] || {
    title: 'Unknown Issue',
    explanation: issue.message,
    fix: 'Please review your data and try again.',
    severity: 'warning',
  }
}

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
            {!isValid ? (
              <>
                <XCircle className="w-6 h-6 text-red-500" />
                <span className="text-red-700 dark:text-red-400">Issues</span>
              </>
            ) : validationErrors.length > 0 ? (
              <>
                <AlertTriangle className="w-6 h-6 text-amber-500" />
                <span className="text-amber-700 dark:text-amber-400">Warnings</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-6 h-6 text-green-500" />
                <span className="text-green-700 dark:text-green-400">Valid</span>
              </>
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
        </div>
      </div>

      {validationErrors.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Data Validation Results
          </h3>

          {validationErrors.map((err, idx) => {
            const info = getIssueInfo(err)
            const severityStyles = {
              error: {
                container: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
                icon: XCircle,
                iconColor: 'text-red-500',
                title: 'text-red-800 dark:text-red-300',
                text: 'text-red-700 dark:text-red-400',
              },
              warning: {
                container: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
                icon: AlertTriangle,
                iconColor: 'text-amber-500',
                title: 'text-amber-800 dark:text-amber-300',
                text: 'text-amber-700 dark:text-amber-400',
              },
              info: {
                container: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
                icon: Info,
                iconColor: 'text-blue-500',
                title: 'text-blue-800 dark:text-blue-300',
                text: 'text-blue-700 dark:text-blue-400',
              },
            }
            const styles = severityStyles[info.severity]
            const Icon = styles.icon

            return (
              <div key={idx} className={`border rounded-lg p-4 ${styles.container}`}>
                <div className="flex items-start space-x-3">
                  <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${styles.iconColor}`} />
                  <div className="flex-1 min-w-0">
                    <h4 className={`font-semibold ${styles.title}`}>
                      {info.title}
                      {info.severity === 'error' && (
                        <span className="ml-2 text-xs font-normal bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 px-2 py-0.5 rounded">
                          Blocking
                        </span>
                      )}
                    </h4>

                    {(err.column || err.columns) && (
                      <p className={`text-sm mt-1 ${styles.text}`}>
                        <span className="font-medium">Affected: </span>
                        <code className="bg-white/50 dark:bg-black/20 px-1 rounded">
                          {err.column || err.columns?.join(', ')}
                        </code>
                      </p>
                    )}

                    <p className={`text-sm mt-2 ${styles.text}`}>
                      <span className="font-medium">What this means: </span>
                      {info.explanation || err.message}
                    </p>

                    <p className={`text-sm mt-2 ${styles.text}`}>
                      <span className="font-medium">How to fix: </span>
                      {info.fix}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}

          {!isValid && (
            <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg p-4">
              <p className="text-sm text-red-800 dark:text-red-300 font-medium">
                <XCircle className="w-4 h-4 inline mr-2" />
                Cannot proceed: Please fix the blocking issues above before continuing.
              </p>
            </div>
          )}
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
