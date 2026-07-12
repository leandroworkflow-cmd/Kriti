import { db } from "@/lib/db";
import React, { useEffect } from "react";

import { MessageCircle, Repeat2, Share, MoreHorizontal, Trash2, Bookmark, Eye, Quote, Lightbulb, MessageSquareX, BookMarked, Facebook, Instagram, Link2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { Link } from "react-router-dom";
import moment from "moment";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CATEGORY_LABELS = {
  general: null,
  tecnologia: "Tecnologia",
  medicina: "Medicina",
  politica: "Política",
  arte: "Arte & Cultura",
  economia: "Economia",
};

// Marca esse post como "visto" uma vez por sessão do navegador
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

const REACTIONS = [
  { type: "insight", label: "Insight", Icon: Lightbulb, color: "text-amber-400" },
  { type: "discordo", label: "Discordo", Icon: MessageSquareX, color: "text-red-400" },
  { type: "aprendi", label: "Aprendi", Icon: BookMarked, color: "text-blue-400" },
];

export default function PostCard({ post, currentUserId, onReact, onDelete, onBookmark, onRepost, onQuote }) {
  useViewCounter(post);

  const categoryLabel = CATEGORY_LABELS[post.forum_category];
  const isTruncated = (post.content || "").length > 340;
  const previewText = isTruncated ? post.content.slice(0, 340).trim() + "…" : post.content;

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
    <div className="p-6 border-b border-border hover:bg-card/30 transition-colors">
      {post.is_repost && (
        <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
          <Repeat2 className="w-3.5 h-3.5" /> {post.author_name} repostou
        </p>
      )}

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {categoryLabel && (
            <span className="text-[11px] font-bold tracking-wide uppercase text-primary bg-primary/10 px-2.5 py-1 rounded-full">
              {categoryLabel}
            </span>
          )}
          <Link to={`/user/${post.author_id}`} className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-[11px] shrink-0 overflow-hidden">
              {post.author_avatar ? (
                <img src={post.author_avatar} alt={post.author_name} className="w-full h-full object-cover" />
              ) : (
                post.author_name?.[0]?.toUpperCase() || "?"
              )}
            </div>
            <span className="font-semibold text-sm group-hover:underline">{post.author_name}</span>
          </Link>
          <span className="text-muted-foreground text-xs">· {moment(post.created_date).fromNow()}</span>
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

      <Link to={`/post/${post.id}`} className="block group">
        {post.title && (
          <h3 className="font-display text-xl font-bold mb-2 group-hover:text-primary transition-colors">
            {post.title}
          </h3>
        )}
        {previewText && (
          <p className="text-[15px] leading-[1.8] whitespace-pre-wrap break-words text-foreground/90">
            {previewText}
          </p>
        )}
        {isTruncated && (
          <span className="inline-block mt-2 text-sm text-primary font-medium">Continuar lendo →</span>
        )}
      </Link>

      {post.is_repost ? (
        <div className="mt-4 p-4 rounded-2xl border border-border">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-[10px] shrink-0 overflow-hidden">
              {post.original_author_avatar ? (
                <img src={post.original_author_avatar} alt={post.original_author_name} className="w-full h-full object-cover" />
              ) : (
                post.original_author_name?.[0]?.toUpperCase() || "?"
              )}
            </div>
            <span className="text-xs font-semibold">{post.original_author_name}</span>
          </div>
          {post.original_content && (
            <p className="text-sm whitespace-pre-wrap break-words">{post.original_content}</p>
          )}
          {post.original_image_url && (
            <img src={post.original_image_url} alt="" className="mt-2 rounded-lg max-h-60 w-full object-cover border border-border" />
          )}
        </div>
      ) : (
        post.image_url && (
          <img src={post.image_url} alt="" className="mt-4 rounded-2xl max-h-96 w-full object-cover border border-border" />
        )
      )}

      {/* Reações */}
      <div className="flex items-center flex-wrap gap-2 mt-5">
        {REACTIONS.map(({ type, label, Icon, color }) => {
          const active = post._reaction === type;
          const count = post[`${type}_count`] || 0;
          return (
            <button
              key={type}
              onClick={() => onReact?.(post.id, type)}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                active
                  ? `border-transparent bg-secondary ${color}`
                  : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {count > 0 && <span className="opacity-70">{count}</span>}
            </button>
          );
        })}

        <button
          onClick={() => onBookmark?.(post.id)}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
            post._bookmarked
              ? "border-transparent bg-secondary text-amber-400"
              : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
          }`}
        >
          <Bookmark className={`w-3.5 h-3.5 ${post._bookmarked ? "fill-current" : ""}`} />
          Favoritar
        </button>

        <div className="flex items-center gap-3 ml-auto text-muted-foreground">
          <Link to={`/post/${post.id}`} className="flex items-center gap-1 text-xs hover:text-blue-400 transition-colors">
            <MessageCircle className="w-4 h-4" />
            {post.comments_count || 0}
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 text-xs hover:text-green-400 transition-colors">
                <Repeat2 className="w-4 h-4" />
                {post.reposts_count || 0}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onRepost?.(post)}>
                <Repeat2 className="w-4 h-4 mr-2" /> Repostar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onQuote?.(post, "")}>
                <Quote className="w-4 h-4 mr-2" /> Citar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="hover:text-primary transition-colors">
                <Share className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
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

          <span className="flex items-center gap-1 text-xs">
            <Eye className="w-3.5 h-3.5" />
            {post.views_count || 0}
          </span>
        </div>
      </div>
    </div>
  );
}
