/**
 * DockOffsetContext - Legacy stub (Dock removed)
 * Kept for backwards compatibility with POSScreen
 */

import { createContext, useContext } from 'react'

interface DockOffsetContextType {
  setFullWidth: (fullWidth: boolean) => void
}

const DockOffsetContext = createContext<DockOffsetContextType>({
  setFullWidth: () => {}, // No-op since Dock is removed
})

export { DockOffsetContext }

export const useDockOffset = () => useContext(DockOffsetContext)
