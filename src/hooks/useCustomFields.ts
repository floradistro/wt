/**
 * TEMPORARY STUB - To be refactored into Zustand store
 */

export type FieldType = 'text' | 'textarea' | 'number' | 'select' | 'checkbox' | 'date' | 'url' | 'email'

export interface CustomField {
  id: string
  label: string
  field_id: string
  type: FieldType
  required: boolean
  placeholder?: string
  description?: string
  options?: string[]
  default_value?: string
  sort_order?: number
}

export function generateFieldId(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function useCustomFields(_options?: any) {
  return {
    fields: [],
    isLoading: false,
    reload: () => Promise.resolve(),
  }
}
