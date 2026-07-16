import { db } from "@/lib/db";
import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import moment from "moment";
import { ArrowLeft, Loader2, Rocket, Trash2, Sparkles, ThumbsUp, ThumbsDown, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

const STAGES = {
  ideia: "Ideia",
  prototipo: "Protótipo",
  mvp: "MVP",
  tracao: "Tração",
  serie_a: "Série A",
};

const CANVAS_FIELDS = [
  { key: "canvas_problem", label: "Problema" },
  { key: "canvas_solution", label: "Solução" },
  { key: "canvas_market", label: "Mercado" },
  { key: "canvas_customers", label: "Clientes" },
  { key: "canvas_revenue", label: "Receita" },
  { key: "canvas_technology", label: "Tecnologia" },
  { key: "canvas_team", label: "Equipe" },
  { key: "canvas_investment", label: "Investimento" },
  { key: "canvas_roadmap", label: "Roadmap" },
];

export default function ProjectDetail() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [interested, setInterested] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [matches, setMatches] = useState([]);

  const loadData = useCallback(async () => {
    try {
      const me = await db.auth.me();
      setCurrentUserId(me.id);

      const p = await db.entities.Project.get(projectId);
      setProject(p);

      const myInterests = await db.entities.ProjectInterest.filter({ project_id: projectId, user_id: me.id });
      setInterested(myInterests.length > 0);

      // Compatibilidade: cruza o que o projeto busca (p.seeking) e a área (p.area)
      // com o que cada pessoa realmente preencheu no perfil (expertise/interests).
      // 100% real — sem esse dado preenchido, a pessoa simplesmente não aparece.
      const seekingRoles = (p.seeking || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
      if (seekingRoles.length > 0 || p.area) {
        const allProfiles = await db.entities.UserProfile.list(null, 200);
        const scored = allProfiles
          .filter(u => u.user_id !== p.creator_id && (u.expertise || u.interests))
          .map(u => {
            const expertise = (u.expertise || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
            const interests = (u.interests || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
            const roleMatches = seekingRoles.filter(r => expertise.includes(r)).length;
            const roleScore = seekingRoles.length > 0 ? (roleMatches / seekingRoles.length) * 80 : 0;
            const areaScore = p.area && interests.includes(p.area.trim().toLowerCase()) ? 20 : 0;
            const score = Math.round(roleScore + areaScore);
            return { ...u, matchScore: score };
          })
          .filter(u => u.matchScore > 0)
          .sort((a, b) => b.matchScore - a.matchScore)
          .slice(0, 5);
        setMatches(scored);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleInterest = async () => {
    try {
      const me = await db.auth.me();
      if (interested) {
        const existing = await db.entities.ProjectInterest.filter({ project_id: projectId, user_id: me.id });
        if (existing[0]) await db.entities.ProjectInterest.delete(existing[0].id);
        await db.entities.Project.update(projectId, { interested_count: Math.max(0, (project.interested_count || 1) - 1) });
        setInterested(false);
        setProject(prev => ({ ...prev, interested_count: Math.max(0, (prev.interested_count || 1) - 1) }));
      } else {
        await db.entities.ProjectInterest.create({ project_id: projectId, user_id: me.id });
        await db.entities.Project.update(projectId, { interested_count: (project.interested_count || 0) + 1 });
        setInterested(true);
        setProject(prev => ({ ...prev, interested_count: (prev.interested_count || 0) + 1 }));
      }
    } catch (e) { console.error(e); }
  };

  const handleDelete = async () => {
    try {
      await db.entities.Project.delete(projectId);
      navigate("/labs");
    } catch (e) { console.error(e); }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch("/api/analyze-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: project.name,
          area: project.area,
          stage: project.stage,
          description: project.description,
          seeking: project.seeking,
        }),
      });
      if (!res.ok) throw new Error("Falha ao analisar");
      const result = await res.json();
      const updated = await db.entities.Project.update(projectId, { ...result, ai_analyzed_at: new Date().toISOString() });
      setProject(updated);
    } catch (e) { console.error(e); }
    setAnalyzing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (!project) {
    return <div className="text-center py-24 text-muted-foreground">Projeto não encontrado.</div>;
  }

  const seekingRoles = (project.seeking || "").split(",").map(s => s.trim()).filter(Boolean);

  return (
    <div>
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-lg border-b border-border px-6 py-3 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        {project.creator_id === currentUserId && (
          <button onClick={handleDelete} className="flex items-center gap-1.5 text-sm text-destructive hover:underline">
            <Trash2 className="w-4 h-4" /> Excluir
          </button>
        )}
      </div>

      <div className="px-6 py-8 max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-bold uppercase tracking-wide text-primary bg-primary/10 px-2.5 py-1 rounded-full">
            {STAGES[project.stage] || project.stage}
          </span>
          {project.area && <span className="text-xs text-muted-foreground">{project.area}</span>}
        </div>

        <h1 className="font-display text-3xl font-bold mb-3 flex items-center gap-2">
          <Rocket className="w-6 h-6 text-primary" /> {project.name}
        </h1>

        <Link to={`/user/${project.creator_id}`} className="flex items-center gap-2.5 mb-6">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0 overflow-hidden">
            {project.creator_avatar ? (
              <img src={project.creator_avatar} alt={project.creator_name} className="w-full h-full object-cover" />
            ) : (
              project.creator_name?.[0]?.toUpperCase() || "?"
            )}
          </div>
          <div>
            <p className="text-sm font-semibold hover:underline">{project.creator_name}</p>
            <p className="text-xs text-muted-foreground">{moment(project.created_date).format("D [de] MMMM [de] YYYY")}</p>
          </div>
        </Link>

        <div className="text-[16px] leading-[1.8] whitespace-pre-wrap break-words text-foreground/90 mb-6">
          {project.description}
        </div>

        {seekingRoles.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Procurando:</p>
            <div className="flex flex-wrap gap-2">
              {seekingRoles.map((role, i) => (
                <span key={i} className="text-xs px-3 py-1.5 rounded-full bg-secondary">{role}</span>
              ))}
            </div>
          </div>
        )}

        <Button
          onClick={toggleInterest}
          variant={interested ? "default" : "outline"}
          className="w-full h-12"
        >
          {interested ? "✓ Você tem interesse" : "Tenho interesse"} {project.interested_count > 0 && `· ${project.interested_count}`}
        </Button>

        {project.creator_id === currentUserId && matches.length > 0 && (
          <div className="mt-6 rounded-2xl border border-border p-5">
            <h3 className="text-sm font-bold mb-1 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Seu projeto combina com
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Baseado no que essas pessoas preencheram no próprio perfil — só visível pra você.
            </p>
            <div className="space-y-3">
              {matches.map((u) => (
                <Link
                  key={u.user_id}
                  to={`/user/${u.user_id}`}
                  className="flex items-center gap-3 hover:bg-secondary/50 rounded-xl p-2 -m-2 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0 overflow-hidden">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt={u.display_name} className="w-full h-full object-cover" />
                    ) : (
                      u.display_name?.[0]?.toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{u.display_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.expertise || u.interests}</p>
                  </div>
                  <span className="text-sm font-bold text-primary shrink-0">{u.matchScore}%</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {project.creator_id === currentUserId && !project.ai_analyzed_at && (
          <Button
            onClick={handleAnalyze}
            disabled={analyzing}
            variant="outline"
            className="w-full h-12 mt-3"
          >
            {analyzing ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analisando com IA...</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" /> Analisar Projeto com IA</>
            )}
          </Button>
        )}

        {project.ai_analyzed_at && (
          <div className="mt-8 pt-6 border-t border-border space-y-6">
            <div>
              <h3 className="font-display text-lg font-bold mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" /> Resumo Executivo
              </h3>
              <p className="text-sm leading-relaxed text-foreground/90">{project.ai_summary}</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs font-semibold text-emerald-400 mb-2 flex items-center gap-1.5">
                  <ThumbsUp className="w-3.5 h-3.5" /> Pontos fortes
                </p>
                <ul className="text-sm space-y-1.5">
                  {(project.ai_strengths || "").split("\n").filter(Boolean).map((s, i) => (
                    <li key={i} className="text-foreground/80">• {s}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs font-semibold text-red-400 mb-2 flex items-center gap-1.5">
                  <ThumbsDown className="w-3.5 h-3.5" /> Pontos de atenção
                </p>
                <ul className="text-sm space-y-1.5">
                  {(project.ai_weaknesses || "").split("\n").filter(Boolean).map((s, i) => (
                    <li key={i} className="text-foreground/80">• {s}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div>
              <h3 className="font-display text-lg font-bold mb-3">Canvas do Projeto</h3>
              <div className="grid sm:grid-cols-3 gap-3">
                {CANVAS_FIELDS.map(({ key, label }) => (
                  <div key={key} className="rounded-xl border border-border p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
                    <p className="text-xs text-foreground/80 leading-relaxed">{project[key] || "—"}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
