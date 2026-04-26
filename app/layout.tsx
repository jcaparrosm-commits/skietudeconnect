import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: "Planning App",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Planning App",
  },
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0", 
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${inter.className} bg-gray-50`}>
        <div className="pb-24">{children}</div>
        {/* Barre de navigation simplifiée */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 flex justify-around shadow-lg">
          
        </nav>
      </body>
    </html>
  )
}