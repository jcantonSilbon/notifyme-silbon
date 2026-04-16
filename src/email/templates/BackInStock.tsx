import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
  Button,
  Img,
  Hr,
  Preview,
  Section,
} from '@react-email/components'
import * as React from 'react'

interface BackInStockEmailProps {
  productTitle: string
  variantTitle: string
  productUrl: string
  productId: string
  variantId: string
}

export function BackInStockEmail({
  productTitle,
  variantTitle,
  productUrl,
  productId: _productId,
  variantId: _variantId,
}: BackInStockEmailProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>
        ¡{productTitle} en talla {variantTitle} ya está disponible!
      </Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          {/* Logo */}
          <Section style={logoSectionStyle}>
            <Img
              src="https://cdn.shopify.com/s/files/1/silbon-logo.png"
              width="120"
              height="auto"
              alt="Silbon"
              style={logoStyle}
            />
          </Section>

          <Hr style={hrStyle} />

          {/* Main content */}
          <Section style={contentStyle}>
            <Heading style={headingStyle}>¡Está de vuelta!</Heading>
            <Text style={subtitleStyle}>
              El artículo que querías ya está disponible
            </Text>

            <Section style={productBoxStyle}>
              <Text style={productTitleStyle}>{productTitle}</Text>
              <Text style={variantLabelStyle}>
                Talla / Color:{' '}
                <span style={{ fontWeight: '600', color: '#111111' }}>{variantTitle}</span>
              </Text>
            </Section>

            <Text style={bodyTextStyle}>
              Date prisa — los artículos muy solicitados suelen agotarse rápido.
            </Text>

            <Button href={productUrl} style={buttonStyle}>
              Comprar ahora
            </Button>
          </Section>

          <Hr style={hrStyle} />

          {/* Footer */}
          <Section style={footerStyle}>
            <Text style={footerTextStyle}>
              Recibiste este email porque te suscribiste a las notificaciones de restock en{' '}
              <a href="https://silbon.com" style={footerLinkStyle}>
                silbon.com
              </a>
              .
            </Text>
            <Text style={footerTextStyle}>
              © {new Date().getFullYear()} Silbon. Todos los derechos reservados.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default BackInStockEmail

// Styles — inline for maximum email client compatibility
const bodyStyle: React.CSSProperties = {
  backgroundColor: '#f5f5f5',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  margin: '0',
  padding: '0',
}

const containerStyle: React.CSSProperties = {
  maxWidth: '600px',
  margin: '0 auto',
  backgroundColor: '#ffffff',
  padding: '0',
}

const logoSectionStyle: React.CSSProperties = {
  padding: '32px 40px 24px',
  textAlign: 'left' as const,
}

const logoStyle: React.CSSProperties = {
  display: 'block',
}

const hrStyle: React.CSSProperties = {
  borderColor: '#e5e5e5',
  borderWidth: '1px',
  margin: '0',
}

const contentStyle: React.CSSProperties = {
  padding: '40px 40px 32px',
}

const headingStyle: React.CSSProperties = {
  fontSize: '28px',
  fontWeight: '700',
  color: '#111111',
  margin: '0 0 8px 0',
  letterSpacing: '-0.5px',
}

const subtitleStyle: React.CSSProperties = {
  fontSize: '16px',
  color: '#666666',
  margin: '0 0 32px 0',
}

const productBoxStyle: React.CSSProperties = {
  backgroundColor: '#f9f9f9',
  borderLeft: '3px solid #111111',
  padding: '16px 20px',
  marginBottom: '24px',
}

const productTitleStyle: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: '600',
  color: '#111111',
  margin: '0 0 4px 0',
}

const variantLabelStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#555555',
  margin: '0',
}

const bodyTextStyle: React.CSSProperties = {
  fontSize: '15px',
  color: '#444444',
  lineHeight: '1.6',
  margin: '0 0 28px 0',
}

const buttonStyle: React.CSSProperties = {
  backgroundColor: '#111111',
  color: '#ffffff',
  padding: '14px 36px',
  borderRadius: '2px',
  textDecoration: 'none',
  display: 'inline-block',
  fontSize: '13px',
  fontWeight: '600',
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
}

const footerStyle: React.CSSProperties = {
  padding: '24px 40px',
  backgroundColor: '#f9f9f9',
}

const footerTextStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#999999',
  margin: '0 0 4px 0',
  lineHeight: '1.5',
}

const footerLinkStyle: React.CSSProperties = {
  color: '#999999',
  textDecoration: 'underline',
}
