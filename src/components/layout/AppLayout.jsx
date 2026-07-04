import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="lg:ml-64 min-h-screen pb-20 lg:pb-0">
        <div className="max-w-2xl mx-auto">
          <Outlet />
        </div>
      </main>
      <MobileNav />
    </div>
  );
}