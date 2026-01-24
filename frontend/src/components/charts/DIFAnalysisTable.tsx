import { useState, useEffect } from 'react'
import { ArrowUpDown, AlertTriangle, Info } from 'lucide-react'
import { useCompetencyLevel } from '@/hooks/useCompetencyLevel'
import { analysisApi } from '@/api/analysis'
import type { DIFResult, GroupingColumnInfo } from '@/types'

interface DIFAnalysisTableProps {
  analysisId: string
}

type SortField = 'item_name' | 'dif_contrast' | 'dif_classification'
type SortDirection = 'asc' | 'desc'

function classificationToLabel(classification: string): string {
  switch (classification) {
    case 'A':
      return 'negligible'
    case 'B':
      return 'slight'
    case 'C':
      return 'large'
    default:
      return classification.toLowerCase()
  }
}

function getDIFColor(classification: string): string {
  const label = classificationToLabel(classification)
  switch (label) {
    case 'large':
      return 'text-red-600 dark:text-red-400'
    case 'moderate':
      return 'text-orange-600 dark:text-orange-400'
    case 'slight':
      return 'text-yellow-600 dark:text-yellow-400'
    default:
      return 'text-green-600 dark:text-green-400'
  }
}

function getDIFBadgeClass(classification: string): string {
  const label = classificationToLabel(classification)
  switch (label) {
    case 'large':
      return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
    case 'moderate':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300'
    case 'slight':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
    default:
      return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
  }
}

