import "./globals.css";

export const metadata = {
  title: "SparkBid — Estimate electrical jobs in minutes",
  description: "AI-powered take-off and estimating for electrical contractors.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
