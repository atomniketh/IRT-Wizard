import { FileText, Table, FileSpreadsheet } from 'lucide-react'
import { Card, CardHeader, CardBody } from '../common/Card'
import { exportsApi } from '@/api/analysis'

interface ExportPanelProps {
  analysisId: string
}

export function ExportPanel({ analysisId }: ExportPanelProps) {
  const handleExport = (format: 'csv' | 'excel' | 'pdf-summary' | 'pdf-detailed') => {
    let url: string

    switch (format) {
      case 'csv':
        url = exportsApi.downloadCsv(analysisId)
        break
      case 'excel':
        url = exportsApi.downloadExcel(analysisId)
        break
      case 'pdf-summary':
        url = exportsApi.downloadPdf(analysisId, 'summary')
        break
      case 'pdf-detailed':
        url = exportsApi.downloadPdf(analysisId, 'detailed')
        break
    }

    window.open(url, '_blank')
  }

  const exportOptions = [
    {
      id: 'csv',
      label: 'CSV',
      description: 'Raw data for spreadsheet software',
      icon: Table,
    },
    {
      id: 'excel',
      label: 'Excel',
      description: 'Formatted spreadsheet with multiple sheets',
      icon: FileSpreadsheet,
    },
    {
      id: 'pdf-summary',
      label: 'PDF Summary',
      description: 'Brief 2-3 page report with key findings',
      icon: FileText,
    },
    {
      id: 'pdf-detailed',
      label: 'PDF Detailed',
      description: 'Comprehensive report with all visualizations',
      icon: FileText,
    },
  ]

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold text-gray-900 dark:text-white">Export Results</h3>
      </CardHeader>
      <CardBody>
        <div className="grid gap-4 md:grid-cols-2">
          {exportOptions.map((option) => {
            const Icon = option.icon

            return (
              <button
                key={option.id}
                onClick={() => handleExport(option.id as any)}
                className="flex items-start space-x-3 p-4 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors text-left"
              >
                <div className="p-2 rounded-lg bg-gray-100">
                  <Icon className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{option.label}</p>
                  <p className="text-sm text-gray-500">{option.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      </CardBody>
    </Card>
  )
}
