import './globals.css';

export const metadata = {
  title: 'Myntra Wishlist-to-Purchase Conversion Intelligence Engine',
  description: 'AI-powered discovery engine analyzing public customer feedback on why users save fashion items to their wishlist but hesitate at checkout.',
  keywords: ['Myntra', 'Wishlist Intelligence', 'E-commerce Conversion', 'AI Fashion Analytics', 'Groq Llama 3'],
  openGraph: {
    title: 'Myntra Wishlist-to-Purchase Conversion Intelligence Engine',
    description: 'Unlocking why shoppers add fashion items to their wishlist but fail to purchase.',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
