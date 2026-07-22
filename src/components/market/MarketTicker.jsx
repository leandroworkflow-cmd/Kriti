import { db } from "@/lib/db";
import React, { useState, useEffect } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

// Ticker de mercado: sempre lê do banco (dado cacheado pelo cron job em
// /api/update-market-data), nunca busca direto de nenhuma API externa.
export default function MarketTicker() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    db.entities.MarketData.list("symbol")
      .then(setItems)
      .catch(() => {});
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="overflow-x-auto no-scrollbar border-b border-border bg-secondary/30">
      <div className="flex items-center gap-6 px-6 py-2.5 w-max">
        {items.map((item) => {
          const up = (item.change_percent || 0) >= 0;
          return (
            <div key={item.symbol} className="flex items-center gap-2 text-xs shrink-0">
              <span className="font-semibold text-foreground/80">{item.label}</span>
              <span className="text-muted-foreground tabular-nums">
                {item.price?.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
              </span>
              <span
                className={`flex items-center gap-0.5 font-medium tabular-nums ${
                  up ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(item.change_percent || 0).toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
