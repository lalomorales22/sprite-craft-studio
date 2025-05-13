import type {Metadata} from 'next';
import {Pixelify_Sans} from 'next/font/google'; // Import Pixelify Sans
import './globals.css';
import {Toaster} from '@/components/ui/toaster'; // Import Toaster

const pixelify = Pixelify_Sans({
  variable: '--font-pixelify-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'SpriteCraft Studio', // Updated title
  description: 'Generate and edit 8-bit sprites with AI.', // Updated description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${pixelify.variable} font-sans antialiased bg-background text-foreground`}>
        <main className="min-h-screen flex flex-col">
          {children}
        </main>
        <Toaster /> {/* Add Toaster for notifications */}
      </body>
    </html>
  );
}
