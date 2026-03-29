import "./globals.css";

export const metadata = {
  title: "SparkBid — Win more work. Bid smarter.",
  description: "AI-powered bidding platform for electrical contractors and general contractors.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
