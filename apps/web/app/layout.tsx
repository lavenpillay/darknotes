import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'DarkNotes' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400&family=Lora:wght@400;600&family=Merriweather:wght@400;700&family=Libre+Baskerville:wght@400;700&family=Cormorant+Garamond:wght@400;600&family=EB+Garamond:wght@400;600&family=Crimson+Text:wght@400;600&family=Raleway:wght@400;600&family=Montserrat:wght@400;600&family=Josefin+Sans:wght@400;600&family=Space+Mono:wght@400;700&family=Inconsolata:wght@400;600&family=Abril+Fatface&family=Pacifico&family=Dancing+Script:wght@400;600&family=Satisfy&family=Caveat:wght@400;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
