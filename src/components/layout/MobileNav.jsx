import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Search, BookOpen, Bell, User } from "lucide-react";

const NAV_ITEMS = [
  { icon: Home, path: "/" },
  { icon: Search, path: "/explore" },
  { icon: BookOpen, path: "/forums" },
  { icon: Bell, path: "/notifications" },
  { icon: User, path: "/profile" },
];

export default function MobileNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border z-50 lg:hidden">
      <div className="flex justify-around py-2">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`p-3 rounded-xl transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <item.icon className="w-5 h-5" />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}