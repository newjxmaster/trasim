import '@solana/wallet-adapter-react-ui/styles.css';
import './globals.css';

export const metadata = {
  title: 'TRASIM - Solana Market Simulation',
  description: 'A Solana-based speculative market simulation game',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
