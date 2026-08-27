import type { Metadata } from "next";
import "./globals.css";
import { CatalogRealtime } from "@/components/catalog-realtime";

export const metadata: Metadata = {
  title: "Happinotes",
  description: "Practical Books for Real Life",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="antialiased"
      >
        <CatalogRealtime />
        {children}
      </body>
    </html>
  );
}
