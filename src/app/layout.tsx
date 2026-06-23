import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WeatherTrust Stockholm",
  description: "Jämför noggrannheten hos olika väderapp-källor för Stockholm",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
