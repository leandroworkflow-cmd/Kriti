const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from "react";

import { Link } from "react-router-dom";
import { Stethoscope, Landmark, Cpu, Palette, TrendingUp, Loader2, Plus, MessageSquare } from "lucide-react";
import moment from "moment";

const CATEGORIES = [
  { id: "medicina", label: "Medicina", icon: Stethoscope, color: "text-red-400", bg: "bg-red-500/10" },
  { id: "politica", label: "Política", icon: Landmark, color: "text-blue-400", bg: "bg-blue-500/10" },
  { id: "tecnologia", label: "Tecnologia", icon: Cpu, color: "text-green-400", bg: "bg-green-500/10" },
  { id: "arte", label: "Arte", icon: Palette, color: "text-purple-400", bg: "bg-purple-500/10" },
  { id: "economia", label: "Economia", icon: TrendingUp, color: "text-amber-400", bg: "bg-amber-500/10" },
];

export default function Forums() {
  const [selected, setSelected] = useState(null);
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    db.entities.ForumThread.filter({ category: selected }, "-created_date", 30)
      .then(setThreads)
      .finally(() => setLoading(false));
  }, [selected]);

  if (!selected) {
    return (
      <div>
        <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-lg border-b border-border px-4 py-3">
          <h2 className="font-display text-xl font-bold">Fóruns</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Espaços de crescimento intelectual</p>
        </div>
        <div className="p-4 space-y-3">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelected(cat.id)}
              className="w-full flex items-center gap-4 p-5 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all group"
            >
              <div className={`w-12 h-12 rounded-xl ${cat.bg} flex items-center justify-center`}>
                <cat.icon className={`w-6 h-6 ${cat.color}`} />
              </div>
              <div className="text-left">
                <h3 className="font-semibold group-hover:text-primary transition-colors">{cat.label}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Discussões e debates</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const cat = CATEGORIES.find(c => c.id === selected);

  return (
    <div>
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-lg border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground text-sm">←</button>
            <div className="flex items-center gap-2">
              <cat.icon className={`w-5 h-5 ${cat.color}`} />
              <h2 className="font-display text-lg font-bold">{cat.label}</h2>
            </div>
          </div>
          <Link
            to={`/forums/${selected}/new`}
            className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground"
          >
            <Plus className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : threads.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Nenhuma discussão ainda</p>
          <Link to={`/forums/${selected}/new`} className="text-primary text-sm mt-2 inline-block hover:underline">
            Iniciar a primeira discussão
          </Link>
        </div>
      ) : (
        <div>
          {threads.map((thread) => (
            <Link
              key={thread.id}
              to={`/thread/${thread.id}`}
              className="block p-4 border-b border-border hover:bg-card/50 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-sm font-semibold">{thread.author_name}</span>
                <span className="text-[10px] text-muted-foreground">{moment(thread.created_date).fromNow()}</span>
              </div>
              <h3 className="font-semibold text-sm">{thread.title}</h3>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{thread.content}</p>
              <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                <span>💬 {thread.replies_count || 0} respostas</span>
                <span>❤️ {thread.likes_count || 0}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}