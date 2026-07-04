import React from "react";
import { Bell } from "lucide-react";

export default function Notifications() {
  return (
    <div>
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-lg border-b border-border px-4 py-3">
        <h2 className="font-display text-xl font-bold">Notificações</h2>
      </div>
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Bell className="w-12 h-12 mb-4 opacity-20" />
        <p className="text-sm">Nenhuma notificação por enquanto</p>
      </div>
    </div>
  );
}