import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Happinotes",
  description: "Practical Books for Real Life",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
