import React from 'npm:react@18.3.1'
import { Section, Text, Row, Column } from 'npm:@react-email/components@0.0.22'
import { Layout, Title, Subtitle, Paragraph, Button, Card, CardLabel, CardValue } from './layout.tsx'

interface Item {
  name: string
  quantity: number
  price: string
}

interface OrderConfirmationProps {
  vendorName: string
  logoUrl?: string
  customerName: string
  orderNumber: string
  items: Item[]
  subtotal?: string
  tax?: string
  shipping?: string
  discount?: string
  total: string
  isPickup: boolean
  pickupLocation?: string
  estimatedTime?: string
  shippingName?: string
  shippingAddress?: string
  shopUrl: string
}

export function OrderConfirmation({
  vendorName,
  logoUrl,
  customerName,
  orderNumber,
  items,
  subtotal,
  tax,
  shipping,
  discount,
  total,
  isPickup,
  pickupLocation,
  estimatedTime,
  shippingName,
  shippingAddress,
  shopUrl,
}: OrderConfirmationProps) {
  return (
    <Layout vendorName={vendorName} logoUrl={logoUrl}>
      <Section style={{ textAlign: 'center' as const, marginBottom: '40px' }}>
        <Title>Order Confirmed</Title>
        <Subtitle>Order #{orderNumber}</Subtitle>
      </Section>

      <Section style={{ textAlign: 'center' as const, marginBottom: '40px' }}>
        <Paragraph center>
          Thank you for your order, {customerName}.
          <br />
          {isPickup
            ? "We'll notify you when it's ready for pickup."
            : "We'll notify you when it ships."}
        </Paragraph>
      </Section>

      {/* Delivery Info */}
      <Card>
        <CardLabel>{isPickup ? 'Pickup Location' : 'Shipping To'}</CardLabel>
        {isPickup ? (
          <>
            <CardValue>{pickupLocation}</CardValue>
            {estimatedTime && (
              <Text style={styles.subtext}>Ready in {estimatedTime}</Text>
            )}
          </>
        ) : (
          <Text style={styles.address}>
            {shippingName}<br />{shippingAddress}
          </Text>
        )}
      </Card>

      {/* Items */}
      <Section style={{ marginBottom: '32px' }}>
        {items.map((item, index) => (
          <Row key={index} style={styles.itemRow}>
            <Column>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemQty}>Qty: {item.quantity}</Text>
            </Column>
            <Column style={{ textAlign: 'right' as const }}>
              <Text style={styles.itemPrice}>{item.price}</Text>
            </Column>
          </Row>
        ))}
      </Section>

      {/* Totals */}
      <Card>
        {subtotal && (
          <Row style={styles.totalRow}>
            <Column><Text style={styles.totalLabel}>Subtotal</Text></Column>
            <Column style={{ textAlign: 'right' as const }}><Text style={styles.totalValue}>{subtotal}</Text></Column>
          </Row>
        )}
        {shipping && (
          <Row style={styles.totalRow}>
            <Column><Text style={styles.totalLabel}>Shipping</Text></Column>
            <Column style={{ textAlign: 'right' as const }}><Text style={styles.totalValue}>{shipping}</Text></Column>
          </Row>
        )}
        {tax && (
          <Row style={styles.totalRow}>
            <Column><Text style={styles.totalLabel}>Tax</Text></Column>
            <Column style={{ textAlign: 'right' as const }}><Text style={styles.totalValue}>{tax}</Text></Column>
          </Row>
        )}
        {discount && (
          <Row style={styles.totalRow}>
            <Column><Text style={styles.totalLabel}>Discount</Text></Column>
            <Column style={{ textAlign: 'right' as const }}><Text style={styles.discountValue}>-{discount}</Text></Column>
          </Row>
        )}
        <Section style={{ borderTop: '1px solid #27272a', marginTop: '12px', paddingTop: '12px' }}>
          <Row>
            <Column><Text style={styles.grandTotalLabel}>Total</Text></Column>
            <Column style={{ textAlign: 'right' as const }}><Text style={styles.grandTotalValue}>{total}</Text></Column>
          </Row>
        </Section>
      </Card>

      <Button href={shopUrl}>Continue Shopping</Button>
    </Layout>
  )
}

const styles = {
  subtext: {
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
  itemRow: {
    padding: '16px 0',
    borderBottom: '1px solid #27272a',
  },
  itemName: {
    margin: 0,
    fontSize: '15px',
    color: '#ffffff',
    fontWeight: 500,
  },
  itemQty: {
    margin: '4px 0 0 0',
    fontSize: '13px',
    color: '#71717a',
  },
  itemPrice: {
    margin: 0,
    fontSize: '15px',
    color: '#ffffff',
  },
  totalRow: {
    padding: '4px 0',
  },
  totalLabel: {
    margin: 0,
    fontSize: '14px',
    color: '#71717a',
  },
  totalValue: {
    margin: 0,
    fontSize: '14px',
    color: '#a1a1aa',
  },
  discountValue: {
    margin: 0,
    fontSize: '14px',
    color: '#10b981',
  },
  grandTotalLabel: {
    margin: 0,
    fontSize: '17px',
    fontWeight: 500,
    color: '#ffffff',
  },
  grandTotalValue: {
    margin: 0,
    fontSize: '21px',
    fontWeight: 500,
    color: '#ffffff',
  },
}

export default OrderConfirmation
