import { db } from "@/lib/db";
import React, { useState } from "react";

import { Image, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CATEGORIES = [
  { value: "general", label: "Geral" },
  { value: "tecnologia", label: "Tecnologia" },
  { value: "medicina", label: "Medicina" },
  { value: "politica", label: "Política" },
  { value: "arte", label: "Arte & Cultura" },
  { value: "economia", label: "Economia" },
];

export default function PostComposer({ profile, onPosted }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");
  const [posting, setPosting] = useState(false);
  const [imageFile, setImageFile] = useState(null);

  const handlePost = async () => {
    if (!content.trim() || !profile) return;
    setPosting(true);
    try {
      let imageUrl = "";
      if (imageFile) {
        const { file_url } = await db.integrations.Core.UploadFile({ file: imageFile });
        imageUrl = file_url;
      }
      const newPost = await db.entities.Post.create({
        author_id: profile.user_id,
        author_name: profile.display_name,
        author_username: profile.username,
        author_avatar: profile.avatar_url || "",
        title: title.trim() || null,
        content: content.trim(),
        image_url: imageUrl,
        forum_category: category,
        insight_count: 0,
        discordo_count: 0,
        aprendi_count: 0,
        comments_count: 0,
        reposts_count: 0,
      });
      setTitle("");
      setContent("");
      setCategory("general");
      setImageFile(null);
      onPosted?.();

      // Avaliação por IA (Reputação do Insight) — roda em segundo plano,
      // não trava a publicação. Se falhar, o post simplesmente fica sem nota.
      fetch("/api/score-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newPost.title, content: newPost.content }),
      })
        .then((r) => r.json())
        .then((result) => {
          if (result?.scored) {
            db.entities.Post.update(newPost.id, {
              clarity_score: result.clarity_score,
              originality_score: result.originality_score,
              sources_score: result.sources_score,
              rigor_score: result.rigor_score,
              impact_score: result.impact_score,
              overall_score: result.overall_score,
            }).catch(() => {});
          }
        })
        .catch(() => {});
    } catch (e) {
      console.error(e);
    }
    setPosting(false);
  };

  return (
    <div className="p-6 border-b border-border">
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt={profile?.display_name} className="w-full h-full object-cover" />
          ) : (
            profile?.display_name?.[0]?.toUpperCase() || "?"
          )}
        </div>
        <div className="flex-1">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título (opcional)"
            maxLength={120}
            className="border-none bg-transparent px-0 text-base font-display font-semibold placeholder-muted-foreground focus-visible:ring-0"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Compartilhe uma ideia que vale ser discutida."
            rows={4}
            className="w-full bg-transparent text-foreground placeholder-muted-foreground resize-none border-none outline-none text-[15px] leading-relaxed min-h-[100px] focus:outline-none mt-1"
            maxLength={3000}
          />
          {imageFile && (
            <div className="mt-2 relative inline-block">
              <img
                src={URL.createObjectURL(imageFile)}
                alt="preview"
                className="max-h-40 rounded-xl"
              />
              <button
                onClick={() => setImageFile(null)}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-white text-xs flex items-center justify-center"
              >
                ✕
              </button>
            </div>
          )}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
            <div className="flex items-center gap-3">
              <label className="cursor-pointer text-muted-foreground hover:text-primary transition-colors">
                <Image className="w-5 h-5" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setImageFile(e.target.files[0])}
                />
              </label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-8 w-[150px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{content.length}/3000</span>
              <Button
                onClick={handlePost}
                disabled={!content.trim() || posting}
                size="sm"
                className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 rounded-full px-5"
              >
                {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
