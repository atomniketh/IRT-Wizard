import { useState } from 'react'
import { ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { Tooltip } from '../common/Tooltip'
import { Button } from '../common/Button'
import { useCompetencyLevel } from '@/hooks/useCompetencyLevel'
import type { AbilityEstimate } from '@/types'

interface AbilityEstimatesTableProps {
  estimates: AbilityEstimate[]
  pageSize?: number
}

type SortField = 'id' | 'theta' | 'se'
type SortDirection = 'asc' | 'desc'

export function AbilityEstimatesTable({ estimates, pageSize = 20 }: AbilityEstimatesTableProps) {
  const [sortField, setSortField] = useState<SortField>('id')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [currentPage, setCurrentPage] = useState(1)

  const { isStudent, isResearcher } = useCompetencyLevel()

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const sortedEstimates = [...estimates].sort((a, b) => {
    let aValue: string | number
    let bValue: string | number

    switch (sortField) {
      case 'id':
        aValue = a.id
        bValue = b.id
        break
      case 'theta':
        aValue = a.theta
        bValue = b.theta
        break
      case 'se':
        aValue = a.se ?? 0
        bValue = b.se ?? 0
        break
    }

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue)
    }

    return sortDirection === 'asc'
      ? (aValue as number) - (bValue as number)
      : (bValue as number) - (aValue as number)
  })

  const totalPages = Math.ceil(sortedEstimates.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const paginatedEstimates = sortedEstimates.slice(startIndex, startIndex + pageSize)

  const formatValue = (value: number | null, decimals = 3): string => {
    if (value === null || value === undefined) return '-'
    return value.toFixed(decimals)
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => handleSort('id')}
              >
                <div className="flex items-center space-x-1">
                  <span>{isStudent ? 'Person' : 'ID'}</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => handleSort('theta')}
              >
                <div className="flex items-center space-x-1">
                  <span>{isStudent ? 'Ability Score' : 'Theta (θ)'}</span>
                  <Tooltip tooltipKey="theta" />
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              {!isStudent && (
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => handleSort('se')}
                >
                  <div className="flex items-center space-x-1">
                    <span>SE(θ)</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
              )}
              {isResearcher && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  95% CI
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {paginatedEstimates.map((estimate, index) => {
              const ci95Lower = estimate.se
                ? estimate.theta - 1.96 * estimate.se
                : null
              const ci95Upper = estimate.se
                ? estimate.theta + 1.96 * estimate.se
                : null

              return (
                <tr key={estimate.id || index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                    {estimate.id}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                    {formatValue(estimate.theta)}
                  </td>
                  {!isStudent && (
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {formatValue(estimate.se)}
                    </td>
                  )}
                  {isResearcher && (
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      [{formatValue(ci95Lower)}, {formatValue(ci95Upper)}]
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-4">
          <p className="text-sm text-gray-500">
            Showing {startIndex + 1}-{Math.min(startIndex + pageSize, estimates.length)} of{' '}
            {estimates.length}
          </p>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
