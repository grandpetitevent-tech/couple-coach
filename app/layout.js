export const metadata = {
  title: 'Wilson & Océane — Coach IA',
  description: 'Plateforme privée de coaching sportif IA',
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  )
}
