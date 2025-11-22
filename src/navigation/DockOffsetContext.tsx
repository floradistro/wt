/**
 * Dock Offset Context
 *
 * Minimal context for POS setup override to control dock centering.
 * Extracted to separate file to prevent circular dependencies.
 */

import { createContext, useContext } from 'react'

interface DockOffsetContextType {
  setFullWidth: (isFullWidth: boolean) => void
}

export const DockOffsetContext = createContext<DockOffsetContextType>({
  setFullWidth: () => {}
})

export const useDockOffset = () => useContext(DockOffsetContext)
