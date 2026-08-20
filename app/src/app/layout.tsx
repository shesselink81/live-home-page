import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Used IT Tech @ Home',
  description: 'Home network, self-hosted infrastructure, and GitHub tech-stack dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        {children}
      </body>
    </html>
  )
}
