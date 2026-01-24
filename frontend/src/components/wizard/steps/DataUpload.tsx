import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, Link, FileSpreadsheet, ArrowLeft, FolderOpen, Plus } from 'lucide-react'
import { clsx } from 'clsx'
import { Button } from '../../common/Button'
import { projectsApi } from '@/api/projects'
import { datasetsApi } from '@/api/datasets'
import type { Project } from '@/types'
import type { WizardContext, WizardEvent } from '../WizardMachine'

interface DataUploadProps {
  send: (event: WizardEvent) => void
  context: WizardContext
}

export function DataUpload({ send, context }: DataUploadProps) {
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file')
  const [url, setUrl] = useState('')
  const [projectMode, setProjectMode] = useState<'new' | 'existing'>('new')
  const [projectName, setProjectName] = useState('')
  const [existingProjects, setExistingProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!context.project) {
      projectsApi.list().then(setExistingProjects).catch(console.error)
    }
  }, [context.project])

  const isProjectNameTaken = projectMode === 'new' && projectName.trim() !== '' &&
    existingProjects.some(p => p.name.toLowerCase() === projectName.trim().toLowerCase())

  const handleUpload = useCallback(
    async (file: File) => {
      if (isProjectNameTaken) {
        setError('A project with this name already exists. Please choose a different name.')
        return
      }

      setIsUploading(true)
      setError(null)

      try {
        let project = context.project
        if (!project) {
          if (projectMode === 'existing' && selectedProjectId) {
            const found = existingProjects.find(p => p.id === selectedProjectId)
            if (!found) {
              throw new Error('Selected project not found')
            }
            project = found
          } else {
            const name = projectName.trim() || `Analysis ${new Date().toLocaleDateString()}`
            project = await projectsApi.create({
              name,
              competency_level: context.competencyLevel || 'educator',
            })
          }
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
    [context.project, context.competencyLevel, projectName, projectMode, selectedProjectId, existingProjects, isProjectNameTaken, send]
  )

  const handleUrlFetch = useCallback(async () => {
    if (!url.trim()) return

    if (isProjectNameTaken) {
      setError('A project with this name already exists. Please choose a different name.')
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      let project = context.project
      if (!project) {
        if (projectMode === 'existing' && selectedProjectId) {
          const found = existingProjects.find(p => p.id === selectedProjectId)
          if (!found) {
            throw new Error('Selected project not found')
          }
          project = found
        } else {
          const name = projectName.trim() || `Analysis ${new Date().toLocaleDateString()}`
          project = await projectsApi.create({
            name,
            competency_level: context.competencyLevel || 'educator',
          })
        }
        send({ type: 'CREATE_PROJECT', project })
      }

      const dataset = await datasetsApi.fromUrl(project.id, url)
      send({ type: 'UPLOAD_DATA', dataset, project })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch URL')
    } finally {
      setIsUploading(false)
    }
  }, [url, context.project, context.competencyLevel, projectName, projectMode, selectedProjectId, existingProjects, isProjectNameTaken, send])

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
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/octet-stream': ['.parquet'],
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
          Upload a data file with response data (rows = respondents, columns = items)
        </p>
      </div>

      {!context.project && (
        <div className="max-w-md mx-auto space-y-4">
          <div className="flex justify-center space-x-2">
            <button
              onClick={() => setProjectMode('new')}
              className={clsx(
                'flex items-center px-4 py-2 rounded-lg font-medium transition-colors',
                projectMode === 'new'
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
              )}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </button>
            {existingProjects.length > 0 && (
              <button
                onClick={() => setProjectMode('existing')}
                className={clsx(
                  'flex items-center px-4 py-2 rounded-lg font-medium transition-colors',
                  projectMode === 'existing'
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                )}
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                Existing Project
              </button>
            )}
          </div>

          {projectMode === 'new' ? (
            <div>
              <label htmlFor="projectName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Project Name
              </label>
              <input
                type="text"
                id="projectName"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder={`Analysis ${new Date().toLocaleDateString()}`}
                className={clsx(
                  'w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2',
                  isProjectNameTaken
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-gray-300 dark:border-gray-600 focus:ring-primary-500',
                  'dark:bg-gray-800 dark:text-gray-100'
                )}
              />
              {isProjectNameTaken ? (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  A project with this name already exists
                </p>
              ) : (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Give your project a memorable name (optional)
                </p>
              )}
            </div>
          ) : (
            <div>
              <label htmlFor="existingProject" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Select Project
              </label>
              <select
                id="existingProject"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Choose a project...</option>
                {existingProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {context.project && (
        <div className="max-w-md mx-auto text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Adding to project: <span className="font-medium text-gray-900 dark:text-white">{context.project.name}</span>
          </p>
        </div>
      )}

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
              <p className="text-gray-600 dark:text-gray-300 font-medium">Drag & drop your data file here</p>
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
        <p>Supported formats: CSV, TSV, XLS, XLSX, Parquet</p>
      </div>
    </div>
  )
}
