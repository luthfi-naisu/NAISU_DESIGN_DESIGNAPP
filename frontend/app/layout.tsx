import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { Dashboard } from "@/components/Dashboard";
import "./globals.css";

export const metadata: Metadata = {
  title: "Design App",
  description: "Local-first media processing: YouTube to GIF, Shutterstock, AI video",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
