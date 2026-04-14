import type { Metadata } from "next";
import Link from "next/link";
import { Inter, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import AuthButtons from "@/components/AuthButtons";
import HeaderNav from "@/components/HeaderNav";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const serif = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: "The Gentle Human Path",
  description: "A better way to guide kids, connect parents, and coach growth.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${serif.variable}`}>
        <header className="site-header">
          <div className="site-shell header-inner">
            <Link href="/" className="brand">
              <div className="brand-mark">GH</div>
              <div>
                <div className="brand-name">The Gentle Human Path</div>
                <div className="brand-subtitle">Coaching, connection, growth</div>
              </div>
            </Link>

            <HeaderNav />
            <AuthButtons />
          </div>
        </header>

        <div className="site-shell">{children}</div>
      </body>
    </html>
  );
}