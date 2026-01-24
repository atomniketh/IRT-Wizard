import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMachine } from '@xstate/react'
import { wizardMachine, STEP_ORDER, STEP_LABELS } from './WizardMachine'
import { StepIndicator } from './StepIndicator'
import { CompetencySelection } from './steps/CompetencySelection'
import { DataUpload } from './steps/DataUpload'
import { DataPreview } from './steps/DataPreview'
import { ModelSelection } from './steps/ModelSelection'
import { AnalysisRunning } from './steps/AnalysisRunning'
import { Results } from './steps/Results'
import { Card, CardBody } from '../common/Card'
import { projectsApi } from '@/api/projects'
import { useSettingsStore } from '@/store'

export function WizardContainer() {
  const { projectId } = useParams<{ projectId: string }>()
  const [state, send] = useMachine(wizardMachine)
  const [isLoadingProject, setIsLoadingProject] = useState(false)
  const setCompetencyLevel = useSettingsStore((s) => s.setCompetencyLevel)

  useEffect(() => {
    if (projectId && !state.context.project) {
      setIsLoadingProject(true)
      projectsApi.get(projectId)
        .then((project) => {
          setCompetencyLevel(project.competency_level)
          send({ type: 'SELECT_COMPETENCY', level: project.competency_level })
          send({ type: 'CREATE_PROJECT', project })
        })
        .catch((err) => {
          console.error('Failed to load project:', err)
        })
        .finally(() => {
          setIsLoadingProject(false)
        })
    }
  }, [projectId, state.context.project, send, setCompetencyLevel])
  const currentStep = state.value as string

  const currentStepIndex = STEP_ORDER.indexOf(currentStep as typeof STEP_ORDER[number])

  const renderStep = () => {
    switch (currentStep) {
      case 'competencySelection':
        return <CompetencySelection send={send} />
      case 'dataUpload':
        return <DataUpload send={send} context={state.context} />
      case 'dataPreview':
        return <DataPreview send={send} context={state.context} />
      case 'modelSelection':
        return <ModelSelection send={send} context={state.context} />
      case 'analysisRunning':
        return <AnalysisRunning send={send} context={state.context} />
      case 'results':
        return <Results send={send} context={state.context} />
      default:
        return null
    }
  }

  if (isLoadingProject) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <StepIndicator
        steps={STEP_ORDER.map((step) => ({
          key: step,
          label: STEP_LABELS[step],
        }))}
        currentStep={currentStepIndex}
      />

      <Card>
        <CardBody>{renderStep()}</CardBody>
      </Card>
    </div>
  )
}
