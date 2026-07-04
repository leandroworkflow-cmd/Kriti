const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState } from "react";

import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function NewThread() {
  const { category } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) return;
    setPosting(true);
    try {
      const me = await db.auth.me();
      const profiles = await db.entities.UserProfile.filter({ user_id: me.id });
      const p = profiles[0];
      await db.entities.ForumThread.create({
        title: title.trim(),
        content: content.trim(),
        category,
        author_id: me.id,
        author_name: p?.display_name || me.full_name,
        author_username: p?.username || "user",
      });
      navigate("/forums");
    } catch (e) { console.error(e); }
    setPosting(false);
  };

  return (
    <div>
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-lg border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground text-sm">←</button>
          <h2 className="font-display text-lg font-bold">Nova Discussão</h2>
        </div>
      </div>
      <div className="p-4 space-y-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título da discussão"
          className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-primary"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Desenvolva seu pensamento..."
          rows={8}
          className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none resize-none focus:ring-1 focus:ring-primary"
        />
        <Button
          onClick={handleSubmit}
          disabled={!title.trim() || !content.trim() || posting}
          className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700"
        >
          {posting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Publicar
        </Button>
      </div>
    </div>
  );
}