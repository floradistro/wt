import React from 'npm:react@18.3.1'
import { Section, Text } from 'npm:@react-email/components@0.0.22'
import { Layout, Title, Paragraph, Button } from './layout.tsx'

interface PasswordResetProps {
  vendorName: string
  logoUrl?: string
  customerName: string
  resetUrl: string
}

export function PasswordReset({
  vendorName,
  logoUrl,
  customerName,
  resetUrl,
}: PasswordResetProps) {
  return (
    <Layout vendorName={vendorName} logoUrl={logoUrl}>
      <Section style={{ textAlign: 'center' as const, marginBottom: '32px' }}>
        <Title>Reset Your Password</Title>
      </Section>

      <Section style={{ textAlign: 'center' as const, marginBottom: '32px' }}>
        <Paragraph center>
          Hi {customerName},
          <br /><br />
          Click below to reset your password.
        </Paragraph>
      </Section>

      <Button href={resetUrl}>Reset Password</Button>

      <Section style={{ textAlign: 'center' as const, marginTop: '32px' }}>
        <Text style={styles.expiry}>Link expires in 24 hours.</Text>
      </Section>
    </Layout>
  )
}

const styles = {
  expiry: {
    margin: 0,
    fontSize: '13px',
    color: '#52525b',
  },
}

export default PasswordReset
