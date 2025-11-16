/**
 * useModalState Hook
 * Consolidated modal state management using state machine pattern
 * Jobs Principle: One state at a time, clear transitions
 */

import { useState, useCallback } from 'react'

export type ModalType =
  | 'none'
  | 'registerSelector'
  | 'cashDrawerOpen'
  | 'cashDrawerClose'
  | 'payment'
  | 'customerSelector'
  | 'categoryDropdown'
  | 'filtersDropdown'

export function useModalState(initialModal: ModalType = 'none') {
  const [activeModal, setActiveModal] = useState<ModalType>(initialModal)

  // Open a specific modal
  const openModal = useCallback((modal: ModalType) => {
    setActiveModal(modal)
  }, [])

  // Close the current modal
  const closeModal = useCallback(() => {
    setActiveModal('none')
  }, [])

  // Check if a specific modal is open
  const isModalOpen = useCallback(
    (modal: ModalType) => activeModal === modal,
    [activeModal]
  )

  // Check if any modal is open
  const hasOpenModal = activeModal !== 'none'

  return {
    activeModal,
    openModal,
    closeModal,
    isModalOpen,
    hasOpenModal,
  }
}
