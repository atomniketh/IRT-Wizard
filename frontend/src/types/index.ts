export type CompetencyLevel = 'researcher' | 'educator' | 'student'

export type ModelType = '1PL' | '2PL' | '3PL' | 'RSM' | 'PCM'

// Helper function to check if a model type is polytomous
export function isPolytomousModel(modelType: ModelType): boolean {
  return modelType === 'RSM' || modelType === 'PCM'
}

export type AnalysisStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface Project {
  id: string
  name: string
  description: string | null
  competency_level: CompetencyLevel
  created_at: string
  updated_at: string
}

export type ResponseScale = 'binary' | 'ordinal' | 'mixed' | 'unknown'

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
  // Response scale detection fields
  response_scale: ResponseScale | null
  min_response: number | null
  max_response: number | null
  n_categories: number | null
  created_at: string
}

// Helper function to check if a dataset has polytomous data
export function isPolytomousData(dataset: Dataset | null): boolean {
  if (!dataset) return false
  return dataset.response_scale === 'ordinal' && (dataset.n_categories ?? 0) > 2
}

// Helper function to get recommended model types based on response scale
export function getRecommendedModels(responseScale: ResponseScale | null): ModelType[] {
  switch (responseScale) {
    case 'binary':
      return ['1PL', '2PL', '3PL']
    case 'ordinal':
      return ['RSM', 'PCM']
    case 'mixed':
      return ['1PL', '2PL', '3PL', 'RSM', 'PCM']
    default:
      return ['1PL', '2PL', '3PL', 'RSM', 'PCM']
  }
}

export interface ValidationError {
  type: string
  message: string
  column?: string
  columns?: string[]
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

// Polytomous model types
export interface PolytomousItemParameter {
  name: string
  difficulty: number
  thresholds: number[]
  se_difficulty: number | null
  se_thresholds: number[] | null
  infit_mnsq: number | null
  outfit_mnsq: number | null
  infit_zstd: number | null
  outfit_zstd: number | null
}

export interface PolytomousItemParametersResult {
  items: PolytomousItemParameter[]
  n_categories: number
  category_counts: number[]
}

export interface CategoryProbabilityDataPoint {
  theta: number
  probability: number
}

export interface CategoryProbabilityCurve {
  item_name: string
  category: number
  data: CategoryProbabilityDataPoint[]
}

export interface WrightMapPerson {
  theta: number
  count: number
}

export interface WrightMapItem {
  name: string
  difficulty: number
  thresholds: number[]
}

export interface WrightMapData {
  persons: WrightMapPerson[]
  items: WrightMapItem[]
  min_logit: number
  max_logit: number
}

export interface FitStatisticsItem {
  name: string
  count: number
  measure: number
  se: number | null
  infit_mnsq: number
  infit_zstd: number | null
  outfit_mnsq: number
  outfit_zstd: number | null
}

// Phase 2: Additional Rasch Analyses types

export interface ReliabilityStatistics {
  person_reliability: number
  item_reliability: number
  person_separation: number
  item_separation: number
  person_strata: number
  item_strata: number
}

export interface PCARResult {
  eigenvalues: number[]
  variance_explained: number[]
  cumulative_variance: number[]
  first_contrast_eigenvalue: number
  is_unidimensional: boolean
  loadings: { item_index: number; loading: number }[] | null
  note?: string
}

export interface DIFResult {
  item_name: string
  focal_difficulty: number
  reference_difficulty: number
  dif_contrast: number
  dif_se: number | null
  dif_t: number | null
  dif_p: number | null
  dif_classification: 'A' | 'B' | 'C'
}

export interface GroupingColumnInfo {
  column: string
  values: (string | number)[]
  n_groups: number
}

export interface DIFAnalysisResult {
  results: DIFResult[]
  group_column: string | null
  focal_group: string | null
  reference_group: string | null
  available_grouping_columns?: GroupingColumnInfo[]
  note?: string
}

export interface CategoryStructureItem {
  category: number
  label: string
  count: number
  percent: number
  observed_average: number | null
  observed_sd: number | null
  andrich_threshold: number | null
  se_threshold: number | null
  is_disordered: boolean
}

export interface CategoryStructureRecommendation {
  type: 'underutilized' | 'disordered' | 'non_monotonic'
  severity: 'warning' | 'error'
  message: string
}

export interface CategoryStructureSummary {
  total_responses: number
  has_disordered_thresholds: boolean
  has_underutilized_categories: boolean
}

export interface CategoryStructureTable {
  categories: CategoryStructureItem[]
  n_categories: number
  recommendations: CategoryStructureRecommendation[]
  summary: CategoryStructureSummary
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
