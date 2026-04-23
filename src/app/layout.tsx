import React from 'react'

import './globals.css'

// metadata is read by bini-router at build time and injected into index.html.
// It is automatically stripped from the browser bundle — never ships to the client.
export const metadata = {
  title: 'Island Link',
  description:
    "Sri Lanka's Premier Island-to-Island Shopping Experience - Connecting You to Products Across the Islands",
  keywords: [
    'IslandLink',
    'e-commerce Sri Lanka',
    'online shopping',
    'island shopping',
    'Sri Lanka delivery',
    'RDC network',
    'logistics',
    'customer service',
    'product delivery',
  ],
  themeColor: '#00CFFF',
  manifest: '/site.webmanifest',
  openGraph: {
    title: 'Island Link',
    description:
      "Sri Lanka's Premier Island-to-Island Shopping Experience - Connecting You to Products Across the Islands",
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Island Link',
    creator: '@binidu01',
    images: ['/og-image.png'],
  },
  icons: {
    icon: [{ url: '/favicon.ico', type: 'image/x-icon' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
}

// Root layout — wraps every page.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <React.Fragment>{children}</React.Fragment>
}
