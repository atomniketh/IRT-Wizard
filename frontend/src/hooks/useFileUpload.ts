import { useState, useCallback } from 'react'
import { datasetsApi } from '@/api/datasets'
import type { Dataset } from '@/types'

interface UseFileUploadOptions {
  projectId: string
  onSuccess?: (dataset: Dataset) => void
  onError?: (error: Error) => void
}

export function useFileUpload({ projectId, onSuccess, onError }: UseFileUploadOptions) {
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const uploadFile = useCallback(async (file: File) => {
    setIsUploading(true)
    setProgress(0)
    setError(null)

    try {
      setProgress(30)
      const result = await datasetsApi.upload(projectId, file)
      setProgress(100)

      if (onSuccess) {
        onSuccess(result as unknown as Dataset)
      }

      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Upload failed')
      setError(error.message)
      if (onError) {
        onError(error)
      }
      throw error
    } finally {
      setIsUploading(false)
    }
  }, [projectId, onSuccess, onError])

  const uploadFromUrl = useCallback(async (url: string) => {
    setIsUploading(true)
    setProgress(0)
    setError(null)

    try {
      setProgress(30)
      const result = await datasetsApi.fromUrl(projectId, url)
      setProgress(100)

      if (onSuccess) {
        onSuccess(result as unknown as Dataset)
      }

      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Fetch failed')
      setError(error.message)
      if (onError) {
        onError(error)
      }
      throw error
    } finally {
      setIsUploading(false)
    }
  }, [projectId, onSuccess, onError])

  return {
    uploadFile,
    uploadFromUrl,
    isUploading,
    progress,
    error,
    clearError: () => setError(null),
  }
}
