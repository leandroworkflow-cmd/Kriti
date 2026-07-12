import { db } from "@/lib/db";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import moment from "moment";
import { ArrowLeft, Loader2, Lightbulb, MessageSquareX, BookMarked, Bookmark, Repeat2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

const CATEGORY_LABELS = {
  tecnologia: "Tecnologia",
  medicina: "Medicina",
  politica: "Política",
  arte: "Arte & Cultura",
  economia: "Economia",
};

const REACTIONS = [
  { type: "insight", label: "Insight", Icon: Lightbulb, color: "text-amber-400" },
  { type: "discordo", label: "Discordo", Icon: MessageSquareX, color: "text-red-400" },
  { type: "aprendi", label: "Aprendi", Icon: BookMarked, color: "text-blue-400" },
];

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
    <div className={depth > 0 ? "ml-8 mt-3" : "mt-4"}>
      <div className="flex gap-2.5">
        <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-[11px] font-bold shrink-0 overflow-hidden">
          {comment.author_avatar ? (
            <img src={comment.author_avatar} alt={comment.author_name} className="w-full h-full object-cover" />
          ) : (
            comment.author_name?.[0]?.toUpperCase()
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold">{comment.author_name}</span>
            <span className="text-xs text-muted-foreground">{moment(comment.created_date).fromNow()}</span>
          </div>
          <p className="text-sm mt-0.5 leading-relaxed">{comment.content}</p>
          <button onClick={() => onReply(comment.id)} className="text-xs text-muted-foreground hover:text-primary mt-1">
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
                className="flex-1 bg-secondary rounded-full px-3 py-1.5 text-sm outline-none"
              />
            </div>
          )}
        </div>
      </div>
      {comment.replies?.map((reply) => (
        <CommentItem key={reply.id} comment={reply} onReply={onReply} replyingTo={replyingTo} replyText={replyText} setReplyText={setReplyText} submitReply={submitReply} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function PostDetail() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [profile, setProfile] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [reaction, setReaction] = useState(null);
  const [bookmarked, setBookmarked] = useState(false);
  const [loading, setLoading] = useState(true);

  const commentTree = useMemo(() => buildCommentTree(comments), [comments]);

  const loadData = useCallback(async () => {
    try {
      const me = await db.auth.me();
      const profiles = await db.entities.UserProfile.filter({ user_id: me.id });
      setProfile(profiles[0] || null);

      const p = await db.entities.Post.get(postId);
      setPost(p);

      const myReactions = await db.entities.PostReaction.filter({ post_id: postId, user_id: me.id });
      setReaction(myReactions[0] || null);

      const myBookmarks = await db.entities.PostBookmark.filter({ post_id: postId, user_id: me.id });
      setBookmarked(myBookmarks.length > 0);

      const allComments = await db.entities.Comment.filter({ post_id: postId }, "created_date", 200);
      setComments(allComments);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [postId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleReact = async (type) => {
    if (!post) return;
    try {
      const me = await db.auth.me();
      if (reaction && reaction.reaction_type === type) {
        await db.entities.PostReaction.delete(reaction.id);
        await db.entities.Post.update(post.id, { [`${type}_count`]: Math.max(0, (post[`${type}_count`] || 1) - 1) });
        setReaction(null);
        setPost(prev => ({ ...prev, [`${type}_count`]: Math.max(0, (prev[`${type}_count`] || 1) - 1) }));
      } else if (reaction) {
        await db.entities.PostReaction.update(reaction.id, { reaction_type: type });
        await db.entities.Post.update(post.id, {
          [`${reaction.reaction_type}_count`]: Math.max(0, (post[`${reaction.reaction_type}_count`] || 1) - 1),
          [`${type}_count`]: (post[`${type}_count`] || 0) + 1,
        });
        setReaction(prev => ({ ...prev, reaction_type: type }));
        setPost(prev => ({
          ...prev,
          [`${reaction.reaction_type}_count`]: Math.max(0, (prev[`${reaction.reaction_type}_count`] || 1) - 1),
          [`${type}_count`]: (prev[`${type}_count`] || 0) + 1,
        }));
      } else {
        const newReaction = await db.entities.PostReaction.create({ post_id: post.id, user_id: me.id, reaction_type: type });
        await db.entities.Post.update(post.id, { [`${type}_count`]: (post[`${type}_count`] || 0) + 1 });
        setReaction(newReaction);
        setPost(prev => ({ ...prev, [`${type}_count`]: (prev[`${type}_count`] || 0) + 1 }));
      }
    } catch (e) { console.error(e); }
  };

  const handleBookmark = async () => {
    try {
      const me = await db.auth.me();
      if (bookmarked) {
        const existing = await db.entities.PostBookmark.filter({ post_id: post.id, user_id: me.id });
        if (existing[0]) await db.entities.PostBookmark.delete(existing[0].id);
        setBookmarked(false);
      } else {
        await db.entities.PostBookmark.create({ post_id: post.id, user_id: me.id });
        setBookmarked(true);
      }
    } catch (e) { console.error(e); }
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
        content: commentText.trim(),
      });
      setComments(prev => [...prev, newComment]);
      setCommentText("");
      await db.entities.Post.update(post.id, { comments_count: (post.comments_count || 0) + 1 });
      setPost(prev => ({ ...prev, comments_count: (prev.comments_count || 0) + 1 }));
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
        content: replyText.trim(),
      });
      setComments(prev => [...prev, newReply]);
      setReplyText("");
      setReplyingTo(null);
      await db.entities.Post.update(post.id, { comments_count: (post.comments_count || 0) + 1 });
      setPost(prev => ({ ...prev, comments_count: (prev.comments_count || 0) + 1 }));
    } catch (e) { console.error(e); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="text-center py-24 text-muted-foreground">
        Post não encontrado.
      </div>
    );
  }

  const categoryLabel = CATEGORY_LABELS[post.forum_category];

  return (
    <div>
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-lg border-b border-border px-6 py-3 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <button
          onClick={handleBookmark}
          className={`flex items-center gap-1.5 text-sm font-medium ${bookmarked ? "text-amber-400" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Bookmark className={`w-4 h-4 ${bookmarked ? "fill-current" : ""}`} /> Favoritar
        </button>
      </div>

      <div className="px-6 py-8 max-w-2xl mx-auto">
        {categoryLabel && (
          <span className="text-xs font-bold tracking-wide uppercase text-primary bg-primary/10 px-2.5 py-1 rounded-full">
            {categoryLabel}
          </span>
        )}

        {post.title && (
          <h1 className="font-display text-3xl font-bold mt-4 mb-3 leading-tight">{post.title}</h1>
        )}

        <Link to={`/user/${post.author_id}`} className="flex items-center gap-2.5 mt-4 mb-6">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0 overflow-hidden">
            {post.author_avatar ? (
              <img src={post.author_avatar} alt={post.author_name} className="w-full h-full object-cover" />
            ) : (
              post.author_name?.[0]?.toUpperCase() || "?"
            )}
          </div>
          <div>
            <p className="text-sm font-semibold hover:underline">{post.author_name}</p>
            <p className="text-xs text-muted-foreground">{moment(post.created_date).format("D [de] MMMM [de] YYYY")}</p>
          </div>
        </Link>

        <div className="text-[17px] leading-[1.9] whitespace-pre-wrap break-words text-foreground/90">
          {post.content}
        </div>

        {post.image_url && (
          <img src={post.image_url} alt="" className="mt-6 rounded-2xl w-full object-cover border border-border" />
        )}

        {/* Reações */}
        <div className="flex items-center flex-wrap gap-2 mt-8 pt-6 border-t border-border">
          {REACTIONS.map(({ type, label, Icon, color }) => {
            const active = reaction?.reaction_type === type;
            const count = post[`${type}_count`] || 0;
            return (
              <button
                key={type}
                onClick={() => handleReact(type)}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                  active ? `border-transparent bg-secondary ${color}` : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                {count > 0 && <span className="opacity-70">{count}</span>}
              </button>
            );
          })}
          <span className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
            <Eye className="w-3.5 h-3.5" /> {post.views_count || 0}
          </span>
        </div>

        {/* Discussão */}
        <div className="mt-8 pt-6 border-t border-border">
          <h3 className="font-display text-lg font-bold mb-4">Discussão ({post.comments_count || 0})</h3>
          <div className="flex gap-2 mb-2">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitComment()}
              placeholder="Contribua com a discussão..."
              className="flex-1 bg-secondary rounded-full px-4 py-2.5 text-sm outline-none"
            />
            <Button onClick={submitComment} size="sm">Enviar</Button>
          </div>

          {commentTree.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              onReply={(id) => { setReplyingTo(id === replyingTo ? null : id); setReplyText(""); }}
              replyingTo={replyingTo}
              replyText={replyText}
              setReplyText={setReplyText}
              submitReply={submitReply}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
