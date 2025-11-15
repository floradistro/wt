/**
 * iOS-style Navigation Structure
 * Inspired by Steve Jobs' philosophy: "Simplicity is the ultimate sophistication"
 */

export interface NavItem {
  id: string
  label: string
  icon: string // emoji for now, can be replaced with custom icons
  href?: string
  badge?: number
  comingSoon?: boolean
}

export interface NavSection {
  id: string
  title: string
  items: NavItem[]
}

// Catalog - Products, inventory, and suppliers
export const catalogSection: NavSection = {
  id: 'catalog',
  title: 'CATALOG',
  items: [
    { id: 'products', label: 'Products', icon: '📦', href: '/products' },
    { id: 'labels', label: 'Labels', icon: '🏷️', href: '/labels' },
    { id: 'lab-results', label: 'Lab Results', icon: '📄', href: '/lab-results' },
    { id: 'suppliers', label: 'Suppliers', icon: '📦', href: '/suppliers' },
  ],
}

// Commerce - Orders, customers, and payments
export const commerceSection: NavSection = {
  id: 'commerce',
  title: 'COMMERCE',
  items: [
    { id: 'orders', label: 'Orders', icon: '🛒', href: '/orders' },
    { id: 'customers', label: 'Customers', icon: '👥', href: '/customers' },
    { id: 'wholesale', label: 'Wholesale', icon: '🏢', href: '/wholesale' },
    { id: 'payouts', label: 'Payouts', icon: '💰', href: '/payouts' },
  ],
}

// Insights - Analytics and loyalty
export const insightsSection: NavSection = {
  id: 'insights',
  title: 'INSIGHTS',
  items: [
    { id: 'analytics', label: 'Analytics', icon: '📊', href: '/analytics' },
    { id: 'loyalty', label: 'Loyalty', icon: '🏆', href: '/loyalty' },
  ],
}

// Storefront - Website, branding, and media
export const storefrontSection: NavSection = {
  id: 'storefront',
  title: 'STOREFRONT',
  items: [
    { id: 'website', label: 'Website', icon: '🌐', href: '/website' },
    { id: 'branding', label: 'Branding', icon: '🎨', href: '/branding' },
    { id: 'media', label: 'Media Library', icon: '📸', href: '/media' },
    { id: 'tv-menus', label: 'TV Menus', icon: '📺', href: '/tv-menus' },
  ],
}

// System - Settings and account
export const systemItems: NavItem[] = [
  { id: 'settings', label: 'Settings', icon: '⚙️', href: '/settings' },
  { id: 'locations', label: 'Locations', icon: '📍', href: '/locations' },
  { id: 'employees', label: 'Team', icon: '👔', href: '/employees' },
]

// All sections in order
export const allSections: NavSection[] = [
  catalogSection,
  commerceSection,
  insightsSection,
  storefrontSection,
]
