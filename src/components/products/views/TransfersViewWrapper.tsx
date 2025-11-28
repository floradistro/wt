/**
 * TransfersViewWrapper - Simplified
 * Clean wrapper for transfers functionality
 *
 * ZERO PROP DRILLING ✅
 * - TransfersList fetches its own data using useTransfersStore hook
 */

import React from 'react'
import { TransfersList } from '../TransfersList'

/**
 * TransfersViewWrapper - ZERO PROPS ✅
 */
export function TransfersViewWrapper() {
  return <TransfersList />
}
