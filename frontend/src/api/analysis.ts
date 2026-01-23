import { apiClient } from './client'
import type {
  Analysis,
  ModelType,
  AnalysisConfig,
  ICCCurve,
  InformationFunctions,
  CategoryProbabilityCurve,
  WrightMapData,
  FitStatisticsItem,
  ReliabilityStatistics,
  PCARResult,
  DIFAnalysisResult,
  CategoryStructureTable,
} from '@/types'

export interface CreateAnalysisInput {
  project_id: string
  dataset_id: string
  name?: string
  model_type: ModelType
  config?: AnalysisConfig
}

export interface AnalysisStatusResponse {
  id: string
  status: string
  progress: number | null
  message: string | null
}

export const analysisApi = {
  create: async (data: CreateAnalysisInput): Promise<Analysis> => {
    const response = await apiClient.post('/analyses', data)
    return response.data
  },

  get: async (id: string): Promise<Analysis> => {
    const response = await apiClient.get(`/analyses/${id}`)
    return response.data
  },

  getStatus: async (id: string): Promise<AnalysisStatusResponse> => {
    const response = await apiClient.get(`/analyses/${id}/status`)
    return response.data
  },

  getLogs: async (id: string, since: number = 0): Promise<{ logs: string[]; count: number; next_index: number }> => {
    const response = await apiClient.get(`/analyses/${id}/logs`, { params: { since } })
    return response.data
  },

  getItemParameters: async (id: string) => {
    const response = await apiClient.get(`/analyses/${id}/item-parameters`)
    return response.data
  },

  getAbilities: async (id: string) => {
    const response = await apiClient.get(`/analyses/${id}/abilities`)
    return response.data
  },

  getFitStatistics: async (id: string) => {
    const response = await apiClient.get(`/analyses/${id}/fit-statistics`)
    return response.data
  },

  getICCData: async (id: string): Promise<ICCCurve[]> => {
    const response = await apiClient.get(`/analyses/${id}/icc-data`)
    return response.data
  },

  getInformationFunctions: async (id: string): Promise<InformationFunctions> => {
    const response = await apiClient.get(`/analyses/${id}/information-functions`)
    return response.data
  },

  // Polytomous model endpoints
  getCategoryProbabilityCurves: async (id: string, item?: string): Promise<CategoryProbabilityCurve[]> => {
    const params = item ? { item } : {}
    const response = await apiClient.get(`/analyses/${id}/category-probability-curves`, { params })
    return response.data
  },

  getWrightMap: async (id: string): Promise<WrightMapData> => {
    const response = await apiClient.get(`/analyses/${id}/wright-map`)
    return response.data
  },

  getItemFitStatistics: async (id: string): Promise<FitStatisticsItem[]> => {
    const response = await apiClient.get(`/analyses/${id}/item-fit-statistics`)
    return response.data
  },

  // Phase 2: Additional Rasch Analyses endpoints
  getReliability: async (id: string): Promise<ReliabilityStatistics> => {
    const response = await apiClient.get(`/analyses/${id}/reliability`)
    return response.data
  },

  getCategoryStructure: async (id: string): Promise<CategoryStructureTable> => {
    const response = await apiClient.get(`/analyses/${id}/category-structure`)
    return response.data
  },

  getPCAR: async (id: string, nComponents: number = 5): Promise<PCARResult> => {
    const response = await apiClient.get(`/analyses/${id}/pcar`, {
      params: { n_components: nComponents },
    })
    return response.data
  },

  getDIF: async (id: string, groupColumn?: string): Promise<DIFAnalysisResult> => {
    const params = groupColumn ? { group_column: groupColumn } : {}
    const response = await apiClient.get(`/analyses/${id}/dif`, { params })
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/analyses/${id}`)
  },
}

export const exportsApi = {
  downloadCsv: (analysisId: string): string => {
    return `${apiClient.defaults.baseURL}/exports/${analysisId}/csv`
  },

  downloadExcel: (analysisId: string): string => {
    return `${apiClient.defaults.baseURL}/exports/${analysisId}/excel`
  },

  downloadPdf: (analysisId: string, type: 'summary' | 'detailed' = 'summary'): string => {
    return `${apiClient.defaults.baseURL}/exports/${analysisId}/pdf-report?report_type=${type}`
  },
}
