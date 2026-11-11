import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: "OpenDataLens — AI-Powered Dataset Explorer & Automated ML Platform",
  description:
    "Explore Hugging Face datasets, audit data quality, train leak-free Scikit-learn pipelines with asynchronous background jobs, and compare model benchmarks.",
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
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="font-sans antialiased bg-[#09090B] text-zinc-100">
        <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" enableSystem={false}>
          <div className="min-h-screen flex flex-col bg-[#09090B] text-zinc-100">
            <Navigation />
            <main className="flex-1 w-full">{children}</main>
            <Footer />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
