import { useState, useEffect } from 'react'
import { ArrowUpDown, AlertTriangle, CheckCircle } from 'lucide-react'
import { analysisApi } from '@/api/analysis'
import { Tooltip } from '../common/Tooltip'
import { useCompetencyLevel } from '@/hooks/useCompetencyLevel'
import type { FitStatisticsItem } from '@/types'

interface FitStatisticsTableProps {
  analysisId: string
}

type SortField = 'name' | 'measure' | 'infit_mnsq' | 'outfit_mnsq'
type SortDirection = 'asc' | 'desc'

// MNSQ acceptable range constants
const MNSQ_LOW = 0.5
const MNSQ_HIGH = 1.5
const MNSQ_CRITICAL_HIGH = 2.0

function getMnsqStatus(value: number | null): 'good' | 'warning' | 'critical' {
  if (value === null) return 'good'
  if (value < MNSQ_LOW || value > MNSQ_CRITICAL_HIGH) return 'critical'
  if (value > MNSQ_HIGH) return 'warning'
  return 'good'
}

function getMnsqColor(value: number | null): string {
  const status = getMnsqStatus(value)
  switch (status) {
    case 'critical':
      return 'text-red-600 dark:text-red-400 font-medium'
    case 'warning':
      return 'text-yellow-600 dark:text-yellow-400'
    default:
      return 'text-gray-900 dark:text-gray-100'
  }
}

export function FitStatisticsTable({ analysisId }: FitStatisticsTableProps) {
  const [items, setItems] = useState<FitStatisticsItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const { isStudent, isResearcher } = useCompetencyLevel()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await analysisApi.getItemFitStatistics(analysisId)
        setItems(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load fit statistics')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [analysisId])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const sortedItems = [...items].sort((a, b) => {
    const aValue = a[sortField]
    const bValue = b[sortField]

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
    }

    const aNum = Number(aValue) || 0
    const bNum = Number(bValue) || 0
    return sortDirection === 'asc' ? aNum - bNum : bNum - aNum
  })

  const formatValue = (value: number | null, decimals = 2): string => {
    if (value === null || value === undefined) return '-'
    return value.toFixed(decimals)
  }

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

  // Count problematic items
  const criticalItems = items.filter(
    (item) => getMnsqStatus(item.infit_mnsq) === 'critical' || getMnsqStatus(item.outfit_mnsq) === 'critical'
  )
  const warningItems = items.filter(
    (item) =>
      (getMnsqStatus(item.infit_mnsq) === 'warning' || getMnsqStatus(item.outfit_mnsq) === 'warning') &&
      getMnsqStatus(item.infit_mnsq) !== 'critical' &&
      getMnsqStatus(item.outfit_mnsq) !== 'critical'
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {isStudent ? 'Item Fit Quality' : 'Item Fit Statistics (MNSQ)'}
          </h3>
          <Tooltip tooltipKey="infit_mnsq" />
        </div>
      </div>

      {/* Summary badges */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2 px-3 py-1 bg-green-50 dark:bg-green-900/30 rounded-full">
          <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
          <span className="text-sm text-green-700 dark:text-green-300">
            {items.length - criticalItems.length - warningItems.length} items fit well
          </span>
        </div>
        {warningItems.length > 0 && (
          <div className="flex items-center space-x-2 px-3 py-1 bg-yellow-50 dark:bg-yellow-900/30 rounded-full">
            <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            <span className="text-sm text-yellow-700 dark:text-yellow-300">
              {warningItems.length} {isStudent ? 'need attention' : 'borderline (1.5-2.0)'}
            </span>
          </div>
        )}
        {criticalItems.length > 0 && (
          <div className="flex items-center space-x-2 px-3 py-1 bg-red-50 dark:bg-red-900/30 rounded-full">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
            <span className="text-sm text-red-700 dark:text-red-300">
              {criticalItems.length} {isStudent ? 'problematic' : 'misfit (>2.0 or <0.5)'}
            </span>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center space-x-1">
                  <span>Item</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <div className="flex items-center space-x-1">
                  <span>Count</span>
                </div>
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => handleSort('measure')}
              >
                <div className="flex items-center space-x-1">
                  <span>{isStudent ? 'Difficulty' : 'Measure'}</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              {isResearcher && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  SE
                </th>
              )}
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => handleSort('infit_mnsq')}
              >
                <div className="flex items-center space-x-1">
                  <span>{isStudent ? 'Infit' : 'Infit MNSQ'}</span>
                  <Tooltip tooltipKey="infit_mnsq" position="bottom" />
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              {isResearcher && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <div className="flex items-center space-x-1">
                    <span>Infit ZSTD</span>
                    <Tooltip tooltipKey="infit_zstd" position="bottom" />
                  </div>
                </th>
              )}
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => handleSort('outfit_mnsq')}
              >
                <div className="flex items-center space-x-1">
                  <span>{isStudent ? 'Outfit' : 'Outfit MNSQ'}</span>
                  <Tooltip tooltipKey="outfit_mnsq" position="bottom" />
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              {isResearcher && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <div className="flex items-center space-x-1">
                    <span>Outfit ZSTD</span>
                    <Tooltip tooltipKey="outfit_zstd" position="bottom" />
                  </div>
                </th>
              )}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {sortedItems.map((item, index) => {
              const infitStatus = getMnsqStatus(item.infit_mnsq)
              const outfitStatus = getMnsqStatus(item.outfit_mnsq)
              const worstStatus =
                infitStatus === 'critical' || outfitStatus === 'critical'
                  ? 'critical'
                  : infitStatus === 'warning' || outfitStatus === 'warning'
                    ? 'warning'
                    : 'good'

              return (
                <tr key={item.name || index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                    {item.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{item.count}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                    {formatValue(item.measure, 3)}
                  </td>
                  {isResearcher && (
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {formatValue(item.se, 3)}
                    </td>
                  )}
                  <td className={`px-4 py-3 text-sm ${getMnsqColor(item.infit_mnsq)}`}>
                    {formatValue(item.infit_mnsq)}
                  </td>
                  {isResearcher && (
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {formatValue(item.infit_zstd)}
                    </td>
                  )}
                  <td className={`px-4 py-3 text-sm ${getMnsqColor(item.outfit_mnsq)}`}>
                    {formatValue(item.outfit_mnsq)}
                  </td>
                  {isResearcher && (
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {formatValue(item.outfit_zstd)}
                    </td>
                  )}
                  <td className="px-4 py-3 text-sm">
                    {worstStatus === 'good' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">
                        {isStudent ? 'Good' : 'OK'}
                      </span>
                    ) : worstStatus === 'warning' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300">
                        {isStudent ? 'Check' : 'Review'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300">
                        {isStudent ? 'Problem' : 'Misfit'}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
        <p>
          {isStudent
            ? 'MNSQ values near 1.0 indicate good fit. Values above 1.5 or below 0.5 suggest the item may not be measuring consistently.'
            : 'Acceptable MNSQ range: 0.5-1.5. Values >1.5 indicate underfit (unpredictable responses); values <0.5 indicate overfit (too predictable, possibly redundant).'}
        </p>
      </div>
    </div>
  )
}
