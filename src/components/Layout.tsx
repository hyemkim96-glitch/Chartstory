import React from "react";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { Toaster } from "@/components/ui/sonner";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col font-sans selection:bg-blue-500/30">
      {/* Background blobs for premium feel */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full animate-float" />
        <div
          className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full animate-float"
          style={{ animationDelay: "-3s" }}
        />
      </div>

      <Header />

      <div className="flex-1 flex overflow-hidden relative z-10">
        <main className="flex-1 overflow-auto relative p-6">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
        <Sidebar className="w-96 border-l border-white/5 bg-black/20 backdrop-blur-xl hidden lg:block shadow-2xl" />
      </div>

      <Toaster
        position="bottom-right"
        toastOptions={{
          className: "glass-dark border-white/10 text-white",
        }}
      />
    </div>
  );
}
