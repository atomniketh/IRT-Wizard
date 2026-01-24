import type { TooltipProps } from 'recharts'
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent'

interface CustomTooltipBaseProps {
  isStudent: boolean
}

export function ICCTooltip({
  active,
  payload,
  label,
  isStudent,
}: TooltipProps<ValueType, NameType> & CustomTooltipBaseProps) {
  if (!active || !payload || payload.length === 0) return null

  const theta = Number(label)
  const abilityDesc = theta < -1 ? 'low' : theta > 1 ? 'high' : 'average'

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 max-w-xs">
      <p className="font-semibold text-gray-900 dark:text-white mb-2">
        {isStudent ? `Ability: ${theta.toFixed(2)}` : `θ = ${theta.toFixed(2)}`}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        {isStudent
          ? `At this ${abilityDesc} ability level:`
          : `Probability of correct response at this ability level:`}
      </p>
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex justify-between items-center text-sm">
            <span style={{ color: entry.color }} className="font-medium">
              {entry.name}
            </span>
            <span className="text-gray-700 dark:text-gray-300 ml-4">
              {isStudent
                ? `${(Number(entry.value) * 100).toFixed(0)}% chance`
                : Number(entry.value).toFixed(3)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function IIFTooltip({
  active,
  payload,
  label,
  isStudent,
}: TooltipProps<ValueType, NameType> & CustomTooltipBaseProps) {
  if (!active || !payload || payload.length === 0) return null

  const theta = Number(label)
  const maxInfo = Math.max(...payload.map((p) => Number(p.value) || 0))
  const infoLevel = maxInfo < 0.3 ? 'low' : maxInfo > 0.7 ? 'high' : 'moderate'

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 max-w-xs">
      <p className="font-semibold text-gray-900 dark:text-white mb-2">
        {isStudent ? `Ability: ${theta.toFixed(2)}` : `θ = ${theta.toFixed(2)}`}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        {isStudent
          ? `How precisely each item measures at this level (${infoLevel} overall):`
          : `Item information values (higher = more precise measurement):`}
      </p>
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex justify-between items-center text-sm">
            <span style={{ color: entry.color }} className="font-medium">
              {entry.name}
            </span>
            <span className="text-gray-700 dark:text-gray-300 ml-4">
              {Number(entry.value).toFixed(3)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function TIFTooltip({
  active,
  payload,
  label,
  isStudent,
}: TooltipProps<ValueType, NameType> & CustomTooltipBaseProps) {
  if (!active || !payload || payload.length === 0) return null

  const theta = Number(label)
  const info = Number(payload[0]?.value) || 0
  const se = info > 0 ? 1 / Math.sqrt(info) : null
  const precision = info < 2 ? 'low' : info > 5 ? 'high' : 'moderate'

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 max-w-xs">
      <p className="font-semibold text-gray-900 dark:text-white mb-2">
        {isStudent ? `Ability: ${theta.toFixed(2)}` : `θ = ${theta.toFixed(2)}`}
      </p>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">
            {isStudent ? 'Test Precision:' : 'Information:'}
          </span>
          <span className="font-medium text-gray-900 dark:text-white">{info.toFixed(3)}</span>
        </div>
        {se && (
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">
              {isStudent ? 'Measurement Error:' : 'SE(θ):'}
            </span>
            <span className="font-medium text-gray-900 dark:text-white">{se.toFixed(3)}</span>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
        {isStudent
          ? `The test has ${precision} precision at this ability level.`
          : `${precision.charAt(0).toUpperCase() + precision.slice(1)} measurement precision. SE = 1/√I(θ).`}
      </p>
    </div>
  )
}

export function AbilityDistributionTooltip({
  active,
  payload,
  label,
  isStudent,
}: TooltipProps<ValueType, NameType> & CustomTooltipBaseProps) {
  if (!active || !payload || payload.length === 0) return null

  const theta = Number(label)
  const count = Number(payload[0]?.value) || 0
  const percentage = payload[0]?.payload?.percentage || '0'
  const abilityDesc = theta < -1 ? 'below average' : theta > 1 ? 'above average' : 'around average'

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 max-w-xs">
      <p className="font-semibold text-gray-900 dark:text-white mb-2">
        {isStudent ? `Ability Range: ${theta.toFixed(1)} to ${(theta + 0.5).toFixed(1)}` : `θ = ${theta.toFixed(2)} to ${(theta + 0.5).toFixed(2)}`}
      </p>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">
            {isStudent ? 'Number of People:' : 'Count:'}
          </span>
          <span className="font-medium text-gray-900 dark:text-white">{count}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Percentage:</span>
          <span className="font-medium text-gray-900 dark:text-white">{percentage}%</span>
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
        {isStudent
          ? `These people scored ${abilityDesc}.`
          : `Persons with ${abilityDesc} ability (${theta < 0 ? 'below' : theta > 0 ? 'above' : 'at'} the mean).`}
      </p>
    </div>
  )
}

export function CategoryProbabilityTooltip({
  active,
  payload,
  label,
  isStudent,
}: TooltipProps<ValueType, NameType> & CustomTooltipBaseProps) {
  if (!active || !payload || payload.length === 0) return null

  const theta = Number(label)
  const sortedPayload = [...payload].sort((a, b) => Number(b.value) - Number(a.value))
  const mostLikely = sortedPayload[0]

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 max-w-xs">
      <p className="font-semibold text-gray-900 dark:text-white mb-2">
        {isStudent ? `Ability: ${theta.toFixed(2)}` : `θ = ${theta.toFixed(2)}`}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        {isStudent
          ? `Most likely response: ${mostLikely?.name} (${(Number(mostLikely?.value) * 100).toFixed(0)}%)`
          : `Expected response probabilities at this ability level:`}
      </p>
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {payload.map((entry, index) => (
          <div key={index} className="flex justify-between items-center text-sm">
            <span style={{ color: entry.color }} className="font-medium">
              {entry.name}
            </span>
            <span className="text-gray-700 dark:text-gray-300 ml-4">
              {isStudent
                ? `${(Number(entry.value) * 100).toFixed(0)}%`
                : Number(entry.value).toFixed(3)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function WrightMapPersonTooltip({
  active,
  payload,
  label,
  isStudent,
}: TooltipProps<ValueType, NameType> & CustomTooltipBaseProps) {
  if (!active || !payload || payload.length === 0) return null

  const theta = Number(label)
  const count = Number(payload[0]?.value) || 0
  const abilityDesc = theta < -1 ? 'lower' : theta > 1 ? 'higher' : 'average'

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 max-w-xs">
      <p className="font-semibold text-gray-900 dark:text-white mb-2">
        {isStudent ? `Ability Level: ${theta.toFixed(2)}` : `θ = ${theta.toFixed(2)} logits`}
      </p>
      <div className="flex justify-between text-sm">
        <span className="text-gray-600 dark:text-gray-400">
          {isStudent ? 'People at this level:' : 'Person count:'}
        </span>
        <span className="font-medium text-gray-900 dark:text-white">{count}</span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
        {isStudent
          ? `People with ${abilityDesc} ability. Items at this level are a good match.`
          : `Persons at this ability level are well-matched to items at similar logit values.`}
      </p>
    </div>
  )
}
