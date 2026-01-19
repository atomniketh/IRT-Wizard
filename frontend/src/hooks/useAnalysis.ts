import { useState, useEffect, useCallback } from 'react'
import { analysisApi } from '@/api/analysis'
import type { Analysis, AnalysisStatus } from '@/types'

interface UseAnalysisOptions {
  pollInterval?: number
}

export function useAnalysis(analysisId: string | null, options: UseAnalysisOptions = {}) {
  const { pollInterval = 2000 } = options
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [status, setStatus] = useState<AnalysisStatus>('pending')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAnalysis = useCallback(async () => {
    if (!analysisId) return

    try {
      const data = await analysisApi.get(analysisId)
      setAnalysis(data)
      setStatus(data.status)
      return data.status
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analysis')
      return null
    }
  }, [analysisId])

  const fetchStatus = useCallback(async () => {
    if (!analysisId) return

    try {
      const data = await analysisApi.getStatus(analysisId)
      setStatus(data.status as AnalysisStatus)
      return data.status
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status')
      return null
    }
  }, [analysisId])

  useEffect(() => {
    if (!analysisId) return

    setIsLoading(true)
    fetchAnalysis().finally(() => setIsLoading(false))
  }, [analysisId, fetchAnalysis])

  useEffect(() => {
    if (!analysisId || status === 'completed' || status === 'failed') return

    const interval = setInterval(async () => {
      const newStatus = await fetchStatus()
      if (newStatus === 'completed' || newStatus === 'failed') {
        clearInterval(interval)
        await fetchAnalysis()
      }
    }, pollInterval)

    return () => clearInterval(interval)
  }, [analysisId, status, pollInterval, fetchStatus, fetchAnalysis])

  return {
    analysis,
    status,
    isLoading,
    error,
    isRunning: status === 'running' || status === 'pending',
    isCompleted: status === 'completed',
    isFailed: status === 'failed',
    refetch: fetchAnalysis,
  }
}
