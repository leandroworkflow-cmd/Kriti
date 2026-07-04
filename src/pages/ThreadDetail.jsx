import { db } from "@/lib/db";
import React, { useState, useEffect } from "react";

import { useParams, useNavigate } from "react-router-dom";
import { Loader2, Send } from "lucide-react";
import moment from "moment";

export default function ThreadDetail() {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const [thread, setThread] = useState(null);
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const t = await db.entities.ForumThread.get(threadId);
        setThread(t);
        const r = await db.entities.ForumReply.filter({ thread_id: threadId }, "created_date", 50);
        setReplies(r);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, [threadId]);

  const submitReply = async () => {
    if (!replyText.trim()) return;
    setPosting(true);
    try {
      const me = await db.auth.me();
      const profiles = await db.entities.UserProfile.filter({ user_id: me.id });
      const p = profiles[0];
      const reply = await db.entities.ForumReply.create({
        thread_id: threadId,
        author_id: me.id,
        author_name: p?.display_name || me.full_name,
        author_username: p?.username || "user",
        content: replyText.trim()
      });
      setReplies(prev => [...prev, reply]);
      setReplyText("");
      await db.entities.ForumThread.update(threadId, {
        replies_count: (thread.replies_count || 0) + 1
      });
      setThread(prev => ({ ...prev, replies_count: (prev.replies_count || 0) + 1 }));
    } catch (e) { console.error(e); }
    setPosting(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (!thread) {
    return <div className="text-center py-16 text-muted-foreground">Discussão não encontrada</div>;
  }

  return (
    <div>
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-lg border-b border-border px-4 py-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground text-sm">← Voltar</button>
      </div>

      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
            {thread.author_name?.[0]?.toUpperCase()}
          </div>
          <div>
            <span className="text-sm font-semibold">{thread.author_name}</span>
            <span className="text-xs text-muted-foreground ml-2">{moment(thread.created_date).fromNow()}</span>
          </div>
        </div>
        <h1 className="text-xl font-display font-bold mb-2">{thread.title}</h1>
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{thread.content}</p>
      </div>

      {/* Replies */}
      <div className="divide-y divide-border">
        {replies.map((r) => (
          <div key={r.id} className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold">
                {r.author_name?.[0]?.toUpperCase()}
              </div>
              <span className="text-xs font-semibold">{r.author_name}</span>
              <span className="text-[10px] text-muted-foreground">{moment(r.created_date).fromNow()}</span>
            </div>
            <p className="text-sm ml-8 whitespace-pre-wrap">{r.content}</p>
          </div>
        ))}
      </div>

      {/* Reply input */}
      <div className="sticky bottom-0 lg:bottom-0 bg-card border-t border-border p-4">
        <div className="flex gap-2">
          <input
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && submitReply()}
            placeholder="Sua resposta..."
            className="flex-1 bg-secondary rounded-full px-4 py-2.5 text-sm outline-none"
          />
          <button
            onClick={submitReply}
            disabled={!replyText.trim() || posting}
            className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground disabled:opacity-50"
          >
            {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}