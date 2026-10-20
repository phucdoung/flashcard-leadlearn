import './globals.css';
import Providers from './providers';

export const metadata = {
  title: 'LeafLearn',
  description: 'LeafLearn - Nền tảng học flashcard, từ vựng và luyện tập thông minh',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.png', type: 'image/png' },
    ],
    apple: '/logo-icon.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,600;0,700;1,600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#fbfbfa] text-slate-800 font-sans antialiased min-h-screen">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
