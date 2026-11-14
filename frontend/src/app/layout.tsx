import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { CopilotWidget } from "@/components/copilot-widget";
import { OnboardingTour } from "@/components/onboarding-tour";

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
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased bg-background text-foreground selection:bg-emerald-500 selection:text-white">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={true}>
          <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-200">
            <Navigation />
            <main className="flex-1 w-full">{children}</main>
            <Footer />
            <CopilotWidget />
            <OnboardingTour />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
