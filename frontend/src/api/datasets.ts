import { apiClient } from './client'
import type { Dataset } from '@/types'

export interface DatasetPreview {
  columns: string[]
  rows: Record<string, unknown>[]
  total_rows: number
  total_columns: number
}

export const datasetsApi = {
  upload: async (projectId: string, file: File): Promise<Dataset> => {
    const formData = new FormData()
    formData.append('file', file)

    const response = await apiClient.post(`/datasets/upload?project_id=${projectId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  fromUrl: async (projectId: string, url: string): Promise<Dataset> => {
    const response = await apiClient.post(`/datasets/from-url?project_id=${projectId}&url=${encodeURIComponent(url)}`)
    return response.data
  },

  get: async (id: string): Promise<Dataset> => {
    const response = await apiClient.get(`/datasets/${id}`)
    return response.data
  },

  preview: async (id: string, rows: number = 10): Promise<DatasetPreview> => {
    const response = await apiClient.get(`/datasets/${id}/preview?rows=${rows}`)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/datasets/${id}`)
  },
}
