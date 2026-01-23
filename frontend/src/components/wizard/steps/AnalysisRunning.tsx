import { useEffect, useState, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { TerminalWindow } from '../../common/TerminalWindow'
import { analysisApi } from '@/api/analysis'
import type { WizardContext, WizardEvent } from '../WizardMachine'

interface AnalysisRunningProps {
  send: (event: WizardEvent) => void
  context: WizardContext
}

export function AnalysisRunning({ send, context }: AnalysisRunningProps) {
  const [status, setStatus] = useState<string>('pending')
  const [logs, setLogs] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const logIndexRef = useRef(0)
  const analysisIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!context.analysis?.id) return

    const analysisId = context.analysis.id
    analysisIdRef.current = analysisId

    const pollStatusAndLogs = async () => {
      try {
        const [statusRes, logsRes] = await Promise.all([
          analysisApi.getStatus(analysisId),
          analysisApi.getLogs(analysisId, logIndexRef.current),
        ])

        setStatus(statusRes.status)

        if (logsRes.logs.length > 0) {
          setLogs((prev) => [...prev, ...logsRes.logs])
          logIndexRef.current = logsRes.next_index
        }

        if (statusRes.status === 'completed') {
          const fullAnalysis = await analysisApi.get(analysisId)
          send({ type: 'ANALYSIS_COMPLETE', analysis: fullAnalysis })
        } else if (statusRes.status === 'failed') {
          setError(statusRes.message || 'Analysis failed')
          send({ type: 'ANALYSIS_FAILED', error: statusRes.message || 'Analysis failed' })
        } else {
          setTimeout(pollStatusAndLogs, 1000)
        }
      } catch (err) {
        console.error('Error polling analysis status:', err)
        setTimeout(pollStatusAndLogs, 2000)
      }
    }

    setLogs([`$ Starting ${context.modelType} analysis...`])
    pollStatusAndLogs()

    return () => {
      analysisIdRef.current = null
    }
  }, [context.analysis?.id, context.modelType, send])

  const getStatusText = () => {
    switch (status) {
      case 'pending':
        return 'Initializing...'
      case 'running':
        return 'Running analysis...'
      case 'completed':
        return 'Completed!'
      case 'failed':
        return 'Failed'
      default:
        return status
    }
  }

  return (
    <div className="py-8 space-y-8">
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
            <div
              className="bg-primary-600 h-full transition-all duration-500"
              style={{
                width: status === 'completed' ? '100%' : status === 'running' ? '60%' : '20%',
              }}
            />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Status: {getStatusText()}
          </p>
        </div>
      </div>

      {/* Terminal Window */}
      <div className="max-w-3xl mx-auto">
        <TerminalWindow
          title={`${context.modelType} Analysis — ${context.dataset?.original_filename || 'Dataset'}`}
          logs={logs}
          maxHeight="350px"
        />
      </div>

      {error && (
        <div className="max-w-3xl mx-auto p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  )
}
