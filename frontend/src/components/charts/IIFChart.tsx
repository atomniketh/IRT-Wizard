import { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { analysisApi } from '@/api/analysis'
import { Tooltip as HelpTooltip } from '../common/Tooltip'
import { useCompetencyLevel } from '@/hooks/useCompetencyLevel'
import type { InformationFunctions } from '@/types'

interface IIFChartProps {
  analysisId: string
  selectedItems?: string[]
}

const COLORS = [
  '#0ea5e9',
  '#f97316',
  '#22c55e',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f59e0b',
  '#6366f1',
  '#84cc16',
]

export function IIFChart({ analysisId, selectedItems }: IIFChartProps) {
  const [data, setData] = useState<InformationFunctions | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set())

  const { isStudent } = useCompetencyLevel()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await analysisApi.getInformationFunctions(analysisId)
        setData(result)
        setVisibleItems(
          new Set(result.item_information.slice(0, 5).map((d) => d.item_name))
        )
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
    return <div className="p-4 bg-red-50 text-red-700 rounded-lg">{error || 'No data'}</div>
  }

  const filteredItems =
    selectedItems && selectedItems.length > 0
      ? data.item_information.filter((d) => selectedItems.includes(d.item_name))
      : data.item_information.filter((d) => visibleItems.has(d.item_name))

  const chartData = data.item_information[0]?.data.map((point, index) => {
    const dataPoint: Record<string, number> = { theta: point.theta }
    filteredItems.forEach((item) => {
      dataPoint[item.item_name] = item.data[index]?.information ?? 0
    })
    return dataPoint
  }) ?? []

  const toggleItem = (itemName: string) => {
    const newVisible = new Set(visibleItems)
    if (newVisible.has(itemName)) {
      newVisible.delete(itemName)
    } else {
      newVisible.add(itemName)
    }
    setVisibleItems(newVisible)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h3 className="font-semibold text-gray-900">
            {isStudent ? 'Where Items Measure Best' : 'Item Information Functions'}
          </h3>
          <HelpTooltip tooltipKey="iif" />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
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
                value: 'Information',
                angle: -90,
                position: 'insideLeft',
              }}
              tickFormatter={(value) => value.toFixed(2)}
              stroke="#6b7280"
            />
            <Tooltip
              formatter={(value: number) => value.toFixed(3)}
              labelFormatter={(label) => `θ = ${Number(label).toFixed(2)}`}
            />
            <Legend />
            {filteredItems.map((item, index) => (
              <Line
                key={item.item_name}
                type="monotone"
                dataKey={item.item_name}
                stroke={COLORS[index % COLORS.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {data.item_information.length > 5 && (
        <div className="flex flex-wrap gap-2">
          {data.item_information.map((item, index) => (
            <button
              key={item.item_name}
              onClick={() => toggleItem(item.item_name)}
              className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                visibleItems.has(item.item_name)
                  ? 'bg-primary-100 border-primary-300 text-primary-700'
                  : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span
                className="inline-block w-2 h-2 rounded-full mr-2"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              {item.item_name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
