import { useMemo, useState, useEffect } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { analysisApi } from '@/api/analysis'
import { Tooltip as HelpTooltip } from '../common/Tooltip'
import { useCompetencyLevel } from '@/hooks/useCompetencyLevel'
import { AbilityDistributionTooltip } from './ChartTooltips'
import type { AbilityEstimate } from '@/types'

interface AbilityDistributionProps {
  analysisId?: string
  estimates?: AbilityEstimate[]
}

export function AbilityDistribution({ analysisId, estimates: propEstimates }: AbilityDistributionProps) {
  const [fetchedEstimates, setFetchedEstimates] = useState<AbilityEstimate[]>([])
  const [isLoading, setIsLoading] = useState(!!analysisId)
  const [error, setError] = useState<string | null>(null)
  const { isStudent, isResearcher } = useCompetencyLevel()

  useEffect(() => {
    if (!analysisId) return

    const fetchData = async () => {
      try {
        const data = await analysisApi.getAbilities(analysisId)
        const persons = data.persons || []
        setFetchedEstimates(persons.map((p: { id: string; theta: number; se?: number }) => ({
          id: p.id,
          theta: p.theta,
          se: p.se
        })))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load ability estimates')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [analysisId])

  const estimates = propEstimates || fetchedEstimates

  const histogramData = useMemo(() => {
    if (estimates.length === 0) return []

    const thetas = estimates.map((e) => e.theta)
    const min = Math.floor(Math.min(...thetas))
    const max = Math.ceil(Math.max(...thetas))
    const binWidth = 0.5
    const bins: Record<number, number> = {}

    for (let i = min; i <= max; i += binWidth) {
      bins[i] = 0
    }

    thetas.forEach((theta) => {
      const binKey = Math.floor(theta / binWidth) * binWidth
      if (bins[binKey] !== undefined) {
        bins[binKey]++
      }
    })

    return Object.entries(bins).map(([theta, count]) => ({
      theta: parseFloat(theta),
      count,
      percentage: ((count / estimates.length) * 100).toFixed(1),
    }))
  }, [estimates])

  const stats = useMemo(() => {
    if (estimates.length === 0) return null

    const thetas = estimates.map((e) => e.theta)
    const mean = thetas.reduce((a, b) => a + b, 0) / thetas.length
    const variance = thetas.reduce((sum, t) => sum + (t - mean) ** 2, 0) / thetas.length
    const std = Math.sqrt(variance)
    const sorted = [...thetas].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]

    return { mean, std, median, min: sorted[0], max: sorted[sorted.length - 1] }
  }, [estimates])

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

  if (estimates.length === 0) {
    return <div className="text-gray-500 dark:text-gray-400">No ability estimates available</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          {isStudent ? 'Distribution of Scores' : 'Ability Distribution'}
        </h3>
        <HelpTooltip tooltipKey="ability_distribution" />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={histogramData} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="theta"
              label={{
                value: isStudent ? 'Ability Score' : 'Theta (θ)',
                position: 'insideBottom',
                offset: -5,
              }}
              tickFormatter={(value) => value.toFixed(1)}
              stroke="#6b7280"
            />
            <YAxis
              label={{
                value: isStudent ? 'Number of Students' : 'Frequency',
                angle: -90,
                position: 'insideLeft',
              }}
              stroke="#6b7280"
            />
            <Tooltip content={(props) => <AbilityDistributionTooltip {...props} isStudent={isStudent} />} />
            <Bar dataKey="count" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {stats && (
        <div className="grid gap-4 md:grid-cols-5">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-600 dark:text-gray-400">N</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{estimates.length}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-600 dark:text-gray-400">Mean</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{stats.mean.toFixed(2)}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-600 dark:text-gray-400">{isStudent ? 'Spread' : 'SD'}</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{stats.std.toFixed(2)}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-600 dark:text-gray-400">Min</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{stats.min.toFixed(2)}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-600 dark:text-gray-400">Max</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{stats.max.toFixed(2)}</p>
          </div>
        </div>
      )}

      {isResearcher && stats && (
        <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
          <p>
            <strong>Note:</strong> Ability estimates are on the standardized IRT scale (mean ≈ 0,
            SD ≈ 1). The observed mean of {stats.mean.toFixed(3)} and SD of {stats.std.toFixed(3)}{' '}
            indicate the sample is{' '}
            {Math.abs(stats.mean) < 0.1
              ? 'well-centered'
              : stats.mean > 0
                ? 'above average ability'
                : 'below average ability'}
            .
          </p>
        </div>
      )}
    </div>
  )
}
