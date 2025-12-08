import React from 'npm:react@18.3.1'
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Link,
  Img,
} from 'npm:@react-email/components@0.0.22'

interface LayoutProps {
  vendorName: string
  logoUrl?: string
  children: React.ReactNode
}

export function Layout({ vendorName, logoUrl, children }: LayoutProps) {
  const year = new Date().getFullYear()

  return (
    <Html lang="en">
      <Head />
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Header */}
          <Section style={styles.header}>
            {logoUrl && (
              <Img
                src={logoUrl}
                alt={vendorName}
                width={80}
                height={80}
                style={styles.logo}
              />
            )}
            <Text style={styles.vendorName}>{vendorName}</Text>
          </Section>

          {/* Content */}
          <Section style={styles.content}>
            {children}
          </Section>

          {/* Footer */}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              {vendorName} {year}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const styles = {
  body: {
    margin: 0,
    padding: 0,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
    backgroundColor: '#000000',
  },
  container: {
    maxWidth: '600px',
    margin: '0 auto',
    backgroundColor: '#000000',
  },
  header: {
    padding: '48px 40px',
    textAlign: 'center' as const,
    borderBottom: '1px solid #27272a',
  },
  logo: {
    display: 'block',
    margin: '0 auto 16px auto',
    borderRadius: '12px',
  },
  vendorName: {
    margin: 0,
    fontSize: '20px',
    color: '#ffffff',
    fontWeight: 500,
    letterSpacing: '0.02em',
  },
  content: {
    padding: '0 40px 48px 40px',
  },
  footer: {
    textAlign: 'center' as const,
    padding: '32px 40px',
    borderTop: '1px solid #27272a',
  },
  footerText: {
    margin: 0,
    fontSize: '11px',
    color: '#52525b',
  },
}

// Shared components for templates
export function Title({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{
      margin: 0,
      fontSize: '28px',
      fontWeight: 300,
      color: '#ffffff',
      textAlign: 'center' as const,
    }}>
      {children}
    </Text>
  )
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{
      margin: '12px 0 0 0',
      fontSize: '14px',
      color: '#71717a',
      textAlign: 'center' as const,
    }}>
      {children}
    </Text>
  )
}

export function Paragraph({ children, center = false }: { children: React.ReactNode; center?: boolean }) {
  return (
    <Text style={{
      margin: 0,
      fontSize: '16px',
      color: '#a1a1aa',
      lineHeight: 1.7,
      textAlign: center ? 'center' as const : 'left' as const,
    }}>
      {children}
    </Text>
  )
}

export function Button({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Section style={{ textAlign: 'center' as const, marginTop: '32px' }}>
      <Link
        href={href}
        style={{
          display: 'inline-block',
          backgroundColor: '#ffffff',
          color: '#000000',
          fontSize: '13px',
          fontWeight: 500,
          padding: '14px 32px',
          textDecoration: 'none',
          borderRadius: '0px',
        }}
      >
        {children}
      </Link>
    </Section>
  )
}

export function Card({ children }: { children: React.ReactNode }) {
  return (
    <Section style={{
      backgroundColor: '#0a0a0a',
      border: '1px solid #27272a',
      borderRadius: '8px',
      padding: '24px',
      marginBottom: '32px',
    }}>
      {children}
    </Section>
  )
}

export function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{
      margin: '0 0 8px 0',
      fontSize: '11px',
      fontWeight: 500,
      color: '#71717a',
      letterSpacing: '0.1em',
      textTransform: 'uppercase' as const,
      textAlign: 'center' as const,
    }}>
      {children}
    </Text>
  )
}

export function CardValue({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{
      margin: 0,
      fontSize: '18px',
      fontWeight: 500,
      color: '#ffffff',
      textAlign: 'center' as const,
    }}>
      {children}
    </Text>
  )
}
