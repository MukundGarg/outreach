import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'ApplyPilot AI — Your next chapter',
  description: 'A thoughtful workspace for your next career move.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
