import React from 'npm:react@18.3.1'
import { Section } from 'npm:@react-email/components@0.0.22'
import { Layout, Title, Paragraph, Button } from './layout.tsx'

interface WelcomeProps {
  vendorName: string
  logoUrl?: string
  customerName: string
  shopUrl: string
}

export function Welcome({
  vendorName,
  logoUrl,
  customerName,
  shopUrl,
}: WelcomeProps) {
  return (
    <Layout vendorName={vendorName} logoUrl={logoUrl}>
      <Section style={{ textAlign: 'center' as const, marginBottom: '32px' }}>
        <Title>Welcome</Title>
      </Section>

      <Section style={{ textAlign: 'center' as const, marginBottom: '32px' }}>
        <Paragraph center>
          Hi {customerName},
          <br /><br />
          Thanks for joining us.
        </Paragraph>
      </Section>

      <Button href={shopUrl}>Start Shopping</Button>
    </Layout>
  )
}

export default Welcome
