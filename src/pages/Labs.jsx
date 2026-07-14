import { db } from "@/lib/db";
import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import moment from "moment";

import { Rocket, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STAGES = {
  ideia: "Ideia",
  prototipo: "Protótipo",
  mvp: "MVP",
  tracao: "Tração",
  serie_a: "Série A",
};

const SEEKING_OPTIONS = [
  "Investidor", "Co-Founder", "Desenvolvedor", "Designer", "Cientista",
  "Médico", "Advogado", "Mentor", "Pesquisador", "Especialista em IA", "Marketing", "Comercial",
];

export default function Labs() {
  const [projects, setProjects] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [interests, setInterests] = useState({});

  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [stage, setStage] = useState("ideia");
  const [description, setDescription] = useState("");
  const [seeking, setSeeking] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const me = await db.auth.me();
      const profiles = await db.entities.UserProfile.filter({ user_id: me.id });
      setProfile(profiles[0] || null);

      const allProjects = await db.entities.Project.list("-created_date", 50);
      setProjects(allProjects);

      const myInterests = await db.entities.ProjectInterest.filter({ user_id: me.id });
      const map = {};
      myInterests.forEach(i => { map[i.project_id] = i.id; });
      setInterests(map);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleSeeking = (role) => {
    setSeeking(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  };

  const handleCreate = async () => {
    if (!name.trim() || !description.trim() || !profile) return;
    setSubmitting(true);
    try {
      await db.entities.Project.create({
        creator_id: profile.user_id,
        creator_name: profile.display_name,
        creator_username: profile.username,
        creator_avatar: profile.avatar_url || "",
        name: name.trim(),
        area: area.trim(),
        stage,
        description: description.trim(),
        seeking: seeking.join(", "),
      });
      setName(""); setArea(""); setStage("ideia"); setDescription(""); setSeeking([]);
      setShowForm(false);
      loadData();
    } catch (e) { console.error(e); }
    setSubmitting(false);
  };

  const toggleInterest = async (projectId) => {
    try {
      const me = await db.auth.me();
      const project = projects.find(p => p.id === projectId);
      if (interests[projectId]) {
        await db.entities.ProjectInterest.delete(interests[projectId]);
        await db.entities.Project.update(projectId, { interested_count: Math.max(0, (project.interested_count || 1) - 1) });
        setInterests(prev => { const n = { ...prev }; delete n[projectId]; return n; });
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, interested_count: Math.max(0, (p.interested_count || 1) - 1) } : p));
      } else {
        const interest = await db.entities.ProjectInterest.create({ project_id: projectId, user_id: me.id });
        await db.entities.Project.update(projectId, { interested_count: (project.interested_count || 0) + 1 });
        setInterests(prev => ({ ...prev, [projectId]: interest.id }));
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, interested_count: (p.interested_count || 0) + 1 } : p));
      }
    } catch (e) { console.error(e); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-lg border-b border-border px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <Rocket className="w-5 h-5 text-primary" /> Kriti Labs
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Onde ideias viram projetos, e projetos encontram gente.</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)} className="rounded-full">
          {showForm ? <X className="w-4 h-4" /> : <><Plus className="w-4 h-4 mr-1" /> Novo projeto</>}
        </Button>
      </div>

      {showForm && (
        <div className="p-6 border-b border-border space-y-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do projeto" maxLength={80} />
          <div className="grid grid-cols-2 gap-3">
            <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Área (ex: IA, Saúde, Educação)" />
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STAGES).map(([id, label]) => (
                  <SelectItem key={id} value={id}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Qual problema o projeto resolve? Como resolve hoje? Qual o diferencial?"
            rows={4}
            maxLength={2000}
            className="w-full bg-secondary rounded-xl px-3 py-2 text-sm outline-none resize-none"
          />
          <div>
            <p className="text-xs text-muted-foreground mb-2">Estou procurando:</p>
            <div className="flex flex-wrap gap-2">
              {SEEKING_OPTIONS.map(role => (
                <button
                  key={role}
                  type="button"
                  onClick={() => toggleSeeking(role)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    seeking.includes(role) ? "bg-primary text-primary-foreground border-transparent" : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleCreate} disabled={!name.trim() || !description.trim() || submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Publicar projeto"}
            </Button>
          </div>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Rocket className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium">Nenhum projeto ainda</p>
          <p className="text-sm mt-1">Seja o primeiro a publicar uma ideia.</p>
        </div>
      ) : (
        <div className="p-6 grid gap-4 sm:grid-cols-2">
          {projects.map(project => (
            <div key={project.id} className="rounded-2xl border border-border p-5 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                  {STAGES[project.stage] || project.stage}
                </span>
                {project.area && <span className="text-xs text-muted-foreground">{project.area}</span>}
              </div>
              <Link to={`/labs/${project.id}`}>
                <h3 className="font-display text-lg font-bold mb-1.5 hover:text-primary transition-colors">{project.name}</h3>
              </Link>
              <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{project.description}</p>
              {project.seeking && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {project.seeking.split(",").map(s => s.trim()).filter(Boolean).slice(0, 3).map((role, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-foreground/70">{role}</span>
                  ))}
                </div>
              )}
              <div className="mt-auto flex items-center justify-between pt-3 border-t border-border">
                <span className="text-xs text-muted-foreground">{project.creator_name} · {moment(project.created_date).fromNow()}</span>
                <button
                  onClick={() => toggleInterest(project.id)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                    interests[project.id] ? "bg-primary text-primary-foreground border-transparent" : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Tenho interesse {project.interested_count > 0 && `(${project.interested_count})`}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
