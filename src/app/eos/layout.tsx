import type { Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  colorScheme: "light",
};

export default function EOSLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="eos-force-light">{children}</div>;
}
