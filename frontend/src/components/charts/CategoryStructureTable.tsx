import { useState, useEffect } from 'react'
import { AlertTriangle, CheckCircle } from 'lucide-react'
import { analysisApi } from '@/api/analysis'
import { Tooltip } from '../common/Tooltip'
import { useCompetencyLevel } from '@/hooks/useCompetencyLevel'
import type { PolytomousItemParameter } from '@/types'

interface CategoryStructureTableProps {
  analysisId: string
}

interface CategoryStats {
  category: number
  label: string
  count: number
  percentage: number
  observedAverage: number | null
  andrichThreshold: number | null
  isOrdered: boolean
}

export function CategoryStructureTable({ analysisId }: CategoryStructureTableProps) {
  const [itemParameters, setItemParameters] = useState<{
    items: PolytomousItemParameter[]
    n_categories: number
    category_counts: number[]
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { isStudent, isResearcher } = useCompetencyLevel()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await analysisApi.getItemParameters(analysisId)
        setItemParameters(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load category structure')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [analysisId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error) {
    return <div className="p-4 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg">{error}</div>
  }

  if (!itemParameters || !itemParameters.items || itemParameters.items.length === 0) {
    return <div className="p-4 text-gray-500">No category structure data available</div>
  }

  // Calculate average thresholds across all items
  const nCategories = itemParameters.n_categories
  const categoryCounts = itemParameters.category_counts || []
  const totalResponses = categoryCounts.reduce((sum, c) => sum + c, 0)

  // Get average thresholds from items
  const avgThresholds: number[] = []
  if (itemParameters.items[0]?.thresholds) {
    const nThresholds = itemParameters.items[0].thresholds.length
    for (let t = 0; t < nThresholds; t++) {
      const sum = itemParameters.items.reduce((s, item) => s + (item.thresholds[t] || 0), 0)
      avgThresholds.push(sum / itemParameters.items.length)
    }
  }

  // Build category statistics
  const categoryStats: CategoryStats[] = []
  let prevThreshold = -Infinity

  for (let k = 0; k < nCategories; k++) {
    const count = categoryCounts[k] || 0
    const percentage = totalResponses > 0 ? (count / totalResponses) * 100 : 0

    // Andrich threshold is for transition FROM this category TO next
    // So category k has threshold[k-1] as its lower bound and threshold[k] as upper
    const andrichThreshold = k > 0 && k - 1 < avgThresholds.length ? avgThresholds[k - 1] : null

    // Check if thresholds are ordered (each should be greater than previous)
    const isOrdered = andrichThreshold === null || andrichThreshold > prevThreshold
    if (andrichThreshold !== null) {
      prevThreshold = andrichThreshold
    }

    // Generate label based on category number
    const labels = ['1 (Lowest)', '2', '3', '4', '5', '6', '7 (Highest)']
    const label = k < labels.length ? labels[k] : `${k + 1}`

    categoryStats.push({
      category: k + 1, // Display as 1-based
      label,
      count,
      percentage,
      observedAverage: null, // Would need additional calculation
      andrichThreshold,
      isOrdered,
    })
  }

  // Check for threshold disorders
  const hasDisorder = categoryStats.some((cat) => !cat.isOrdered)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {isStudent ? 'Response Category Summary' : 'Category Structure Analysis'}
          </h3>
          <Tooltip tooltipKey="thresholds" />
        </div>
      </div>

      {/* Alert for threshold disorders */}
      {hasDisorder && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
            <div>
              <h4 className="font-medium text-yellow-800 dark:text-yellow-200">
                {isStudent ? 'Category Issue Detected' : 'Disordered Thresholds Detected'}
              </h4>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                {isStudent
                  ? 'Some response categories may not be working as expected. Consider combining similar categories.'
                  : 'One or more Andrich thresholds are not monotonically increasing. This suggests respondents may not be using the rating scale categories as intended. Consider collapsing adjacent categories.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {!hasDisorder && (
        <div className="p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-start space-x-3">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
            <div>
              <h4 className="font-medium text-green-800 dark:text-green-200">
                {isStudent ? 'Categories Working Well' : 'Ordered Thresholds'}
              </h4>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                {isStudent
                  ? 'All response categories are being used as expected.'
                  : 'Andrich thresholds are monotonically increasing, indicating proper category functioning.'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {isStudent ? 'Response' : 'Category'}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Count
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {isStudent ? 'Percent' : '%'}
              </th>
              {isResearcher && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <div className="flex items-center space-x-1">
                    <span>Andrich τ</span>
                    <Tooltip tooltipKey="thresholds" position="bottom" />
                  </div>
                </th>
              )}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {categoryStats.map((cat) => (
              <tr key={cat.category} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                  {cat.label}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{cat.count}</td>
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                  {cat.percentage.toFixed(1)}%
                </td>
                {isResearcher && (
                  <td
                    className={`px-4 py-3 text-sm ${
                      !cat.isOrdered ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {cat.andrichThreshold !== null ? cat.andrichThreshold.toFixed(3) : '-'}
                  </td>
                )}
                <td className="px-4 py-3 text-sm">
                  {cat.count < 10 ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300">
                      {isStudent ? 'Few responses' : 'Low n'}
                    </span>
                  ) : !cat.isOrdered ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300">
                      {isStudent ? 'Problem' : 'Disordered'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">
                      {isStudent ? 'Good' : 'OK'}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">Total</td>
              <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                {totalResponses}
              </td>
              <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">100%</td>
              {isResearcher && <td className="px-4 py-3 text-sm text-gray-500">-</td>}
              <td className="px-4 py-3 text-sm text-gray-500">-</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Distribution bar */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {isStudent ? 'Response Distribution' : 'Category Distribution'}
        </h4>
        <div className="flex h-8 rounded-lg overflow-hidden">
          {categoryStats.map((cat, index) => {
            const colors = [
              'bg-red-400',
              'bg-orange-400',
              'bg-yellow-400',
              'bg-lime-400',
              'bg-green-400',
              'bg-teal-400',
              'bg-blue-400',
            ]
            return (
              <div
                key={cat.category}
                className={`${colors[index % colors.length]} relative group`}
                style={{ width: `${cat.percentage}%` }}
                title={`Category ${cat.category}: ${cat.count} (${cat.percentage.toFixed(1)}%)`}
              >
                {cat.percentage > 8 && (
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white">
                    {cat.category}
                  </span>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{isStudent ? 'Low' : 'Category 1'}</span>
          <span>{isStudent ? 'High' : `Category ${nCategories}`}</span>
        </div>
      </div>
    </div>
  )
}
