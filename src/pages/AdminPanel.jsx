import { db } from "@/lib/db";
import React, { useState, useEffect, useCallback } from "react";

import { Shield, Ban, CheckCircle, Brain, Search, Loader2, Users, AlertTriangle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import moment from "moment";

export default function AdminPanel() {
  const [profiles, setProfiles] = useState([]);
  const [stats, setStats] = useState({ total: 0, passed: 0, banned: 0, pending: 0, avgIQ: 0, passRate: 0 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [banTarget, setBanTarget] = useState(null);
  const [banReason, setBanReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await db.entities.UserProfile.list("-created_date", 100);
      setProfiles(all);
      const testTakers = all.filter(p => p.test_passed || (p.iq_score && p.iq_score > 0));
      const avgIQ = testTakers.length > 0
        ? Math.round(testTakers.reduce((sum, p) => sum + (p.iq_score || 0), 0) / testTakers.length)
        : 0;
      const passRate = all.length > 0
        ? Math.round((all.filter(p => p.test_passed).length / all.length) * 100)
        : 0;
      setStats({
        total: all.length,
        passed: all.filter(p => p.test_passed).length,
        banned: all.filter(p => p.banned).length,
        pending: all.filter(p => !p.test_passed && !p.banned).length,
        avgIQ,
        passRate,
      });
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = profiles.filter(p => {
    const matchesQuery = !query ||
      p.display_name?.toLowerCase().includes(query.toLowerCase()) ||
      p.username?.toLowerCase().includes(query.toLowerCase());
    const matchesFilter =
      filter === "all" ? true :
      filter === "passed" ? p.test_passed :
      filter === "pending" ? !p.test_passed && !p.banned :
      filter === "banned" ? p.banned : true;
    return matchesQuery && matchesFilter;
  });

  const handleBan = async () => {
    if (!banTarget) return;
    try {
      await db.entities.UserProfile.update(banTarget.id, {
        banned: true,
        ban_reason: banReason.trim() || "Violação das regras da comunidade",
        banned_at: new Date().toISOString(),
      });
      setBanTarget(null);
      setBanReason("");
      load();
    } catch (e) { console.error(e); }
  };

  const handleUnban = async (profile) => {
    try {
      await db.entities.UserProfile.update(profile.id, {
        banned: false,
        ban_reason: "",
        banned_at: "",
      });
      load();
    } catch (e) { console.error(e); }
  };

  const STAT_CARDS = [
    { label: "Total", value: stats.total, icon: Users, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "Aprovados", value: stats.passed, icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/10" },
    { label: "Banidos", value: stats.banned, icon: Ban, color: "text-red-400", bg: "bg-red-500/10" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-4 lg:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold">Painel Administrativo</h1>
              <p className="text-xs text-muted-foreground">Gerencie usuários e testes de QI</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {STAT_CARDS.map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* IQ Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
              <Brain className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.avgIQ}</p>
              <p className="text-xs text-muted-foreground">Média de QI dos usuários</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
              <CheckCircle className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.passRate}%</p>
              <p className="text-xs text-muted-foreground">Taxa de aprovação no teste</p>
            </div>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar usuário..."
              className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {[
              { id: "all", label: "Todos" },
              { id: "passed", label: "Aprovados" },
              { id: "pending", label: "Pendentes" },
              { id: "banned", label: "Banidos" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                  filter === f.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* User List */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>Nenhum usuário encontrado</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((p) => (
              <div
                key={p.id}
                className={`bg-card border rounded-2xl p-4 flex items-center gap-4 ${
                  p.banned ? "border-red-500/30 opacity-70" : "border-border"
                }`}
              >
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold shrink-0 overflow-hidden">
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt={p.display_name} className="w-full h-full object-cover" />
                  ) : (
                    p.display_name?.[0]?.toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{p.display_name}</span>
                    {p.banned && (
                      <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-medium">
                        BANIDO
                      </span>
                    )}
                    {p.test_passed && !p.banned && (
                      <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-medium">
                        APROVADO
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">@{p.username}</p>
                  {p.banned && p.ban_reason && (
                    <p className="text-xs text-red-400/70 mt-1 italic">Motivo: {p.ban_reason}</p>
                  )}
                </div>

                {/* Test info */}
                <div className="hidden sm:flex flex-col items-end text-xs text-muted-foreground shrink-0">
                  <span className="flex items-center gap-1">
                    <Brain className="w-3 h-3" />
                    {p.test_passed ? `QI ${p.iq_score}` : "Sem teste"}
                  </span>
                  {p.test_taken_at && (
                    <span className="text-[10px]">{moment(p.test_taken_at).format("DD/MM/YY")}</span>
                  )}
                </div>

                {/* Actions */}
                {p.banned ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUnban(p)}
                    className="text-green-400 border-green-500/30 hover:bg-green-500/10 shrink-0"
                  >
                    Desbanir
                  </Button>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="text-muted-foreground hover:text-foreground p-2 shrink-0">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setBanTarget(p)} className="text-destructive">
                        <Ban className="w-4 h-4 mr-2" /> Banir usuário
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ban Dialog */}
      <Dialog open={!!banTarget} onOpenChange={(open) => { if (!open) { setBanTarget(null); setBanReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Banir @{banTarget?.username}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Este usuário perderá acesso à rede social imediatamente.
            </p>
            <div>
              <label className="text-sm font-medium mb-2 block">Motivo do banimento</label>
              <textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Ex: comportamento inadequado, spam, etc."
                rows={3}
                className="w-full bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none resize-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleBan} className="bg-destructive hover:bg-destructive/90">
              Confirmar Banimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}