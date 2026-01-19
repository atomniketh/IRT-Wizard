export type CompetencyLevel = 'researcher' | 'educator' | 'student'

export type ModelType = '1PL' | '2PL' | '3PL'

export type AnalysisStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface Project {
  id: string
  name: string
  description: string | null
  competency_level: CompetencyLevel
  created_at: string
  updated_at: string
}

export interface Dataset {
  id: string
  project_id: string
  name: string
  file_path: string | null
  original_filename: string | null
  file_size: number | null
  row_count: number | null
  column_count: number | null
  item_names: string[] | null
  data_summary: Record<string, unknown> | null
  validation_status: string
  validation_errors: ValidationError[] | null
  created_at: string
}

export interface ValidationError {
  type: string
  message: string
  column?: string
  row?: number
}

export interface Analysis {
  id: string
  project_id: string
  dataset_id: string | null
  name: string | null
  model_type: ModelType
  status: AnalysisStatus
  config: AnalysisConfig | null
  item_parameters: ItemParametersResult | null
  ability_estimates: AbilityEstimatesResult | null
  model_fit: ModelFitResult | null
  mlflow_run_id: string | null
  started_at: string | null
  completed_at: string | null
  error_message: string | null
  created_at: string
}

export interface AnalysisConfig {
  estimation_method: string
  max_iterations: number
  convergence_threshold: number
  ability_estimation_method: string
}

export interface ItemParameter {
  name: string
  difficulty: number
  discrimination: number
  guessing: number
  se_difficulty: number | null
  se_discrimination: number | null
  se_guessing: number | null
}

export interface ItemParametersResult {
  items: ItemParameter[]
}

export interface AbilityEstimate {
  id: string
  theta: number
  se: number | null
}

export interface AbilityEstimatesResult {
  persons: AbilityEstimate[]
}

export interface ModelFitResult {
  log_likelihood: number
  aic: number
  bic: number
  n_parameters: number
  n_items: number
  n_persons: number
}

export interface ICCDataPoint {
  theta: number
  probability: number
}

export interface ICCCurve {
  item_name: string
  data: ICCDataPoint[]
}

export interface InformationDataPoint {
  theta: number
  information: number
}

export interface ItemInformationFunction {
  item_name: string
  data: InformationDataPoint[]
}

export interface InformationFunctions {
  item_information: ItemInformationFunction[]
  test_information: {
    data: InformationDataPoint[]
  }
}

export interface UserSettings {
  default_competency_level: CompetencyLevel
  default_model_type: ModelType
  theme: string
  show_advanced_stats: boolean
  settings: Record<string, unknown> | null
}
