import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, Link, FileSpreadsheet, ArrowLeft } from 'lucide-react'
import { clsx } from 'clsx'
import { Button } from '../../common/Button'
import { projectsApi } from '@/api/projects'
import { datasetsApi } from '@/api/datasets'
import type { WizardContext, WizardEvent } from '../WizardMachine'

interface DataUploadProps {
  send: (event: WizardEvent) => void
  context: WizardContext
}

export function DataUpload({ send, context }: DataUploadProps) {
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file')
  const [url, setUrl] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleUpload = useCallback(
    async (file: File) => {
      setIsUploading(true)
      setError(null)

      try {
        let project = context.project
        if (!project) {
          project = await projectsApi.create({
            name: `Analysis ${new Date().toLocaleDateString()}`,
            competency_level: context.competencyLevel || 'educator',
          })
          send({ type: 'CREATE_PROJECT', project })
        }

        const dataset = await datasetsApi.upload(project.id, file)
        send({ type: 'UPLOAD_DATA', dataset, project })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        setIsUploading(false)
      }
    },
    [context.project, context.competencyLevel, send]
  )

  const handleUrlFetch = useCallback(async () => {
    if (!url.trim()) return

    setIsUploading(true)
    setError(null)

    try {
      let project = context.project
      if (!project) {
        project = await projectsApi.create({
          name: `Analysis ${new Date().toLocaleDateString()}`,
          competency_level: context.competencyLevel || 'educator',
        })
        send({ type: 'CREATE_PROJECT', project })
      }

      const dataset = await datasetsApi.fromUrl(project.id, url)
      send({ type: 'UPLOAD_DATA', dataset, project })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch URL')
    } finally {
      setIsUploading(false)
    }
  }, [url, context.project, context.competencyLevel, send])

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (file) {
        handleUpload(file)
      }
    },
    [handleUpload]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'text/tab-separated-values': ['.tsv'],
    },
    maxFiles: 1,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => send({ type: 'BACK' })}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </div>

      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Upload Your Data</h2>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Upload a CSV or TSV file with response data (rows = respondents, columns = items)
        </p>
      </div>

      <div className="flex justify-center space-x-4">
        <button
          onClick={() => setUploadMode('file')}
          className={clsx(
            'px-4 py-2 rounded-lg font-medium transition-colors',
            uploadMode === 'file'
              ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
          )}
        >
          <Upload className="w-4 h-4 inline mr-2" />
          Upload File
        </button>
        <button
          onClick={() => setUploadMode('url')}
          className={clsx(
            'px-4 py-2 rounded-lg font-medium transition-colors',
            uploadMode === 'url'
              ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
          )}
        >
          <Link className="w-4 h-4 inline mr-2" />
          From URL
        </button>
      </div>

      {uploadMode === 'file' ? (
        <div
          {...getRootProps()}
          className={clsx(
            'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors',
            isDragActive
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
              : 'border-gray-300 hover:border-primary-400 dark:border-gray-600 dark:hover:border-primary-500'
          )}
        >
          <input {...getInputProps()} />
          <FileSpreadsheet className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
          {isDragActive ? (
            <p className="text-primary-600 dark:text-primary-400 font-medium">Drop your file here</p>
          ) : (
            <>
              <p className="text-gray-600 dark:text-gray-300 font-medium">Drag & drop your CSV or TSV file here</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">or click to browse</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/data.csv"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <Button onClick={handleUrlFetch} isLoading={isUploading} className="w-full">
            Fetch Data
          </Button>
        </div>
      )}

      {isUploading && uploadMode === 'file' && (
        <div className="text-center text-gray-600 dark:text-gray-400">
          <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto mb-2" />
          Uploading...
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">{error}</div>
      )}

      <div className="text-center text-sm text-gray-500 dark:text-gray-400">
        <p>Maximum file size: 100MB</p>
        <p>Supported formats: CSV, TSV</p>
      </div>
    </div>
  )
}
