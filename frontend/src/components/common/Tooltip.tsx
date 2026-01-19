import { useState, ReactNode } from 'react'
import { clsx } from 'clsx'
import { HelpCircle } from 'lucide-react'
import { useCompetencyLevel } from '@/hooks/useCompetencyLevel'

interface TooltipProps {
  content?: string
  children?: ReactNode
  tooltipKey?: string
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export function Tooltip({ content = '', children, tooltipKey, position = 'top' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const { getTooltip, isStudent } = useCompetencyLevel()

  const tooltipContent = tooltipKey ? getTooltip(tooltipKey) : content

  if (!tooltipContent) return <>{children}</>

  const showTooltipOnLoad = isStudent

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children || <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />}
      {(isVisible || showTooltipOnLoad) && (
        <div
          className={clsx(
            'absolute z-50 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg max-w-xs',
            {
              'bottom-full left-1/2 -translate-x-1/2 mb-2': position === 'top',
              'top-full left-1/2 -translate-x-1/2 mt-2': position === 'bottom',
              'right-full top-1/2 -translate-y-1/2 mr-2': position === 'left',
              'left-full top-1/2 -translate-y-1/2 ml-2': position === 'right',
            }
          )}
        >
          {tooltipContent}
          <div
            className={clsx('absolute w-2 h-2 bg-gray-900 rotate-45', {
              'top-full left-1/2 -translate-x-1/2 -mt-1': position === 'top',
              'bottom-full left-1/2 -translate-x-1/2 -mb-1': position === 'bottom',
              'left-full top-1/2 -translate-y-1/2 -ml-1': position === 'left',
              'right-full top-1/2 -translate-y-1/2 -mr-1': position === 'right',
            })}
          />
        </div>
      )}
    </div>
  )
}
