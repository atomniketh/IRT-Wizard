import Papa from 'papaparse'

export interface ParseResult {
  data: Record<string, unknown>[]
  headers: string[]
  rowCount: number
  columnCount: number
  errors: Papa.ParseError[]
}

export function parseCSV(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        const headers = results.meta.fields || []
        const data = results.data as Record<string, unknown>[]

        resolve({
          data,
          headers,
          rowCount: data.length,
          columnCount: headers.length,
          errors: results.errors,
        })
      },
      error: (error) => {
        reject(error)
      },
    })
  })
}

export function parseCSVString(content: string): ParseResult {
  const results = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  })

  const headers = results.meta.fields || []
  const data = results.data as Record<string, unknown>[]

  return {
    data,
    headers,
    rowCount: data.length,
    columnCount: headers.length,
    errors: results.errors,
  }
}

export function validateResponseData(
  data: Record<string, unknown>[],
  headers: string[]
): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  if (data.length === 0) {
    errors.push('Dataset is empty')
    return { isValid: false, errors }
  }

  if (headers.length < 2) {
    errors.push('Dataset must have at least 2 columns (items)')
  }

  if (data.length < 10) {
    errors.push('Dataset should have at least 10 rows (respondents)')
  }

  for (const header of headers) {
    const values = data.map((row) => row[header]).filter((v) => v !== null && v !== undefined)

    const nonBinary = values.filter((v) => v !== 0 && v !== 1)
    if (nonBinary.length > 0) {
      errors.push(`Column "${header}" contains non-binary values`)
    }

    if (values.length === 0) {
      errors.push(`Column "${header}" has all missing values`)
    }

    const uniqueValues = [...new Set(values)]
    if (uniqueValues.length === 1) {
      errors.push(`Column "${header}" has no variance (all values are ${uniqueValues[0]})`)
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

export function convertToMatrix(
  data: Record<string, unknown>[],
  headers: string[]
): number[][] {
  return data.map((row) =>
    headers.map((header) => {
      const value = row[header]
      if (value === null || value === undefined || value === '') {
        return NaN
      }
      return Number(value)
    })
  )
}
