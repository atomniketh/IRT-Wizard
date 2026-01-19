import { clsx } from 'clsx'
import { Check } from 'lucide-react'

interface Step {
  key: string
  label: string
}

interface StepIndicatorProps {
  steps: Step[]
  currentStep: number
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <nav aria-label="Progress">
      <ol className="flex items-center justify-center space-x-2 md:space-x-4">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep
          const isCurrent = index === currentStep

          return (
            <li key={step.key} className="flex items-center">
              <div className="flex items-center">
                <div
                  className={clsx(
                    'flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors duration-200',
                    {
                      'bg-primary-600 border-primary-600 text-white': isCompleted,
                      'border-primary-600 text-primary-600': isCurrent,
                      'border-gray-300 text-gray-400': !isCompleted && !isCurrent,
                    }
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>
                <span
                  className={clsx('ml-2 text-sm font-medium hidden md:block', {
                    'text-primary-600': isCompleted || isCurrent,
                    'text-gray-400': !isCompleted && !isCurrent,
                  })}
                >
                  {step.label}
                </span>
              </div>

              {index < steps.length - 1 && (
                <div
                  className={clsx('w-8 md:w-16 h-0.5 mx-2 md:mx-4', {
                    'bg-primary-600': index < currentStep,
                    'bg-gray-300': index >= currentStep,
                  })}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
