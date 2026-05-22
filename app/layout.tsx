import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { SupabaseProvider } from '@/components/supabase-provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'GCSE Computer Science Tutor',
  description: 'An AI-powered tutor for GCSE Computer Science',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SupabaseProvider>
          <main className="min-h-screen bg-gray-50">
            {children}
          </main>
        </SupabaseProvider>
      </body>
    </html>
  )
}
