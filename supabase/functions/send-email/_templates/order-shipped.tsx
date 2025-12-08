import React from 'npm:react@18.3.1'
import { Section, Text } from 'npm:@react-email/components@0.0.22'
import { Layout, Title, Subtitle, Button, Card, CardLabel, CardValue } from './layout.tsx'

interface OrderShippedProps {
  vendorName: string
  logoUrl?: string
  orderNumber: string
  customerName: string
  shippingAddress: string
  trackingNumber?: string
  trackingUrl?: string
  carrier?: string
}

export function OrderShipped({
  vendorName,
  logoUrl,
  orderNumber,
  customerName,
  shippingAddress,
  trackingNumber,
  trackingUrl,
  carrier,
}: OrderShippedProps) {
  return (
    <Layout vendorName={vendorName} logoUrl={logoUrl}>
      <Section style={{ textAlign: 'center' as const, marginBottom: '40px' }}>
        <Title>Your Order Has Shipped</Title>
        <Subtitle>Order #{orderNumber}</Subtitle>
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

      <Card>
        <CardLabel>Shipping To</CardLabel>
        <Text style={styles.address}>
          {customerName}<br />{shippingAddress}
        </Text>
      </Card>
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
  address: {
    margin: 0,
    fontSize: '15px',
    color: '#a1a1aa',
    lineHeight: 1.8,
    textAlign: 'center' as const,
  },
}

export default OrderShipped
