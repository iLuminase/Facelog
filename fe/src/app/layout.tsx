import type { Metadata } from 'next';
import { Quicksand } from 'next/font/google';
import './globals.css';

const quicksand = Quicksand({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-quicksand'
});

export const metadata: Metadata = {
  title: 'HUTECH | Quản lý nhân sự - Chấm công tự động',
  description: 'Hệ thống quản lý nhân sự và chấm công tự động HUTECH',
  icons: { icon: '/logo2.png', shortcut: '/logo2.png', apple: '/logo2.png' }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className={quicksand.variable}>{children}</body>
    </html>
  );
}
