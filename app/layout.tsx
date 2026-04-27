import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

// Configuration des métadonnées
export const metadata = {
  title: "Skietudeconnect",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Skietude",
  },
  // AJOUT DE L'ICÔNE APPLE
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

// Configuration du viewport (recommandé par Next.js pour éviter les avertissements)
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: 0,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${inter.className} bg-gray-50`}>
        {/* Conteneur principal avec padding en bas pour la navigation */}
        <div className="pb-24">{children}</div>
        
        {/* Barre de navigation simplifiée */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 flex justify-around shadow-lg z-50">
          {/* Tu peux ajouter tes liens de navigation ici plus tard */}
        </nav>
      </body>
    </html>
  )
}