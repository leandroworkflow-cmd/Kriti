const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState } from "react";

import { Heart, MessageCircle, Repeat2, Share, MoreHorizontal, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import moment from "moment";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function PostCard({ post, currentUserId, onLike, onDelete, onComment }) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);

  const loadComments = async () => {
    if (showComments) {
      setShowComments(false);
      return;
    }
    setLoadingComments(true);
    try {
      const res = await db.entities.Comment.filter({ post_id: post.id }, "-created_date", 20);
      setComments(res);
    } catch (e) { console.error(e); }
    setLoadingComments(false);
    setShowComments(true);
  };

  const submitComment = async () => {
    if (!commentText.trim()) return;
    try {
      const me = await db.auth.me();
      const profiles = await db.entities.UserProfile.filter({ user_id: me.id });
      const p = profiles[0];
      const newComment = await db.entities.Comment.create({
        post_id: post.id,
        author_id: me.id,
        author_name: p?.display_name || me.full_name,
        author_username: p?.username || "user",
        content: commentText.trim()
      });
      setComments(prev => [newComment, ...prev]);
      setCommentText("");
      await db.entities.Post.update(post.id, { comments_count: (post.comments_count || 0) + 1 });
      onComment?.();
    } catch (e) { console.error(e); }
  };

  return (
    <div className="p-4 border-b border-border hover:bg-card/50 transition-colors">
      {post.is_repost && (
        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1 ml-12">
          <Repeat2 className="w-3 h-3" /> Repostado de @{post.original_author_name}
        </p>
      )}
      <div className="flex gap-3">
        <Link to={`/user/${post.author_id}`}>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
            {post.author_name?.[0]?.toUpperCase() || "?"}
          </div>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Link to={`/user/${post.author_id}`} className="font-semibold text-sm hover:underline truncate">
                {post.author_name}
              </Link>
              <span className="text-muted-foreground text-xs truncate">@{post.author_username}</span>
              <span className="text-muted-foreground text-xs">·</span>
              <span className="text-muted-foreground text-xs shrink-0">{moment(post.created_date).fromNow()}</span>
            </div>
            {post.author_id === currentUserId && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="text-muted-foreground hover:text-foreground p-1">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onDelete?.(post.id)} className="text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" /> Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <p className="text-sm mt-1 whitespace-pre-wrap break-words">{post.content}</p>

          {post.image_url && (
            <img src={post.image_url} alt="" className="mt-3 rounded-xl max-h-80 w-full object-cover border border-border" />
          )}

          {/* Actions */}
          <div className="flex items-center gap-6 mt-3">
            <button
              onClick={loadComments}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-blue-400 transition-colors text-xs"
            >
              <MessageCircle className="w-4 h-4" />
              {post.comments_count || 0}
            </button>
            <button
              onClick={() => onLike?.(post.id)}
              className={`flex items-center gap-1.5 transition-colors text-xs ${
                post._liked ? "text-pink-500" : "text-muted-foreground hover:text-pink-500"
              }`}
            >
              <Heart className={`w-4 h-4 ${post._liked ? "fill-current" : ""}`} />
              {post.likes_count || 0}
            </button>
            <button className="flex items-center gap-1.5 text-muted-foreground hover:text-green-400 transition-colors text-xs">
              <Repeat2 className="w-4 h-4" />
              {post.reposts_count || 0}
            </button>
            <button className="text-muted-foreground hover:text-primary transition-colors">
              <Share className="w-4 h-4" />
            </button>
          </div>

          {/* Comments section */}
          {showComments && (
            <div className="mt-3 pt-3 border-t border-border space-y-3">
              <div className="flex gap-2">
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitComment()}
                  placeholder="Escreva um comentário..."
                  className="flex-1 bg-secondary rounded-full px-4 py-2 text-xs outline-none"
                />
              </div>
              {comments.map((c) => (
                <div key={c.id} className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold shrink-0">
                    {c.author_name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold">{c.author_name}</span>
                      <span className="text-[10px] text-muted-foreground">{moment(c.created_date).fromNow()}</span>
                    </div>
                    <p className="text-xs mt-0.5">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}