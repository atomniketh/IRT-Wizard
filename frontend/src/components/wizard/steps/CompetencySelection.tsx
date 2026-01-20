import { GraduationCap, BookOpen, Microscope } from 'lucide-react'
import { clsx } from 'clsx'
import type { CompetencyLevel } from '@/types'
import type { WizardEvent } from '../WizardMachine'

interface CompetencyOption {
  level: CompetencyLevel
  icon: typeof GraduationCap
  title: string
  description: string
}

const competencyOptions: CompetencyOption[] = [
  {
    level: 'student',
    icon: GraduationCap,
    title: 'Student',
    description: 'Simple explanations and guided analysis. Perfect for learning IRT basics.',
  },
  {
    level: 'educator',
    icon: BookOpen,
    title: 'Educator',
    description: 'Clear explanations with standard statistics. Ideal for classroom use.',
  },
  {
    level: 'researcher',
    icon: Microscope,
    title: 'Researcher',
    description: 'Full control with technical details. All parameters and diagnostics available.',
  },
]

interface CompetencySelectionProps {
  send: (event: WizardEvent) => void
}

export function CompetencySelection({ send }: CompetencySelectionProps) {
  const handleSelect = (level: CompetencyLevel) => {
    send({ type: 'SELECT_COMPETENCY', level })
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome to IRT Wizard</h2>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Select your experience level to customize the interface
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {competencyOptions.map((option) => {
          const Icon = option.icon

          return (
            <button
              key={option.level}
              onClick={() => handleSelect(option.level)}
              className={clsx(
                'p-6 rounded-xl border-2 text-left transition-all duration-200',
                'hover:border-primary-500 hover:shadow-md',
                'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900',
                'border-gray-200 dark:border-gray-700 dark:bg-gray-800'
              )}
            >
              <div className="flex items-center space-x-3 mb-3">
                <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900">
                  <Icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{option.title}</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{option.description}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
