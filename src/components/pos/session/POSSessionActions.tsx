/**
 * POSSessionActions Component
 * Jobs Principle: Session-level actions (end session, close drawer)
 */

import { useState } from 'react'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase/client'
import { CloseCashDrawerModal } from '../CloseCashDrawerModal'
import { useModalState } from '@/hooks/pos'
import type { SessionInfo } from '@/types/pos'
import { logger } from '@/utils/logger'

interface SessionData {
  sessionNumber: string
  totalSales: number
  totalCash: number
  openingCash: number
}

interface POSSessionActionsProps {
  sessionInfo: SessionInfo
  onSessionEnd: () => void
}

export function POSSessionActions({ 
  sessionInfo, 
  onSessionEnd 
}: POSSessionActionsProps) {
  const [sessionData, setSessionData] = useState<SessionData | null>(null)
  const { openModal, closeModal, isModalOpen } = useModalState()

  const handleEndSession = async () => {
    if (!sessionInfo?.sessionId) return

    try {
      const { data: session, error } = await supabase
        .from('pos_sessions')
        .select('session_number, total_sales, total_cash, opening_cash')
        .eq('id', sessionInfo.sessionId)
        .single()

      if (error || !session) {
        logger.error('Error loading session data:', error)
        return
      }

      setSessionData({
        sessionNumber: session.session_number,
        totalSales: session.total_sales || 0,
        totalCash: session.total_cash || 0,
        openingCash: session.opening_cash || 0,
      })

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      openModal('cashDrawerClose')
    } catch (error) {
      logger.error('Error in handleEndSession:', error)
    }
  }

  const handleCloseDrawerSubmit = async (closingCash: number, notes: string) => {
    if (!sessionInfo?.sessionId) return

    try {
      const { data, error } = await supabase.rpc('close_pos_session', {
        p_session_id: sessionInfo.sessionId,
        p_closing_cash: closingCash,
        p_closing_notes: notes || null,
      })

      if (error) throw error
      if (!data.success) {
        throw new Error(data.error || 'Failed to close session')
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      closeModal()
      onSessionEnd()
    } catch (error) {
      logger.error('Error closing session:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }

  const handleCloseDrawerCancel = () => {
    closeModal()
  }

  return (
    <>
      {/* Close Cash Drawer Modal */}
      {sessionData && (
        <CloseCashDrawerModal
          visible={isModalOpen('cashDrawerClose')}
          sessionNumber={sessionData.sessionNumber}
          totalSales={sessionData.totalSales}
          totalCash={sessionData.totalCash}
          openingCash={sessionData.openingCash}
          onSubmit={handleCloseDrawerSubmit}
          onCancel={handleCloseDrawerCancel}
        />
      )}
    </>
  )
}
