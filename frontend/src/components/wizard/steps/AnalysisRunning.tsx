import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { useAnalysis } from '@/hooks/useAnalysis'
import type { WizardContext, WizardEvent } from '../WizardMachine'

interface AnalysisRunningProps {
  send: (event: WizardEvent) => void
  context: WizardContext
}

export function AnalysisRunning({ send, context }: AnalysisRunningProps) {
  const analysisId = context.analysis?.id || null
  const { status, isCompleted, isFailed, analysis, error } = useAnalysis(analysisId)

  useEffect(() => {
    if (isCompleted && analysis) {
      send({ type: 'ANALYSIS_COMPLETE', analysis })
    }
    if (isFailed && error) {
      send({ type: 'ANALYSIS_FAILED', error })
    }
  }, [isCompleted, isFailed, analysis, error, send])

  return (
    <div className="py-12">
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <div className="relative">
            <Loader2 className="w-16 h-16 text-primary-600 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-medium text-primary-600">IRT</span>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Running Analysis</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {context.modelType} model fitting in progress...
          </p>
        </div>

        <div className="max-w-md mx-auto">
          <div className="bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
            <div className="bg-primary-600 h-full animate-pulse" style={{ width: '60%' }} />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Status: {status}
          </p>
        </div>

        <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
          <p>Estimating item parameters...</p>
          <p>Computing ability estimates...</p>
          <p>Calculating fit statistics...</p>
        </div>
      </div>
    </div>
  )
}
