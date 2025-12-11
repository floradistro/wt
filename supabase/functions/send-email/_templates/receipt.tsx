import React from 'npm:react@18.3.1'
import { Section, Text, Row, Column } from 'npm:@react-email/components@0.0.22'
import { Layout, Title, Subtitle, Card } from './layout.tsx'

interface Item {
  name: string
  quantity: number
  price: string
}

interface ReceiptProps {
  vendorName: string
  logoUrl?: string
  supportEmail?: string
  orderNumber: string
  items: Item[]
  subtotal?: string
  tax?: string
  shipping?: string
  discount?: string
  total: string
}

export function Receipt({
  vendorName,
  logoUrl,
  supportEmail,
  orderNumber,
  items,
  subtotal,
  tax,
  shipping,
  discount,
  total,
}: ReceiptProps) {
  return (
    <Layout vendorName={vendorName} logoUrl={logoUrl} supportEmail={supportEmail}>
      <Section style={{ textAlign: 'center' as const, marginBottom: '40px' }}>
        <Title>Receipt</Title>
        <Subtitle>Order #{orderNumber}</Subtitle>
      </Section>

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

      <Text style={styles.thanks}>Thank you for your purchase</Text>
    </Layout>
  )
}

const styles = {
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
  thanks: {
    margin: 0,
    fontSize: '15px',
    color: '#71717a',
    textAlign: 'center' as const,
  },
}

export default Receipt
