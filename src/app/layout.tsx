import type { Metadata } from "next";
import "@fontsource-variable/noto-sans-sc";
import "@fontsource/maple-mono/400.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mermaid Canvas Editor",
  description: "A Mermaid editor with a draggable infinite Konva canvas."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