export function DIFAnalysisTable({ analysisId }: DIFAnalysisTableProps) {
  const [results, setResults] = useState<DIFResult[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sortField, setSortField] = useState<SortField>('item_name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [availableGroupingColumns, setAvailableGroupingColumns] = useState<GroupingColumnInfo[]>([])
  const [selectedGroupColumn, setSelectedGroupColumn] = useState<string | null>(null)
  const [focalGroup, setFocalGroup] = useState<string | null>(null)
  const [referenceGroup, setReferenceGroup] = useState<string | null>(null)

  const { isStudent, isResearcher } = useCompetencyLevel()

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        const data = await analysisApi.getDIF(analysisId, selectedGroupColumn || undefined)
        setResults(data.results)
        setAvailableGroupingColumns(data.available_grouping_columns || [])
        setFocalGroup(data.focal_group)
        setReferenceGroup(data.reference_group)
      } catch (err) {
        console.error('Failed to load DIF analysis:', err)
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [analysisId, selectedGroupColumn])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const sortedResults = [...results].sort((a, b) => {
    const aValue = a[sortField]
    const bValue = b[sortField]

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
    }

    const aNum = Number(aValue) || 0
    const bNum = Number(bValue) || 0
    return sortDirection === 'asc' ? aNum - bNum : bNum - aNum
  })

  const formatValue = (value: number | null, decimals = 3): string => {
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

  const hasGroupingColumns = availableGroupingColumns.length > 0
  const hasSelectedGroup = selectedGroupColumn !== null
  const hasResults = results.length > 0 && results.some((r) => r.dif_contrast !== 0 || r.dif_se !== null)

  if (!hasGroupingColumns) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {isStudent ? 'Fairness Analysis' : 'Differential Item Functioning (DIF)'}
            </h3>
          </div>
        </div>

        <div className="p-6 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start space-x-3">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-800 dark:text-blue-200">
                {isStudent ? 'Group Comparison Not Available' : 'No Grouping Columns Detected'}
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                {isStudent
                  ? 'To check if questions work fairly for different groups of people, your data needs to include group information (like gender or age group).'
                  : 'DIF analysis examines whether items function differently across demographic groups. To enable this analysis, include categorical grouping variables in your dataset (e.g., Sex, Age_Group, Ethnicity).'}
              </p>
              {isResearcher && (
                <div className="mt-3 text-xs text-blue-600 dark:text-blue-400">
                  <p className="font-medium">Expected data format:</p>
                  <code className="block mt-1 p-2 bg-blue-100 dark:bg-blue-900/50 rounded">
                    Item1, Item2, Item3, ..., Gender, Age_Group
                  </code>
                </div>
              )}
            </div>
          </div>
        </div>

        <DIFExplanation isStudent={isStudent} isResearcher={isResearcher} />
      </div>
    )
  }

  if (!hasSelectedGroup) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {isStudent ? 'Fairness Analysis' : 'Differential Item Functioning (DIF)'}
            </h3>
          </div>
        </div>

        <div className="p-6 bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800 rounded-lg">
          <h4 className="font-medium text-primary-800 dark:text-primary-200 mb-3">
            Select a Grouping Variable
          </h4>
          <p className="text-sm text-primary-700 dark:text-primary-300 mb-4">
            {isStudent
              ? 'Choose which group to compare:'
              : 'Select a demographic variable to analyze differential item functioning:'}
          </p>
          <div className="flex flex-wrap gap-2">
            {availableGroupingColumns
              .filter((g) => g.n_groups === 2)
              .map((group) => (
                <button
                  key={group.column}
                  onClick={() => setSelectedGroupColumn(group.column)}
                  className="px-4 py-2 bg-white dark:bg-gray-800 border border-primary-300 dark:border-primary-600 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors"
                >
                  <span className="font-medium text-primary-800 dark:text-primary-200">
                    {group.column}
                  </span>
                  <span className="ml-2 text-sm text-primary-600 dark:text-primary-400">
                    ({group.values.join(' vs ')})
                  </span>
                </button>
              ))}
          </div>
          {availableGroupingColumns.filter((g) => g.n_groups !== 2).length > 0 && (
            <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              <p>Columns with more than 2 groups are not supported for DIF analysis:</p>
              <ul className="list-disc list-inside mt-1">
                {availableGroupingColumns
                  .filter((g) => g.n_groups !== 2)
                  .map((g) => (
                    <li key={g.column}>
                      {g.column} ({g.n_groups} groups)
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>

        <DIFExplanation isStudent={isStudent} isResearcher={isResearcher} />
      </div>
    )
  }

  if (!hasResults) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {isStudent ? 'Fairness Analysis' : 'Differential Item Functioning (DIF)'}
            </h3>
          </div>
          <GroupColumnSelector
            availableGroupingColumns={availableGroupingColumns}
            selectedGroupColumn={selectedGroupColumn}
            onSelect={setSelectedGroupColumn}
          />
        </div>

        <div className="p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-green-800 dark:text-green-200">
            No significant DIF detected. All items appear to function similarly across groups.
          </p>
        </div>
      </div>
    )
  }

  const difCounts = {
    negligible: results.filter((r) => classificationToLabel(r.dif_classification) === 'negligible').length,
    slight: results.filter((r) => classificationToLabel(r.dif_classification) === 'slight').length,
    moderate: results.filter((r) => classificationToLabel(r.dif_classification) === 'moderate').length,
    large: results.filter((r) => classificationToLabel(r.dif_classification) === 'large').length,
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {isStudent ? 'Fairness Analysis' : 'Differential Item Functioning (DIF)'}
          </h3>
        </div>
        <GroupColumnSelector
          availableGroupingColumns={availableGroupingColumns}
          selectedGroupColumn={selectedGroupColumn}
          onSelect={setSelectedGroupColumn}
        />
      </div>

      {referenceGroup && focalGroup && (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Comparing <span className="font-medium">{referenceGroup}</span> (reference) vs{' '}
          <span className="font-medium">{focalGroup}</span> (focal)
        </div>
      )}

      <div className="flex items-center space-x-4">
        <span className={`px-3 py-1 rounded-full text-sm ${getDIFBadgeClass('A')}`}>
          {difCounts.negligible} negligible
        </span>
        {difCounts.slight > 0 && (
          <span className={`px-3 py-1 rounded-full text-sm ${getDIFBadgeClass('B')}`}>
            {difCounts.slight} slight
          </span>
        )}
        {difCounts.moderate > 0 && (
          <span className={`px-3 py-1 rounded-full text-sm ${getDIFBadgeClass('moderate')}`}>
            {difCounts.moderate} moderate
          </span>
        )}
        {difCounts.large > 0 && (
          <span className={`px-3 py-1 rounded-full text-sm ${getDIFBadgeClass('C')}`}>
            {difCounts.large} large
          </span>
        )}
      </div>

      {(difCounts.moderate > 0 || difCounts.large > 0) && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
            <div>
              <h4 className="font-medium text-yellow-800 dark:text-yellow-200">
                {isStudent ? 'Some Items May Be Unfair' : 'DIF Detected'}
              </h4>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                {isStudent
                  ? `${difCounts.moderate + difCounts.large} items show different difficulty for different groups. These items may need review.`
                  : `${difCounts.moderate + difCounts.large} items show moderate to large DIF. Consider reviewing these items for potential bias or meaningful group differences.`}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => handleSort('item_name')}
              >
                <div className="flex items-center space-x-1">
                  <span>Item</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Reference
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Focal
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => handleSort('dif_contrast')}
              >
                <div className="flex items-center space-x-1">
                  <span>DIF Contrast</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              {isResearcher && (
                <>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    SE
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    t
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    p
                  </th>
                </>
              )}
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => handleSort('dif_classification')}
              >
                <div className="flex items-center space-x-1">
                  <span>Classification</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {sortedResults.map((result, index) => (
              <tr key={result.item_name || index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                  {result.item_name}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                  {formatValue(result.reference_difficulty)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                  {formatValue(result.focal_difficulty)}
                </td>
                <td className={`px-4 py-3 text-sm font-medium ${getDIFColor(result.dif_classification)}`}>
                  {formatValue(result.dif_contrast)}
                </td>
                {isResearcher && (
                  <>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {formatValue(result.dif_se)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {formatValue(result.dif_t, 2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {result.dif_p !== null ? (result.dif_p < 0.001 ? '<.001' : formatValue(result.dif_p)) : '-'}
                    </td>
                  </>
                )}
                <td className="px-4 py-3 text-sm">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getDIFBadgeClass(result.dif_classification)}`}
                  >
                    {classificationToLabel(result.dif_classification)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GroupColumnSelector({
  availableGroupingColumns,
  selectedGroupColumn,
  onSelect,
}: {
  availableGroupingColumns: GroupingColumnInfo[]
  selectedGroupColumn: string | null
  onSelect: (column: string | null) => void
}) {
  const validColumns = availableGroupingColumns.filter((g) => g.n_groups === 2)

  if (validColumns.length <= 1) return null

  return (
    <select
      value={selectedGroupColumn || ''}
      onChange={(e) => onSelect(e.target.value || null)}
      className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
    >
      {validColumns.map((group) => (
        <option key={group.column} value={group.column}>
          {group.column} ({group.values.join(' vs ')})
        </option>
      ))}
    </select>
  )
}

function DIFExplanation({ isStudent, isResearcher }: { isStudent: boolean; isResearcher: boolean }) {
  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <h4 className="font-medium text-gray-900 dark:text-white mb-2">
        {isStudent ? 'What is Fairness Analysis?' : 'About DIF Analysis'}
      </h4>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {isStudent
          ? 'Fairness analysis checks if questions are equally fair to different groups. For example, it can detect if a question is harder for one gender compared to another, even when both groups have the same ability level.'
          : 'Differential Item Functioning (DIF) occurs when respondents from different groups (e.g., male vs. female) with the same ability level have different probabilities of endorsing an item. DIF can indicate item bias or meaningful group differences.'}
      </p>
      {isResearcher && (
        <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          <p className="font-medium">DIF Classification Criteria (ETS):</p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>
              <span className="text-green-600 dark:text-green-400">A (Negligible):</span> |DIF contrast| &lt; 0.43
              logits
            </li>
            <li>
              <span className="text-yellow-600 dark:text-yellow-400">B (Slight):</span> 0.43 ≤ |DIF| &lt; 0.64 logits
            </li>
            <li>
              <span className="text-red-600 dark:text-red-400">C (Large):</span> |DIF contrast| ≥ 0.64 logits
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
