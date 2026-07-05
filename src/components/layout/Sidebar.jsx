import { db } from "@/lib/db";
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Search, MessageSquare, User, BookOpen, Brain, LogOut, Bell, Shield, Bookmark } from "lucide-react";

import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { icon: Home, label: "Feed", path: "/" },
  { icon: Search, label: "Explorar", path: "/explore" },
  { icon: BookOpen, label: "Fóruns", path: "/forums" },
  { icon: Bookmark, label: "Salvos", path: "/bookmarks" },
  { icon: Bell, label: "Notificações", path: "/notifications" },
  { icon: User, label: "Perfil", path: "/profile" },
];

export default function Sidebar() {
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    db.auth.me().then(me => setIsAdmin(me.role === "admin")).catch(() => {});
  }, []);

  const navItems = [...NAV_ITEMS];
  if (isAdmin) navItems.push({ icon: Shield, label: "Painel Admin", path: "/admin" });

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-card border-r border-border flex flex-col z-40 max-lg:hidden">
      <div className="p-6">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shrink-0">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <span className="font-display text-2xl font-bold text-white tracking-tight">Kriti</span>
        </Link>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border">
        <button
          onClick={() => db.auth.logout("/")}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all w-full"
        >
          <LogOut className="w-5 h-5" />
          Sair
        </button>
      </div>
    </aside>
  );
}