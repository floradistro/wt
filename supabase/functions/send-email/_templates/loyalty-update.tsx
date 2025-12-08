import React from 'npm:react@18.3.1'
import { Section, Text } from 'npm:@react-email/components@0.0.22'
import { Layout, Title, Paragraph, Button, Card, CardLabel } from './layout.tsx'

interface LoyaltyUpdateProps {
  vendorName: string
  logoUrl?: string
  customerName: string
  action: 'earned' | 'redeemed'
  points: number
  totalPoints: number
  orderNumber?: string
  rewardsUrl: string
}

export function LoyaltyUpdate({
  vendorName,
  logoUrl,
  customerName,
  action,
  points,
  totalPoints,
  orderNumber,
  rewardsUrl,
}: LoyaltyUpdateProps) {
  const actionText = action === 'earned' ? 'earned' : 'redeemed'
  const orderContext = orderNumber ? ` on order #${orderNumber}` : ''

  return (
    <Layout vendorName={vendorName} logoUrl={logoUrl}>
      <Section style={{ textAlign: 'center' as const, marginBottom: '32px' }}>
        <Title>Points {action === 'earned' ? 'Earned' : 'Redeemed'}</Title>
      </Section>

      <Section style={{ textAlign: 'center' as const, marginBottom: '32px' }}>
        <Paragraph center>
          Hi {customerName}, you {actionText} {points} points{orderContext}.
        </Paragraph>
      </Section>

      <Card>
        <CardLabel>Your Balance</CardLabel>
        <Text style={styles.balance}>{totalPoints}</Text>
        <Text style={styles.pointsLabel}>points</Text>
      </Card>

      <Button href={rewardsUrl}>View Rewards</Button>
    </Layout>
  )
}

const styles = {
  balance: {
    margin: 0,
    fontSize: '42px',
    fontWeight: 300,
    color: '#ffffff',
    textAlign: 'center' as const,
  },
  pointsLabel: {
    margin: '8px 0 0 0',
    fontSize: '13px',
    color: '#71717a',
    textAlign: 'center' as const,
  },
}

export default LoyaltyUpdate
