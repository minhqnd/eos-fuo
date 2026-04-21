import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import DesktopOnlyGuard from "./desktop-only-guard";
import DisableReactDevToolsInProduction from "./disable-react-devtools";
import "./base.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EOS FUO",
  description: "Kho đề thi tổng hợp và giao diện luyện đề EOS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <DisableReactDevToolsInProduction />
        <DesktopOnlyGuard>{children}</DesktopOnlyGuard>
      </body>
    </html>
  );
}
