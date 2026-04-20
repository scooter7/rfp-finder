import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RFP Aggregator",
  description: "Track RFPs across all 50 states for higher-ed, healthcare, K-12, and gov.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="border-b border-border">
          <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
            <a href="/" className="text-lg font-semibold tracking-tight">
              RFP&nbsp;Aggregator
            </a>
            <nav className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="/" className="hover:text-foreground transition">
                Browse
              </a>
              <a href="/saved-searches" className="hover:text-foreground transition">
                Saved Searches
              </a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
