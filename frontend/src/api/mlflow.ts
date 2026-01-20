import { apiClient } from './client'

export interface MLflowExperiment {
  experiment_id: string
  name: string
  artifact_location: string
  lifecycle_stage: string
  tags: Record<string, string>
  creation_time: number
  last_update_time: number
  run_count: number
}

export interface MLflowRun {
  run_id: string
  run_name: string
  status: string
  start_time: number
  end_time: number | null
  artifact_uri: string
  params: Record<string, string>
  metrics: Record<string, number>
  tags: Record<string, string>
}

export interface MLflowRunDetail extends MLflowRun {
  experiment_id: string
  metric_history: Record<string, Array<{ timestamp: number; step: number; value: number }>>
}

export interface MLflowComparison {
  runs: Array<{
    run_id: string
    run_name: string
    start_time: number
    params: Record<string, string>
    metrics: Record<string, number>
  }>
  param_keys: string[]
  metric_keys: string[]
}

export const mlflowApi = {
  async getExperiments(): Promise<MLflowExperiment[]> {
    const response = await apiClient.get('/mlflow/experiments')
    return response.data
  },

  async getRuns(experimentId: string): Promise<MLflowRun[]> {
    const response = await apiClient.get(`/mlflow/experiments/${experimentId}/runs`)
    return response.data
  },

  async getRun(runId: string): Promise<MLflowRunDetail> {
    const response = await apiClient.get(`/mlflow/runs/${runId}`)
    return response.data
  },

  async compareRuns(runIds: string[]): Promise<MLflowComparison> {
    const response = await apiClient.get('/mlflow/compare', {
      params: { run_ids: runIds.join(',') }
    })
    return response.data
  },

  async deleteRun(runId: string): Promise<void> {
    await apiClient.delete(`/mlflow/runs/${runId}`)
  },
}
