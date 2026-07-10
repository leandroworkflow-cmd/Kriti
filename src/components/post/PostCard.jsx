import { db } from "@/lib/db";
import React, { useState, useEffect, useMemo } from "react";

import { MessageCircle, Repeat2, Share, MoreHorizontal, Trash2, Bookmark, Eye, Quote, Facebook, Instagram, Link2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { Link } from "react-router-dom";
import moment from "moment";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Marca esse post como "visto" uma vez por sessão do navegador, evitando
// inflar o contador a cada re-render da lista.
function useViewCounter(post) {
  useEffect(() => {
    if (!post?.id) return;
    const key = `kriti_viewed_${post.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    db.entities.Post.update(post.id, { views_count: (post.views_count || 0) + 1 }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?.id]);
}

// Organiza a lista plana de comentários em árvore (comentários + respostas)
function buildCommentTree(flatComments) {
  const byId = {};
  flatComments.forEach((c) => { byId[c.id] = { ...c, replies: [] }; });
  const roots = [];
  flatComments.forEach((c) => {
    if (c.parent_comment_id && byId[c.parent_comment_id]) {
      byId[c.parent_comment_id].replies.push(byId[c.id]);
    } else {
      roots.push(byId[c.id]);
    }
  });
  return roots;
}

function CommentItem({ comment, onReply, replyingTo, replyText, setReplyText, submitReply, depth = 0 }) {
  return (
    <div className={depth > 0 ? "ml-8 mt-2" : ""}>
      <div className="flex gap-2">
        <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden">
          {comment.author_avatar ? (
            <img src={comment.author_avatar} alt={comment.author_name} className="w-full h-full object-cover" />
          ) : (
            comment.author_name?.[0]?.toUpperCase()
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold">{comment.author_name}</span>
            <span className="text-[10px] text-muted-foreground">{moment(comment.created_date).fromNow()}</span>
          </div>
          <p className="text-xs mt-0.5">{comment.content}</p>
          <button
            onClick={() => onReply(comment.id)}
            className="text-[10px] text-muted-foreground hover:text-primary mt-1"
          >
            Responder
          </button>

          {replyingTo === comment.id && (
            <div className="flex gap-2 mt-2">
              <input
                autoFocus
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitReply(comment.id)}
                placeholder={`Responder a ${comment.author_name}...`}
                className="flex-1 bg-secondary rounded-full px-3 py-1.5 text-xs outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {comment.replies?.map((reply) => (
        <CommentItem
          key={reply.id}
          comment={reply}
          onReply={onReply}
          replyingTo={replyingTo}
          replyText={replyText}
          setReplyText={setReplyText}
          submitReply={submitReply}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

export default function PostCard({ post, currentUserId, onReact, onDelete, onComment, onBookmark, onRepost, onQuote }) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [showQuoteBox, setShowQuoteBox] = useState(false);
  const [quoteText, setQuoteText] = useState("");

  useViewCounter(post);

  const commentTree = useMemo(() => buildCommentTree(comments), [comments]);

  const loadComments = async () => {
    if (showComments) {
      setShowComments(false);
      return;
    }
    setLoadingComments(true);
    try {
      const res = await db.entities.Comment.filter({ post_id: post.id }, "created_date", 100);
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
        author_avatar: p?.avatar_url || "",
        content: commentText.trim()
      });
      setComments(prev => [...prev, newComment]);
      setCommentText("");
      await db.entities.Post.update(post.id, { comments_count: (post.comments_count || 0) + 1 });
      onComment?.();
    } catch (e) { console.error(e); }
  };

  const submitReply = async (parentCommentId) => {
    if (!replyText.trim()) return;
    try {
      const me = await db.auth.me();
      const profiles = await db.entities.UserProfile.filter({ user_id: me.id });
      const p = profiles[0];
      const newReply = await db.entities.Comment.create({
        post_id: post.id,
        parent_comment_id: parentCommentId,
        author_id: me.id,
        author_name: p?.display_name || me.full_name,
        author_username: p?.username || "user",
        author_avatar: p?.avatar_url || "",
        content: replyText.trim()
      });
      setComments(prev => [...prev, newReply]);
      setReplyText("");
      setReplyingTo(null);
      await db.entities.Post.update(post.id, { comments_count: (post.comments_count || 0) + 1 });
      onComment?.();
    } catch (e) { console.error(e); }
  };

  const handleQuoteSubmit = () => {
    onQuote?.(post, quoteText.trim());
    setQuoteText("");
    setShowQuoteBox(false);
  };

  const postUrl = `${window.location.origin}/post/${post.id}`;

  const shareToFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`,
      "_blank",
      "width=600,height=500"
    );
  };

  // O Instagram não tem uma API pública de compartilhamento por URL (diferente
  // do Facebook). No celular, tentamos o menu nativo de compartilhar do
  // sistema (que já inclui o Instagram entre as opções); no desktop, copiamos
  // o link para o usuário colar manualmente.
  const shareToInstagram = async () => {
    const shareText = post.content ? `${post.content}\n\n${postUrl}` : postUrl;
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText, url: postUrl });
        return;
      } catch (e) {
        if (e?.name === "AbortError") return;
      }
    }
    await navigator.clipboard.writeText(shareText);
    toast({
      title: "Link copiado",
      description: "Abra o Instagram e cole no story ou na mensagem.",
    });
    window.open("https://www.instagram.com/", "_blank");
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(postUrl);
    toast({ title: "Link copiado", description: "O link do post foi copiado." });
  };

  return (
    <div className="p-4 border-b border-border hover:bg-card/50 transition-colors">
      {post.is_repost && (
        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1 ml-12">
          <Repeat2 className="w-3 h-3" /> {post.author_name} repostou
        </p>
      )}
      <div className="flex gap-3">
        <Link to={`/user/${post.author_id}`}>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden">
            {post.author_avatar ? (
              <img src={post.author_avatar} alt={post.author_name} className="w-full h-full object-cover" />
            ) : (
              post.author_name?.[0]?.toUpperCase() || "?"
            )}
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

          {post.content && (
            <p className="text-sm mt-1 whitespace-pre-wrap break-words">{post.content}</p>
          )}

          {post.is_repost ? (
            <div className="mt-2 p-3 rounded-xl border border-border">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-[10px] shrink-0 overflow-hidden">
                  {post.original_author_avatar ? (
                    <img src={post.original_author_avatar} alt={post.original_author_name} className="w-full h-full object-cover" />
                  ) : (
                    post.original_author_name?.[0]?.toUpperCase() || "?"
                  )}
                </div>
                <span className="text-xs font-semibold">{post.original_author_name}</span>
                {post.original_author_username && (
                  <span className="text-[10px] text-muted-foreground">@{post.original_author_username}</span>
                )}
              </div>
              {post.original_content && (
                <p className="text-xs whitespace-pre-wrap break-words">{post.original_content}</p>
              )}
              {post.original_image_url && (
                <img src={post.original_image_url} alt="" className="mt-2 rounded-lg max-h-60 w-full object-cover border border-border" />
              )}
            </div>
          ) : (
            post.image_url && (
              <img src={post.image_url} alt="" className="mt-3 rounded-xl max-h-80 w-full object-cover border border-border" />
            )
          )}

          {/* Actions */}
          <div className="flex items-center gap-5 mt-3">
            <button
              onClick={loadComments}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-blue-400 transition-colors text-xs"
            >
              <MessageCircle className="w-4 h-4" />
              {post.comments_count || 0}
            </button>
            <button
              onClick={() => onReact?.(post.id, "pensou")}
              title="Isso me fez pensar"
              className={`flex items-center gap-1 transition-colors text-xs ${
                post._myReactions?.pensou ? "text-indigo-400 font-semibold" : "text-muted-foreground hover:text-indigo-400"
              }`}
            >
              <span>🧠</span>
              {post.count_pensou || 0}
            </button>
            <button
              onClick={() => onReact?.(post.id, "aprendi")}
              title="Aprendi algo novo"
              className={`flex items-center gap-1 transition-colors text-xs ${
                post._myReactions?.aprendi ? "text-emerald-400 font-semibold" : "text-muted-foreground hover:text-emerald-400"
              }`}
            >
              <span>📚</span>
              {post.count_aprendi || 0}
            </button>
            <button
              onClick={() => onReact?.(post.id, "fundamentado")}
              title="Bem fundamentado"
              className={`flex items-center gap-1 transition-colors text-xs ${
                post._myReactions?.fundamentado ? "text-orange-400 font-semibold" : "text-muted-foreground hover:text-orange-400"
              }`}
            >
              <span>✔️</span>
              {post.count_fundamentado || 0}
            </button>
            <button
              onClick={() => onReact?.(post.id, "original")}
              title="Ideia original"
              className={`flex items-center gap-1 transition-colors text-xs ${
                post._myReactions?.original ? "text-pink-400 font-semibold" : "text-muted-foreground hover:text-pink-400"
              }`}
            >
              <span>💡</span>
              {post.count_original || 0}
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 text-muted-foreground hover:text-green-400 transition-colors text-xs">
                  <Repeat2 className="w-4 h-4" />
                  {post.reposts_count || 0}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => onRepost?.(post)}>
                  <Repeat2 className="w-4 h-4 mr-2" /> Repostar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowQuoteBox(true)}>
                  <Quote className="w-4 h-4 mr-2" /> Citar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              onClick={() => onBookmark?.(post.id)}
              className={`flex items-center gap-1.5 transition-colors text-xs ${
                post._bookmarked ? "text-amber-400" : "text-muted-foreground hover:text-amber-400"
              }`}
            >
              <Bookmark className={`w-4 h-4 ${post._bookmarked ? "fill-current" : ""}`} />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="text-muted-foreground hover:text-primary transition-colors">
                  <Share className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={shareToFacebook}>
                  <Facebook className="w-4 h-4 mr-2" /> Compartilhar no Facebook
                </DropdownMenuItem>
                <DropdownMenuItem onClick={shareToInstagram}>
                  <Instagram className="w-4 h-4 mr-2" /> Compartilhar no Instagram
                </DropdownMenuItem>
                <DropdownMenuItem onClick={copyLink}>
                  <Link2 className="w-4 h-4 mr-2" /> Copiar link
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <span className="flex items-center gap-1.5 text-muted-foreground text-xs ml-auto">
              <Eye className="w-3.5 h-3.5" />
              {post.views_count || 0}
            </span>
          </div>

          {/* Caixa de citação */}
          {showQuoteBox && (
            <div className="mt-3 pt-3 border-t border-border">
              <textarea
                autoFocus
                value={quoteText}
                onChange={(e) => setQuoteText(e.target.value)}
                placeholder="Adicione um comentário..."
                rows={2}
                className="w-full bg-secondary rounded-xl px-3 py-2 text-xs outline-none resize-none"
              />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={() => setShowQuoteBox(false)}
                  className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleQuoteSubmit}
                  className="text-xs bg-primary text-primary-foreground rounded-full px-4 py-1.5 font-medium"
                >
                  Citar
                </button>
              </div>
            </div>
          )}

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
              {loadingComments ? (
                <p className="text-xs text-muted-foreground">Carregando...</p>
              ) : (
                commentTree.map((c) => (
                  <CommentItem
                    key={c.id}
                    comment={c}
                    onReply={(id) => { setReplyingTo(id === replyingTo ? null : id); setReplyText(""); }}
                    replyingTo={replyingTo}
                    replyText={replyText}
                    setReplyText={setReplyText}
                    submitReply={submitReply}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
