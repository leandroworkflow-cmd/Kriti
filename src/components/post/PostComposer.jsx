const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState } from "react";

import { Image, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PostComposer({ profile, category = "general", onPosted }) {
  const [content, setContent] = useState("");
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
      await db.entities.Post.create({
        author_id: profile.user_id,
        author_name: profile.display_name,
        author_username: profile.username,
        author_avatar: profile.avatar_url || "",
        content: content.trim(),
        image_url: imageUrl,
        forum_category: category,
        likes_count: 0,
        comments_count: 0,
        reposts_count: 0,
      });
      setContent("");
      setImageFile(null);
      onPosted?.();
    } catch (e) {
      console.error(e);
    }
    setPosting(false);
  };

  return (
    <div className="p-4 border-b border-border">
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
          {profile?.display_name?.[0]?.toUpperCase() || "?"}
        </div>
        <div className="flex-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="O que está pensando?"
            rows={3}
            className="w-full bg-transparent text-foreground placeholder-muted-foreground resize-none border-none outline-none text-sm min-h-[80px] focus:outline-none"
            maxLength={500}
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
            <label className="cursor-pointer text-muted-foreground hover:text-primary transition-colors">
              <Image className="w-5 h-5" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setImageFile(e.target.files[0])}
              />
            </label>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{content.length}/500</span>
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