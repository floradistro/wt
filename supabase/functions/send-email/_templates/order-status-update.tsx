import React from 'npm:react@18.3.1'
import { Section, Text } from 'npm:@react-email/components@0.0.22'
import { Layout, Title, Subtitle, Paragraph, Button, Card, CardLabel, CardValue } from './layout.tsx'

interface OrderStatusUpdateProps {
  vendorName: string
  logoUrl?: string
  orderNumber: string
  statusTitle: string
  statusMessage: string
  supportEmail: string
  trackingNumber?: string
  trackingUrl?: string
  carrier?: string
  pickupLocation?: string
}

export function OrderStatusUpdate({
  vendorName,
  logoUrl,
  orderNumber,
  statusTitle,
  statusMessage,
  supportEmail,
  trackingNumber,
  trackingUrl,
  carrier,
  pickupLocation,
}: OrderStatusUpdateProps) {
  return (
    <Layout vendorName={vendorName} logoUrl={logoUrl}>
      <Section style={{ textAlign: 'center' as const, marginBottom: '40px' }}>
        <Title>{statusTitle}</Title>
        <Subtitle>Order #{orderNumber}</Subtitle>
      </Section>

      <Section style={{ textAlign: 'center' as const, marginBottom: '32px' }}>
        <Paragraph center>{statusMessage}</Paragraph>
      </Section>

      {trackingNumber && (
        <>
          <Card>
            <CardLabel>Tracking Number</CardLabel>
            <Text style={styles.tracking}>{trackingNumber}</Text>
            {carrier && (
              <Text style={styles.carrier}>via {carrier}</Text>
            )}
          </Card>
          {trackingUrl && (
            <Button href={trackingUrl}>Track Package</Button>
          )}
        </>
      )}

      {pickupLocation && !trackingNumber && (
        <Card>
          <CardLabel>Pickup Location</CardLabel>
          <CardValue>{pickupLocation}</CardValue>
        </Card>
      )}

      <Section style={{ textAlign: 'center' as const, marginTop: '32px' }}>
        <Text style={styles.support}>
          Questions? Contact us at {supportEmail}
        </Text>
      </Section>
    </Layout>
  )
}

const styles = {
  tracking: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 500,
    color: '#ffffff',
    textAlign: 'center' as const,
  },
  carrier: {
    margin: '8px 0 0 0',
    fontSize: '15px',
    color: '#71717a',
    textAlign: 'center' as const,
  },
  support: {
    margin: 0,
    fontSize: '13px',
    color: '#52525b',
  },
}

export default OrderStatusUpdate
