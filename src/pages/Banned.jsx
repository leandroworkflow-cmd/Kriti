import { db } from "@/lib/db";
import React from "react";
import { Ban } from "lucide-react";

export default function Banned() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
          <Ban className="w-10 h-10 text-red-400" />
        </div>
        <h1 className="font-display text-2xl font-bold mb-3">Conta Suspensa</h1>
        <p className="text-muted-foreground mb-8">
          Sua conta foi suspensa pela administração. Se acredita que isso é um erro, entre em contato com o suporte.
        </p>
        <button
          onClick={() => db.auth.logout("/")}
          className="text-sm text-primary hover:underline"
        >
          Sair da conta
        </button>
      </div>
    </div>
  );
}