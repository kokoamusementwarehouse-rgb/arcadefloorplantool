import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arcade Floor Plan",
  description: "Internal Pilot · Visual planning for arcade venues",
  icons: { icon: "/koko-arcade-icon.png" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
