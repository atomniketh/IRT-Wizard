import { create } from 'zustand'
import type { Project, Dataset, Analysis } from '@/types'

interface ProjectState {
  currentProject: Project | null
  currentDataset: Dataset | null
  currentAnalysis: Analysis | null
  setCurrentProject: (project: Project | null) => void
  setCurrentDataset: (dataset: Dataset | null) => void
  setCurrentAnalysis: (analysis: Analysis | null) => void
  reset: () => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  currentProject: null,
  currentDataset: null,
  currentAnalysis: null,
  setCurrentProject: (project) => set({ currentProject: project }),
  setCurrentDataset: (dataset) => set({ currentDataset: dataset }),
  setCurrentAnalysis: (analysis) => set({ currentAnalysis: analysis }),
  reset: () => set({
    currentProject: null,
    currentDataset: null,
    currentAnalysis: null,
  }),
}))
