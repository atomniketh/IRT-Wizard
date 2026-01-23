import { useState, useEffect } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts'
import { analysisApi } from '@/api/analysis'
import { Tooltip as HelpTooltip } from '../common/Tooltip'
import { useCompetencyLevel } from '@/hooks/useCompetencyLevel'
import type { WrightMapData } from '@/types'

interface WrightMapProps {
  analysisId: string
}

export function WrightMap({ analysisId }: WrightMapProps) {
  const [data, setData] = useState<WrightMapData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { isStudent, isResearcher } = useCompetencyLevel()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await analysisApi.getWrightMap(analysisId)
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load Wright map data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [analysisId])

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

  if (!data) {
    return <div className="p-4 text-gray-500">No Wright map data available</div>
  }

  // Calculate max count for scaling
  const maxCount = Math.max(...data.persons.map((p) => p.count), 1)

  // Calculate person mean and item mean for targeting analysis
  const totalPersons = data.persons.reduce((sum, p) => sum + p.count, 0)
  const personMean =
    totalPersons > 0
      ? data.persons.reduce((sum, p) => sum + p.theta * p.count, 0) / totalPersons
      : 0
  const itemMean =
    data.items.length > 0
      ? data.items.reduce((sum, item) => sum + item.difficulty, 0) / data.items.length
      : 0

  // Targeting assessment
  const targetingDiff = Math.abs(personMean - itemMean)
  const targetingQuality =
    targetingDiff < 0.5 ? 'good' : targetingDiff < 1.0 ? 'moderate' : 'poor'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {isStudent ? 'Person-Item Map' : 'Wright Map (Variable Map)'}
          </h3>
          <HelpTooltip tooltipKey="wright_map" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Person Distribution (Left Side) */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-center">
            {isStudent ? 'People' : 'Person Distribution'}
          </h4>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={data.persons}
              layout="vertical"
              margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                type="number"
                domain={[0, Math.ceil(maxCount * 1.1)]}
                tickFormatter={(v) => v.toString()}
                stroke="#6b7280"
                reversed
              />
              <YAxis
                type="number"
                dataKey="theta"
                domain={[data.min_logit, data.max_logit]}
                tickFormatter={(v) => v.toFixed(1)}
                stroke="#6b7280"
                label={{
                  value: isStudent ? 'Ability' : 'Logits',
                  angle: -90,
                  position: 'insideLeft',
                }}
              />
              <Tooltip
                formatter={(value: number) => [value, 'Count']}
                labelFormatter={(label) => `θ = ${Number(label).toFixed(2)}`}
              />
              <ReferenceLine y={personMean} stroke="#3b82f6" strokeDasharray="5 5" />
              <Bar dataKey="count" fill="#3b82f6" barSize={8}>
                {data.persons.map((_, index) => (
                  <Cell key={`person-${index}`} fill="#3b82f6" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
            {isStudent ? 'Higher = more able' : `Mean = ${personMean.toFixed(2)} logits`}
          </p>
        </div>

        {/* Item Locations (Right Side) */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-center">
            {isStudent ? 'Questions' : 'Item Difficulties'}
          </h4>
          <div className="relative h-[400px] overflow-y-auto">
            <svg width="100%" height="100%" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid meet">
              {/* Y-axis line */}
              <line x1="30" y1="20" x2="30" y2="380" stroke="#6b7280" strokeWidth="1" />

              {/* Y-axis ticks and labels */}
              {Array.from({ length: 9 }, (_, i) => {
                const logit = data.max_logit - (i * (data.max_logit - data.min_logit)) / 8
                const y = 20 + (i * 360) / 8
                return (
                  <g key={`tick-${i}`}>
                    <line x1="25" y1={y} x2="30" y2={y} stroke="#6b7280" strokeWidth="1" />
                    <text x="20" y={y + 4} fontSize="10" fill="#6b7280" textAnchor="end">
                      {logit.toFixed(1)}
                    </text>
                  </g>
                )
              })}

              {/* Item mean reference line */}
              {(() => {
                const itemMeanY =
                  20 + ((data.max_logit - itemMean) / (data.max_logit - data.min_logit)) * 360
                return (
                  <line
                    x1="30"
                    y1={itemMeanY}
                    x2="290"
                    y2={itemMeanY}
                    stroke="#ef4444"
                    strokeDasharray="5 5"
                    strokeWidth="1"
                  />
                )
              })()}

              {/* Items with thresholds */}
              {data.items.map((item, itemIndex) => {
                const baseY =
                  20 +
                  ((data.max_logit - item.difficulty) / (data.max_logit - data.min_logit)) * 360
                const xOffset = 50 + (itemIndex % 3) * 80

                return (
                  <g key={item.name}>
                    {/* Item name and difficulty marker */}
                    <circle cx={xOffset} cy={baseY} r="4" fill="#ef4444" />
                    <text
                      x={xOffset + 8}
                      y={baseY + 4}
                      fontSize="9"
                      fill="#374151"
                      className="dark:fill-gray-300"
                    >
                      {item.name.length > 12 ? item.name.slice(0, 12) + '...' : item.name}
                    </text>

                    {/* Threshold markers */}
                    {item.thresholds.map((threshold, thresholdIndex) => {
                      // Threshold is relative to item difficulty
                      const thresholdLogit = item.difficulty + threshold
                      const thresholdY =
                        20 +
                        ((data.max_logit - thresholdLogit) / (data.max_logit - data.min_logit)) *
                          360
                      return (
                        <g key={`${item.name}-t${thresholdIndex}`}>
                          <rect
                            x={xOffset - 3}
                            y={thresholdY - 2}
                            width="6"
                            height="4"
                            fill="#f97316"
                            opacity="0.7"
                          />
                        </g>
                      )
                    })}
                  </g>
                )
              })}
            </svg>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
            {isStudent ? 'Higher = harder questions' : `Mean = ${itemMean.toFixed(2)} logits`}
          </p>
        </div>
      </div>

      {/* Targeting Summary */}
      <div
        className={`p-4 rounded-lg ${
          targetingQuality === 'good'
            ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800'
            : targetingQuality === 'moderate'
              ? 'bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800'
              : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800'
        }`}
      >
        <h4 className="font-medium text-gray-900 dark:text-white mb-2">
          {isStudent ? 'How Well Do Questions Match People?' : 'Person-Item Targeting'}
        </h4>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-600 dark:text-gray-400">
              {isStudent ? 'Average Person:' : 'Person Mean:'}
            </span>
            <span className="ml-2 font-medium text-gray-900 dark:text-white">
              {personMean.toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">
              {isStudent ? 'Average Question:' : 'Item Mean:'}
            </span>
            <span className="ml-2 font-medium text-gray-900 dark:text-white">
              {itemMean.toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">
              {isStudent ? 'Match Quality:' : 'Targeting:'}
            </span>
            <span
              className={`ml-2 font-medium ${
                targetingQuality === 'good'
                  ? 'text-green-600 dark:text-green-400'
                  : targetingQuality === 'moderate'
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-red-600 dark:text-red-400'
              }`}
            >
              {targetingQuality === 'good'
                ? isStudent
                  ? 'Good'
                  : 'Good (Δ < 0.5)'
                : targetingQuality === 'moderate'
                  ? isStudent
                    ? 'Okay'
                    : 'Moderate (Δ < 1.0)'
                  : isStudent
                    ? 'Poor'
                    : 'Poor (Δ ≥ 1.0)'}
            </span>
          </div>
        </div>
        {isResearcher && (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Difference: {targetingDiff.toFixed(3)} logits. Good targeting occurs when person and
            item distributions overlap substantially.
          </p>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center space-x-6 text-sm text-gray-600 dark:text-gray-400">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span>Person distribution</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span>Item difficulty</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-2 bg-orange-500 opacity-70" />
          <span>Category thresholds</span>
        </div>
      </div>
    </div>
  )
}
