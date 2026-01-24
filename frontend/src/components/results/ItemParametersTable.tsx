import { useState } from 'react'
import { ArrowUpDown } from 'lucide-react'
import { Tooltip } from '../common/Tooltip'
import { useCompetencyLevel } from '@/hooks/useCompetencyLevel'
import type { ItemParameter, ModelType } from '@/types'

interface ItemParametersTableProps {
  items: ItemParameter[]
  modelType: ModelType
}

type SortField = 'name' | 'difficulty' | 'discrimination' | 'guessing'
type SortDirection = 'asc' | 'desc'

export function ItemParametersTable({ items, modelType }: ItemParametersTableProps) {
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const { isStudent, isResearcher } = useCompetencyLevel()

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
      return sortDirection === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue)
    }

    const aNum = Number(aValue) || 0
    const bNum = Number(bValue) || 0
    return sortDirection === 'asc' ? aNum - bNum : bNum - aNum
  })

  const formatValue = (value: number | null, decimals = 3): string => {
    if (value === null || value === undefined) return '-'
    return value.toFixed(decimals)
  }

  const isPolytomous = modelType === 'RSM' || modelType === 'PCM'
  const showDiscrimination = modelType !== '1PL' && !isPolytomous
  const showGuessing = modelType === '3PL'

  return (
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
            <th
              className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => handleSort('difficulty')}
            >
              <div className="flex items-center space-x-1">
                <span>{isStudent ? 'Difficulty' : 'b (Difficulty)'}</span>
                <Tooltip tooltipKey="difficulty" position="bottom" />
                <ArrowUpDown className="w-3 h-3" />
              </div>
            </th>
            {showDiscrimination && (
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => handleSort('discrimination')}
              >
                <div className="flex items-center space-x-1">
                  <span>{isStudent ? 'Discrimination' : 'a (Discrimination)'}</span>
                  <Tooltip tooltipKey="discrimination" position="bottom" />
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
            )}
            {showGuessing && (
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => handleSort('guessing')}
              >
                <div className="flex items-center space-x-1">
                  <span>{isStudent ? 'Guessing' : 'c (Guessing)'}</span>
                  <Tooltip tooltipKey="guessing" position="bottom" />
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
            )}
            {isResearcher && (
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <div className="flex items-center space-x-1">
                  <span>SE(b)</span>
                  <Tooltip tooltipKey="se_difficulty" position="bottom" />
                </div>
              </th>
            )}
            {isResearcher && showDiscrimination && (
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <div className="flex items-center space-x-1">
                  <span>SE(a)</span>
                  <Tooltip tooltipKey="se_discrimination" position="bottom" />
                </div>
              </th>
            )}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
          {sortedItems.map((item, index) => (
            <tr key={item.name || index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
              <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{item.name}</td>
              <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{formatValue(item.difficulty)}</td>
              {showDiscrimination && (
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                  {formatValue(item.discrimination)}
                </td>
              )}
              {showGuessing && (
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{formatValue(item.guessing)}</td>
              )}
              {isResearcher && (
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                  {formatValue(item.se_difficulty)}
                </td>
              )}
              {isResearcher && showDiscrimination && (
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                  {formatValue(item.se_discrimination)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
