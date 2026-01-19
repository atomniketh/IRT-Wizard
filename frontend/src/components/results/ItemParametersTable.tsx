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

  const showDiscrimination = modelType !== '1PL'
  const showGuessing = modelType === '3PL'

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th
              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              onClick={() => handleSort('name')}
            >
              <div className="flex items-center space-x-1">
                <span>Item</span>
                <ArrowUpDown className="w-3 h-3" />
              </div>
            </th>
            <th
              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              onClick={() => handleSort('difficulty')}
            >
              <div className="flex items-center space-x-1">
                <span>{isStudent ? 'Difficulty' : 'b (Difficulty)'}</span>
                <Tooltip tooltipKey="difficulty" />
                <ArrowUpDown className="w-3 h-3" />
              </div>
            </th>
            {showDiscrimination && (
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('discrimination')}
              >
                <div className="flex items-center space-x-1">
                  <span>{isStudent ? 'Discrimination' : 'a (Discrimination)'}</span>
                  <Tooltip tooltipKey="discrimination" />
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
            )}
            {showGuessing && (
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('guessing')}
              >
                <div className="flex items-center space-x-1">
                  <span>{isStudent ? 'Guessing' : 'c (Guessing)'}</span>
                  <Tooltip tooltipKey="guessing" />
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
            )}
            {isResearcher && (
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                SE(b)
              </th>
            )}
            {isResearcher && showDiscrimination && (
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                SE(a)
              </th>
            )}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sortedItems.map((item, index) => (
            <tr key={item.name || index} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.name}</td>
              <td className="px-4 py-3 text-sm text-gray-900">{formatValue(item.difficulty)}</td>
              {showDiscrimination && (
                <td className="px-4 py-3 text-sm text-gray-900">
                  {formatValue(item.discrimination)}
                </td>
              )}
              {showGuessing && (
                <td className="px-4 py-3 text-sm text-gray-900">{formatValue(item.guessing)}</td>
              )}
              {isResearcher && (
                <td className="px-4 py-3 text-sm text-gray-500">
                  {formatValue(item.se_difficulty)}
                </td>
              )}
              {isResearcher && showDiscrimination && (
                <td className="px-4 py-3 text-sm text-gray-500">
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
