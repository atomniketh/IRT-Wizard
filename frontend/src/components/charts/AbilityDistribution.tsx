import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useCompetencyLevel } from '@/hooks/useCompetencyLevel'
import type { AbilityEstimate } from '@/types'

interface AbilityDistributionProps {
  estimates: AbilityEstimate[]
}

export function AbilityDistribution({ estimates }: AbilityDistributionProps) {
  const { isStudent, isResearcher } = useCompetencyLevel()

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

  if (estimates.length === 0) {
    return <div className="text-gray-500">No ability estimates available</div>
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900">
        {isStudent ? 'Distribution of Scores' : 'Ability Distribution'}
      </h3>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={histogramData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="theta"
              label={{
                value: isStudent ? 'Ability Score' : 'Theta (θ)',
                position: 'bottom',
                offset: 0,
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
            <Tooltip
              formatter={(value: number, name: string) => [
                name === 'count' ? value : `${value}%`,
                name === 'count' ? (isStudent ? 'Students' : 'Persons') : 'Percentage',
              ]}
              labelFormatter={(label) => `θ = ${Number(label).toFixed(2)}`}
            />
            <Bar dataKey="count" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {stats && (
        <div className="grid gap-4 md:grid-cols-5">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-600">N</p>
            <p className="text-lg font-bold text-gray-900">{estimates.length}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-600">Mean</p>
            <p className="text-lg font-bold text-gray-900">{stats.mean.toFixed(2)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-600">{isStudent ? 'Spread' : 'SD'}</p>
            <p className="text-lg font-bold text-gray-900">{stats.std.toFixed(2)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-600">Min</p>
            <p className="text-lg font-bold text-gray-900">{stats.min.toFixed(2)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-600">Max</p>
            <p className="text-lg font-bold text-gray-900">{stats.max.toFixed(2)}</p>
          </div>
        </div>
      )}

      {isResearcher && stats && (
        <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
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
