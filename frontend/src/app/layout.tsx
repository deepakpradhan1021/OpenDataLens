import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: "OpenDataLens — Retro Interface Dataset Explorer & ML Platform",
  description:
    "Retro-engineered dataset explorer & automated model proving ground. Discover data, audit quality, train baselines and export research-ready reports.",
  keywords: [
    "Machine Learning",
    "Dataset Explorer",
    "Hugging Face",
    "Scikit-learn",
    "Data Quality",
    "Model Evaluation",
    "AI Platform",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased bg-[#0C0C0E] text-white">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <div className="min-h-screen flex flex-col bg-[#0C0C0E] text-white">
            <Navigation />
            <main className="flex-1 w-full">{children}</main>
            <Footer />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
