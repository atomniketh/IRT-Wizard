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

export function WizardContainer() {
  const [state, send] = useMachine(wizardMachine)
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
