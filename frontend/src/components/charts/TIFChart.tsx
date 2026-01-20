import { useState, useEffect } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { analysisApi } from '@/api/analysis'
import { Tooltip as HelpTooltip } from '../common/Tooltip'
import { useCompetencyLevel } from '@/hooks/useCompetencyLevel'
import type { InformationFunctions } from '@/types'

interface TIFChartProps {
  analysisId: string
}

export function TIFChart({ analysisId }: TIFChartProps) {
  const [data, setData] = useState<InformationFunctions | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { isStudent, isResearcher } = useCompetencyLevel()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await analysisApi.getInformationFunctions(analysisId)
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load information data')
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

  if (error || !data) {
    return <div className="p-4 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg">{error || 'No data'}</div>
  }

  const chartData = data.test_information.data.map((point) => ({
    theta: point.theta,
    information: point.information,
    se: point.information > 0 ? 1 / Math.sqrt(point.information) : null,
  }))

  const maxInfo = Math.max(...chartData.map((d) => d.information))
  const peakTheta = chartData.find((d) => d.information === maxInfo)?.theta ?? 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {isStudent ? 'Where the Test Measures Best' : 'Test Information Function'}
          </h3>
          <HelpTooltip tooltipKey="tif" />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <defs>
              <linearGradient id="tifGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="theta"
              label={{
                value: isStudent ? 'Ability' : 'Theta (θ)',
                position: 'bottom',
                offset: 0,
              }}
              tickFormatter={(value) => value.toFixed(1)}
              stroke="#6b7280"
            />
            <YAxis
              label={{
                value: 'Test Information',
                angle: -90,
                position: 'insideLeft',
              }}
              tickFormatter={(value) => value.toFixed(1)}
              stroke="#6b7280"
            />
            <Tooltip
              formatter={(value: number, name: string) => [
                value.toFixed(3),
                name === 'information' ? 'Information' : 'SE(θ)',
              ]}
              labelFormatter={(label) => `θ = ${Number(label).toFixed(2)}`}
            />
            <Area
              type="monotone"
              dataKey="information"
              stroke="#0ea5e9"
              strokeWidth={2}
              fill="url(#tifGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {isStudent ? 'Best Measurement At' : 'Peak Information'}
          </p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">θ = {peakTheta.toFixed(2)}</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {isStudent ? 'Maximum Accuracy' : 'Max Information'}
          </p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{maxInfo.toFixed(2)}</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {isStudent ? 'Smallest Error' : 'Min SE(θ)'}
          </p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {maxInfo > 0 ? (1 / Math.sqrt(maxInfo)).toFixed(3) : '-'}
          </p>
        </div>
      </div>

      {isResearcher && (
        <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
          <p>
            <strong>Interpretation:</strong> The test provides maximum information (minimum SE) at
            θ ≈ {peakTheta.toFixed(2)}. Information drops off as ability deviates from this point.
            SE(θ) = 1/√I(θ). Consider test targeting and precision requirements when evaluating.
          </p>
        </div>
      )}
    </div>
  )
}
