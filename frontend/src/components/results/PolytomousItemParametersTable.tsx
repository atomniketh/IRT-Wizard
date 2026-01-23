import { useState } from 'react'
import { ArrowUpDown, ChevronDown, ChevronRight } from 'lucide-react'
import { Tooltip } from '../common/Tooltip'
import { useCompetencyLevel } from '@/hooks/useCompetencyLevel'
import type { PolytomousItemParameter, ModelType } from '@/types'

interface PolytomousItemParametersTableProps {
  items: PolytomousItemParameter[]
  modelType: ModelType
}

type SortField = 'name' | 'difficulty' | 'infit_mnsq' | 'outfit_mnsq'
type SortDirection = 'asc' | 'desc'

export function PolytomousItemParametersTable({ items, modelType }: PolytomousItemParametersTableProps) {
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  const { isStudent, isResearcher } = useCompetencyLevel()

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const toggleExpanded = (itemName: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(itemName)) {
      newExpanded.delete(itemName)
    } else {
      newExpanded.add(itemName)
    }
    setExpandedItems(newExpanded)
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

  const formatValue = (value: number | null | undefined, decimals = 3): string => {
    if (value === null || value === undefined) return '-'
    return value.toFixed(decimals)
  }

  const getMnsqStatus = (value: number | null): string => {
    if (value === null) return ''
    if (value < 0.5 || value > 2.0) return 'text-red-600 dark:text-red-400'
    if (value > 1.5) return 'text-yellow-600 dark:text-yellow-400'
    return ''
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {isStudent ? 'Item Details' : 'Polytomous Item Parameters'}
          </h3>
          <span className="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded">
            {modelType}
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {isStudent
            ? 'Click an item to see threshold details'
            : 'Click items to expand Andrich threshold parameters'}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-8">
                {/* Expand indicator */}
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center space-x-1">
                  <span>Item</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => handleSort('difficulty')}
              >
                <div className="flex items-center space-x-1">
                  <span>{isStudent ? 'Difficulty' : 'β (Measure)'}</span>
                  <Tooltip tooltipKey="difficulty" position="bottom" />
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              {isResearcher && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <div className="flex items-center space-x-1">
                    <span>SE</span>
                    <Tooltip tooltipKey="se_difficulty" position="bottom" />
                  </div>
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
                    <span>Thresholds</span>
                    <Tooltip tooltipKey="thresholds" position="bottom" />
                  </div>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {sortedItems.map((item, index) => {
              const isExpanded = expandedItems.has(item.name)
              const hasThresholds = item.thresholds && item.thresholds.length > 0

              return (
                <>
                  <tr
                    key={item.name || index}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer ${
                      isExpanded ? 'bg-gray-50 dark:bg-gray-800' : ''
                    }`}
                    onClick={() => hasThresholds && toggleExpanded(item.name)}
                  >
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {hasThresholds ? (
                        isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                      {item.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {formatValue(item.difficulty)}
                    </td>
                    {isResearcher && (
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {formatValue(item.se_difficulty)}
                      </td>
                    )}
                    <td className={`px-4 py-3 text-sm ${getMnsqStatus(item.infit_mnsq)}`}>
                      {formatValue(item.infit_mnsq, 2)}
                    </td>
                    <td className={`px-4 py-3 text-sm ${getMnsqStatus(item.outfit_mnsq)}`}>
                      {formatValue(item.outfit_mnsq, 2)}
                    </td>
                    {isResearcher && (
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {hasThresholds ? `${item.thresholds.length} τ` : '-'}
                      </td>
                    )}
                  </tr>
                  {/* Expanded threshold details */}
                  {isExpanded && hasThresholds && (
                    <tr key={`${item.name}-thresholds`} className="bg-gray-50 dark:bg-gray-800/50">
                      <td colSpan={isResearcher ? 7 : 5} className="px-4 py-3">
                        <div className="ml-8 p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {isStudent ? 'Category Boundaries' : 'Andrich Thresholds (τ)'}
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                            {item.thresholds.map((threshold, tIndex) => (
                              <div
                                key={tIndex}
                                className="px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded text-center"
                              >
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {isStudent ? `${tIndex + 1}→${tIndex + 2}` : `τ${tIndex + 1}`}
                                </div>
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {threshold.toFixed(3)}
                                </div>
                              </div>
                            ))}
                          </div>
                          {item.se_thresholds && (
                            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                              SE: {item.se_thresholds.map((se) => se?.toFixed(3) || '-').join(', ')}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="text-sm text-gray-600 dark:text-gray-400">
        <p>
          {isStudent
            ? 'The difficulty shows how hard each question is. Infit and Outfit show how well responses match the expected pattern (1.0 is ideal).'
            : `${modelType === 'RSM' ? 'Rating Scale Model: All items share the same threshold structure.' : 'Partial Credit Model: Each item has unique threshold parameters.'} Click items to view Andrich thresholds.`}
        </p>
      </div>
    </div>
  )
}
