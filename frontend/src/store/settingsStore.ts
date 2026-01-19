import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CompetencyLevel, ModelType } from '@/types'

interface SettingsState {
  competencyLevel: CompetencyLevel
  defaultModelType: ModelType
  theme: 'light' | 'dark'
  showAdvancedStats: boolean
  setCompetencyLevel: (level: CompetencyLevel) => void
  setDefaultModelType: (type: ModelType) => void
  setTheme: (theme: 'light' | 'dark') => void
  setShowAdvancedStats: (show: boolean) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      competencyLevel: 'educator',
      defaultModelType: '2PL',
      theme: 'light',
      showAdvancedStats: false,
      setCompetencyLevel: (level) => set({ competencyLevel: level }),
      setDefaultModelType: (type) => set({ defaultModelType: type }),
      setTheme: (theme) => set({ theme }),
      setShowAdvancedStats: (show) => set({ showAdvancedStats: show }),
    }),
    {
      name: 'irt-wizard-settings',
    }
  )
)
