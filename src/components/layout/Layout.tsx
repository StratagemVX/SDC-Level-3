
import React from "react";
import { Outlet } from "react-router-dom";
import Header from "./Header";

export default function Layout() {
  return (
    <div className="flex flex-col min-h-screen relative">
      <div className="scanline"></div>
      <Header />
      <main className="flex-1 py-1 px-4 flex justify-center w-full z-10">
        <Outlet />
      </main>
      <footer className="py-6 mt-auto text-center text-xs font-mono text-primary/50 relative z-10">
        <p>SYSTEM.SHADOW_CIPHER_V1.1 // {new Date().getFullYear()} // SECURE_CHANNEL</p>
      </footer>
    </div>
  );
}
