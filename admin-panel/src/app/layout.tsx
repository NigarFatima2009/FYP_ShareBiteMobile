import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ShareBite Admin Panel',
  description: 'Admin dashboard for managing NGO verifications and deliveries',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
