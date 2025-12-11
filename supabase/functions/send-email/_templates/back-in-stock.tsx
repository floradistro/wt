import React from 'npm:react@18.3.1'
import { Section, Text, Img } from 'npm:@react-email/components@0.0.22'
import { Layout, Title, Paragraph, Button, Card } from './layout.tsx'

interface BackInStockProps {
  vendorName: string
  logoUrl?: string
  supportEmail?: string
  customerName: string
  productName: string
  productUrl: string
  productImage?: string
}

export function BackInStock({
  vendorName,
  logoUrl,
  supportEmail,
  customerName,
  productName,
  productUrl,
  productImage,
}: BackInStockProps) {
  return (
    <Layout vendorName={vendorName} logoUrl={logoUrl} supportEmail={supportEmail}>
      <Section style={{ textAlign: 'center' as const, marginBottom: '32px' }}>
        <Title>Back in Stock</Title>
      </Section>

      <Section style={{ textAlign: 'center' as const, marginBottom: '32px' }}>
        <Paragraph center>
          Hi {customerName}, the product you wanted is available again.
        </Paragraph>
      </Section>

      <Card>
        {productImage && (
          <Section style={{ textAlign: 'center' as const, marginBottom: '16px' }}>
            <Img
              src={productImage}
              alt={productName}
              style={styles.productImage}
            />
          </Section>
        )}
        <Text style={styles.productName}>{productName}</Text>
      </Card>

      <Button href={productUrl}>Shop Now</Button>
    </Layout>
  )
}

const styles = {
  productImage: {
    maxWidth: '200px',
    height: 'auto',
    borderRadius: '8px',
    margin: '0 auto',
  },
  productName: {
    margin: 0,
    fontSize: '18px',
    color: '#ffffff',
    fontWeight: 500,
    textAlign: 'center' as const,
  },
}

export default BackInStock
