import React from 'npm:react@18.3.1'
import { Section, Text } from 'npm:@react-email/components@0.0.22'
import { Layout, Title, Subtitle, Paragraph, Card, CardLabel, CardValue } from './layout.tsx'

interface OrderReadyProps {
  vendorName: string
  logoUrl?: string
  orderNumber: string
  pickupLocation: string
  pickupAddress?: string
}

export function OrderReady({
  vendorName,
  logoUrl,
  orderNumber,
  pickupLocation,
  pickupAddress,
}: OrderReadyProps) {
  return (
    <Layout vendorName={vendorName} logoUrl={logoUrl}>
      <Section style={{ textAlign: 'center' as const, marginBottom: '40px' }}>
        <Title>Your Order is Ready</Title>
        <Subtitle>Order #{orderNumber}</Subtitle>
      </Section>

      <Card>
        <CardLabel>Pickup Location</CardLabel>
        <CardValue>{pickupLocation}</CardValue>
        {pickupAddress && (
          <Text style={styles.address}>{pickupAddress}</Text>
        )}
      </Card>

      <Section style={{ textAlign: 'center' as const }}>
        <Paragraph center>We look forward to seeing you.</Paragraph>
      </Section>
    </Layout>
  )
}

const styles = {
  address: {
    margin: '8px 0 0 0',
    fontSize: '15px',
    color: '#a1a1aa',
    textAlign: 'center' as const,
  },
}

export default OrderReady
