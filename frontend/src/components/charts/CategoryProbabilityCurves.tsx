import { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { analysisApi } from '@/api/analysis'
import { Tooltip as HelpTooltip } from '../common/Tooltip'
import { useCompetencyLevel } from '@/hooks/useCompetencyLevel'
import type { CategoryProbabilityCurve } from '@/types'

interface CategoryProbabilityCurvesProps {
  analysisId: string
  selectedItem?: string
}

// Color palette for categories (designed to be distinguishable)
const CATEGORY_COLORS = [
  '#ef4444', // red - category 0 (lowest)
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink - category 7 (highest)
]

export function CategoryProbabilityCurves({ analysisId, selectedItem }: CategoryProbabilityCurvesProps) {
  const [curves, setCurves] = useState<CategoryProbabilityCurve[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentItem, setCurrentItem] = useState<string | null>(selectedItem || null)
  const [availableItems, setAvailableItems] = useState<string[]>([])

  const { isStudent } = useCompetencyLevel()

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        const data = await analysisApi.getCategoryProbabilityCurves(analysisId, currentItem || undefined)
        setCurves(data)

        // Extract unique item names
        const items = [...new Set(data.map((d) => d.item_name))]
        setAvailableItems(items)

        // Set current item if not set
        if (!currentItem && items.length > 0) {
          setCurrentItem(items[0])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load category probability curves')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [analysisId, currentItem])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error) {
    return <div className="p-4 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg">{error}</div>
  }

  // Filter curves for selected item
  const filteredCurves = currentItem
    ? curves.filter((c) => c.item_name === currentItem)
    : curves.filter((c) => c.item_name === availableItems[0])

  // Transform data for recharts - combine all categories into single data points
  const chartData = filteredCurves[0]?.data.map((point, index) => {
    const dataPoint: Record<string, number> = { theta: point.theta }
    filteredCurves.forEach((curve) => {
      dataPoint[`Category ${curve.category}`] = curve.data[index]?.probability ?? 0
    })
    return dataPoint
  }) ?? []

  // Find Andrich thresholds (where adjacent curves intersect)
  const thresholds: number[] = []
  for (let i = 0; i < filteredCurves.length - 1; i++) {
    const curve1 = filteredCurves[i]
    const curve2 = filteredCurves[i + 1]
    // Find intersection point (approximate)
    for (let j = 1; j < curve1.data.length; j++) {
      const p1_prev = curve1.data[j - 1].probability
      const p1_curr = curve1.data[j].probability
      const p2_prev = curve2.data[j - 1].probability
      const p2_curr = curve2.data[j].probability

      // Check if curves crossed
      if ((p1_prev >= p2_prev && p1_curr <= p2_curr) || (p1_prev <= p2_prev && p1_curr >= p2_curr)) {
        thresholds.push(curve1.data[j].theta)
        break
      }
    }
  }

  const nCategories = filteredCurves.length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {isStudent ? 'Response Category Probabilities' : 'Category Probability Curves'}
          </h3>
          <HelpTooltip tooltipKey="category_probability_curve" />
        </div>
      </div>

      {availableItems.length > 1 && (
        <div className="flex items-center space-x-3">
          <label className="text-sm text-gray-600 dark:text-gray-400">Select Item:</label>
          <select
            value={currentItem || ''}
            onChange={(e) => setCurrentItem(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            {availableItems.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        {/* Legend above chart */}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mb-4">
          {Array.from({ length: nCategories }, (_, i) => (
            <div key={`legend-${i}`} className="flex items-center space-x-1.5">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
              />
              <span className="text-xs text-gray-600 dark:text-gray-400">Category {i}</span>
            </div>
          ))}
        </div>

        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis
              dataKey="theta"
              label={{
                value: isStudent ? 'Ability Level' : 'Person Measure (logits)',
                position: 'bottom',
                offset: 20,
                fill: '#9ca3af',
              }}
              tickFormatter={(value) => value.toFixed(1)}
              stroke="#6b7280"
              domain={[-4, 4]}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              domain={[0, 1]}
              label={{
                value: 'Probability',
                angle: -90,
                position: 'insideLeft',
                fill: '#9ca3af',
              }}
              tickFormatter={(value) => value.toFixed(1)}
              stroke="#6b7280"
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              formatter={(value: number, name: string) => [value.toFixed(3), name]}
              labelFormatter={(label) => `θ = ${Number(label).toFixed(2)}`}
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
              labelStyle={{ color: '#111827', fontWeight: 600 }}
              itemStyle={{ color: '#374151' }}
            />

            {/* Threshold reference lines - simplified labels */}
            {thresholds.map((threshold, index) => (
              <ReferenceLine
                key={`threshold-${index}`}
                x={threshold}
                stroke="#6b7280"
                strokeDasharray="4 4"
                strokeWidth={1}
              />
            ))}

            {/* Category curves */}
            {Array.from({ length: nCategories }, (_, i) => (
              <Line
                key={`category-${i}`}
                type="monotone"
                dataKey={`Category ${i}`}
                stroke={CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="text-sm text-gray-600 dark:text-gray-400">
        <p>
          {isStudent
            ? 'Each curve shows how likely a response category is at different ability levels. The dotted lines show where categories are equally likely (thresholds).'
            : `Showing ${nCategories} response categories for ${currentItem || 'selected item'}. Vertical dashed lines indicate Andrich thresholds (τ) where adjacent categories are equally likely.`}
        </p>
      </div>
    </div>
  )
}
