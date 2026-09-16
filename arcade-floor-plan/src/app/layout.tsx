import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MOREFUN Space Planer",
  description: "Internal Pilot · Visual planning for arcade venues",
  icons: { icon: "/koko-arcade-icon.png" },
};
const themeBootstrap = `(()=>{try{const key="arcade-floor-plan-theme-preference";const value=localStorage.getItem(key);const preference=value==="light"||value==="dark"||value==="system"?value:"system";const theme=preference==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):preference;document.documentElement.dataset.theme=theme;document.documentElement.dataset.themePreference=preference}catch{}})()`;
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeBootstrap }} /></head><body>{children}</body></html>;
}
