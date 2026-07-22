import { createClient } from "@supabase/supabase-js";

// Executado periodicamente por um Vercel Cron Job (ver vercel.json).
// Busca cotações via Yahoo Finance (endpoint não-oficial, gratuito, sem
// necessidade de chave de API) e guarda no Supabase. O app SEMPRE lê os
// dados do banco, nunca direto da Yahoo — assim não há limite de requisições
// por usuário, e se essa fonte um dia parar de funcionar, só esta função
// precisa ser ajustada (o resto do site continua no ar normalmente).

const SYMBOLS = [
  { symbol: "^BVSP", label: "IBOVESPA" },
  { symbol: "^GSPC", label: "S&P 500" },
  { symbol: "^IXIC", label: "NASDAQ" },
  { symbol: "^N225", label: "Nikkei 225" },
  { symbol: "BTC-USD", label: "Bitcoin" },
  { symbol: "ETH-USD", label: "Ethereum" },
  { symbol: "BRL=X", label: "Dólar" },
  { symbol: "GC=F", label: "Ouro (oz)" },
];

export default async function handler(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: "Configuração do servidor incompleta" });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const results = await Promise.allSettled(
    SYMBOLS.map(async ({ symbol, label }) => {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;
      const r = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; KritiMarketBot/1.0)" },
      });
      if (!r.ok) throw new Error(`Falha ao buscar ${symbol}: HTTP ${r.status}`);

      const data = await r.json();
      const meta = data?.chart?.result?.[0]?.meta;
      if (!meta || meta.regularMarketPrice == null) throw new Error(`Sem dado para ${symbol}`);

      const price = meta.regularMarketPrice;
      const prevClose = meta.previousClose ?? meta.chartPreviousClose;
      const changePercent = prevClose ? ((price - prevClose) / prevClose) * 100 : null;

      const { error } = await supabase.from("market_data").upsert({
        symbol,
        label,
        price,
        change_percent: changePercent,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      return symbol;
    })
  );

  const failed = results
    .filter((r) => r.status === "rejected")
    .map((r) => r.reason?.message || "erro desconhecido");

  return res.status(200).json({ updated: results.length - failed.length, failed });
}
