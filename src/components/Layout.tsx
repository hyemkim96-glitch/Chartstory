import React from "react";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { Toaster } from "@/components/ui/sonner";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-surface-01 text-primary flex flex-col font-sans">
      <Header />

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
        <Sidebar className="w-96 border-l border-default hidden lg:flex flex-col" />
      </div>

      <Toaster
        position="bottom-right"
        toastOptions={{
          className: "bg-surface-03 border-default text-primary",
        }}
      />
    </div>
  );
}
