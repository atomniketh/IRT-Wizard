import { createMachine, assign } from 'xstate'
import type { CompetencyLevel, ModelType, Project, Dataset, Analysis } from '@/types'

export interface WizardContext {
  competencyLevel: CompetencyLevel | null
  project: Project | null
  dataset: Dataset | null
  modelType: ModelType | null
  analysisConfig: Record<string, unknown> | null
  analysis: Analysis | null
  error: string | null
}

export type WizardEvent =
  | { type: 'SELECT_COMPETENCY'; level: CompetencyLevel }
  | { type: 'CREATE_PROJECT'; project: Project }
  | { type: 'UPLOAD_DATA'; dataset: Dataset }
  | { type: 'VALIDATE_DATA' }
  | { type: 'SELECT_MODEL'; modelType: ModelType; config?: Record<string, unknown> }
  | { type: 'START_ANALYSIS' }
  | { type: 'ANALYSIS_COMPLETE'; analysis: Analysis }
  | { type: 'ANALYSIS_FAILED'; error: string }
  | { type: 'BACK' }
  | { type: 'RESET' }
  | { type: 'GO_TO_STEP'; step: string }

export const wizardMachine = createMachine({
  id: 'wizard',
  initial: 'competencySelection',
  context: {
    competencyLevel: null,
    project: null,
    dataset: null,
    modelType: null,
    analysisConfig: null,
    analysis: null,
    error: null,
  } as WizardContext,
  states: {
    competencySelection: {
      on: {
        SELECT_COMPETENCY: {
          target: 'dataUpload',
          actions: assign({
            competencyLevel: ({ event }) => event.level,
          }),
        },
      },
    },
    dataUpload: {
      on: {
        UPLOAD_DATA: {
          target: 'dataPreview',
          actions: assign({
            dataset: ({ event }) => event.dataset,
          }),
        },
        CREATE_PROJECT: {
          actions: assign({
            project: ({ event }) => event.project,
          }),
        },
        BACK: 'competencySelection',
      },
    },
    dataPreview: {
      on: {
        VALIDATE_DATA: 'modelSelection',
        UPLOAD_DATA: {
          actions: assign({
            dataset: ({ event }) => event.dataset,
          }),
        },
        BACK: 'dataUpload',
      },
    },
    modelSelection: {
      on: {
        SELECT_MODEL: {
          target: 'analysisRunning',
          actions: assign({
            modelType: ({ event }) => event.modelType,
            analysisConfig: ({ event }) => event.config ?? null,
          }),
        },
        BACK: 'dataPreview',
      },
    },
    analysisRunning: {
      on: {
        ANALYSIS_COMPLETE: {
          target: 'results',
          actions: assign({
            analysis: ({ event }) => event.analysis,
            error: null,
          }),
        },
        ANALYSIS_FAILED: {
          target: 'modelSelection',
          actions: assign({
            error: ({ event }) => event.error,
          }),
        },
        BACK: 'modelSelection',
      },
    },
    results: {
      on: {
        GO_TO_STEP: [
          { guard: ({ event }) => event.step === 'competencySelection', target: 'competencySelection' },
          { guard: ({ event }) => event.step === 'dataUpload', target: 'dataUpload' },
          { guard: ({ event }) => event.step === 'modelSelection', target: 'modelSelection' },
        ],
        RESET: {
          target: 'competencySelection',
          actions: assign({
            competencyLevel: null,
            project: null,
            dataset: null,
            modelType: null,
            analysisConfig: null,
            analysis: null,
            error: null,
          }),
        },
      },
    },
  },
})

export const STEP_ORDER = [
  'competencySelection',
  'dataUpload',
  'dataPreview',
  'modelSelection',
  'analysisRunning',
  'results',
] as const

export const STEP_LABELS: Record<string, string> = {
  competencySelection: 'Mode',
  dataUpload: 'Upload',
  dataPreview: 'Preview',
  modelSelection: 'Model',
  analysisRunning: 'Analysis',
  results: 'Results',
}
