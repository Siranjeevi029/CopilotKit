import type { Metadata } from "next";

import { CopilotKit } from "@copilotkit/react-core";
import "@/lib/patchCopilotkit";
import { AppNav } from "@/components/AppNav";
import "./globals.css";
import "@copilotkit/react-ui/styles.css";

export const metadata: Metadata = {
  title: "Copilot Playground",
  description: "Sample experiences powered by CopilotKit and LlamaIndex",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-950 text-slate-50">
        <CopilotKit runtimeUrl="/api/copilotkit" agent="sample_agent">
          <div className="min-h-screen">
            <AppNav />
            {children}
          </div>
        </CopilotKit>
      </body>
    </html>
  );
}
