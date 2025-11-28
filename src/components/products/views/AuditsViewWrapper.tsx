/**
 * AuditsViewWrapper Component - Simplified
 * Clean wrapper for audits functionality
 *
 * ZERO PROP DRILLING:
 * - AuditsView reads all state from stores/contexts
 */

import React from 'react'
import { AuditsView } from '@/components/products/AuditsView'

/**
 * AuditsViewWrapper - ZERO PROPS ✅
 */
export function AuditsViewWrapper() {
  return <AuditsView />
}
