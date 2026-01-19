import { apiClient } from './client'
import type { Project, CompetencyLevel } from '@/types'

export interface CreateProjectInput {
  name: string
  description?: string
  competency_level?: CompetencyLevel
}

export interface UpdateProjectInput {
  name?: string
  description?: string
  competency_level?: CompetencyLevel
}

export const projectsApi = {
  list: async (): Promise<Project[]> => {
    const response = await apiClient.get('/projects')
    return response.data
  },

  get: async (id: string): Promise<Project> => {
    const response = await apiClient.get(`/projects/${id}`)
    return response.data
  },

  create: async (data: CreateProjectInput): Promise<Project> => {
    const response = await apiClient.post('/projects', data)
    return response.data
  },

  update: async (id: string, data: UpdateProjectInput): Promise<Project> => {
    const response = await apiClient.put(`/projects/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/projects/${id}`)
  },
}
