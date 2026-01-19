import { useSettingsStore } from '@/store'
import { tooltips, modelDescriptions } from '@/types/irt'

export function useCompetencyLevel() {
  const competencyLevel = useSettingsStore((s) => s.competencyLevel)
  const setCompetencyLevel = useSettingsStore((s) => s.setCompetencyLevel)

  const getTooltip = (key: string): string => {
    const content = tooltips[key]
    if (!content) return ''
    return content[competencyLevel]
  }

  const getModelDescription = (modelType: string): string => {
    const content = modelDescriptions[modelType]
    if (!content) return ''
    return content[competencyLevel]
  }

  const isResearcher = competencyLevel === 'researcher'
  const isEducator = competencyLevel === 'educator'
  const isStudent = competencyLevel === 'student'

  const showAdvancedOptions = isResearcher
  const showDetailedStatistics = isResearcher || isEducator

  return {
    competencyLevel,
    setCompetencyLevel,
    getTooltip,
    getModelDescription,
    isResearcher,
    isEducator,
    isStudent,
    showAdvancedOptions,
    showDetailedStatistics,
  }
}
