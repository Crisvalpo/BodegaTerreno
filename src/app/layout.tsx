import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'LukeAPP - Bodega Terreno',
  description: 'Sistema de Bodega de Materiales en Terreno',
  manifest: '/manifest.json',
}

export const viewport = {
  themeColor: '#10b981',
  width: 'device-width',
  initialScale: 1,
}


export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className="dark">
      <body className={`${inter.className} min-h-screen bg-neutral-950 text-neutral-50`}>
        {children}
        <Toaster theme="dark" richColors position="top-right" />
      </body>
    </html>
  )
}
