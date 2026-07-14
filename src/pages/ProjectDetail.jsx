import { db } from "@/lib/db";
import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import moment from "moment";
import { ArrowLeft, Loader2, Rocket, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const STAGES = {
  ideia: "Ideia",
  prototipo: "Protótipo",
  mvp: "MVP",
  tracao: "Tração",
  serie_a: "Série A",
};

export default function ProjectDetail() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [interested, setInterested] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const me = await db.auth.me();
      setCurrentUserId(me.id);

      const p = await db.entities.Project.get(projectId);
      setProject(p);

      const myInterests = await db.entities.ProjectInterest.filter({ project_id: projectId, user_id: me.id });
      setInterested(myInterests.length > 0);
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
      </div>
    </div>
  );
}
