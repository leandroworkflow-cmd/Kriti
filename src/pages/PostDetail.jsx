import { db } from "@/lib/db";
import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, ArrowLeft } from "lucide-react";
import PostCard from "@/components/post/PostCard";

export default function PostDetail() {
  const { postId } = useParams();
  const [post, setPost] = useState(null);
  const [reactions, setReactions] = useState({});
  const [bookmarked, setBookmarked] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const REACTION_COUNT_COLUMN = {
    pensou: "count_pensou",
    aprendi: "count_aprendi",
    fundamentado: "count_fundamentado",
    original: "count_original",
  };

  const loadData = useCallback(async () => {
    try {
      const me = await db.auth.me();
      setCurrentUserId(me.id);

      const fetchedPost = await db.entities.Post.get(postId);
      const myReactions = await db.entities.PostReaction.filter({ user_id: me.id, post_id: postId });
      const reactionMap = {};
      myReactions.forEach(r => { reactionMap[r.reaction_type] = r.id; });
      setReactions(reactionMap);

      const myBookmarks = await db.entities.PostBookmark.filter({ user_id: me.id, post_id: postId });
      setBookmarked(myBookmarks.length > 0);

      setPost({ ...fetchedPost, _myReactions: reactionMap, _bookmarked: myBookmarks.length > 0 });
    } catch (e) {
      console.error(e);
      setNotFound(true);
    }
    setLoading(false);
  }, [postId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleReact = async (id, reactionType) => {
    try {
      const me = await db.auth.me();
      const countColumn = REACTION_COUNT_COLUMN[reactionType];
      const existingId = reactions[reactionType];

      if (existingId) {
        await db.entities.PostReaction.delete(existingId);
        await db.entities.Post.update(id, { [countColumn]: Math.max(0, (post[countColumn] || 1) - 1) });
        setReactions(prev => ({ ...prev, [reactionType]: undefined }));
        setPost(prev => ({ ...prev, [countColumn]: Math.max(0, (prev[countColumn] || 1) - 1), _myReactions: { ...prev._myReactions, [reactionType]: false } }));
      } else {
        const reaction = await db.entities.PostReaction.create({ post_id: id, user_id: me.id, reaction_type: reactionType });
        await db.entities.Post.update(id, { [countColumn]: (post[countColumn] || 0) + 1 });
        setReactions(prev => ({ ...prev, [reactionType]: reaction.id }));
        setPost(prev => ({ ...prev, [countColumn]: (prev[countColumn] || 0) + 1, _myReactions: { ...prev._myReactions, [reactionType]: true } }));
      }
    } catch (e) { console.error(e); }
  };

  const handleBookmark = async (id) => {
    try {
      const me = await db.auth.me();
      if (bookmarked) {
        const existing = await db.entities.PostBookmark.filter({ user_id: me.id, post_id: id });
        if (existing[0]) await db.entities.PostBookmark.delete(existing[0].id);
        setBookmarked(false);
        setPost(prev => ({ ...prev, _bookmarked: false }));
      } else {
        await db.entities.PostBookmark.create({ post_id: id, user_id: me.id });
        setBookmarked(true);
        setPost(prev => ({ ...prev, _bookmarked: true }));
      }
    } catch (e) { console.error(e); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-4 text-center">
        <p className="text-muted-foreground text-sm">Esse post não existe ou foi removido.</p>
        <Link to="/" className="text-primary text-sm hover:underline">Voltar para o feed</Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 p-4 border-b border-border sticky top-0 bg-background/80 backdrop-blur z-10">
        <Link to="/" className="p-1 hover:bg-secondary rounded-full">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <span className="text-sm font-semibold">Post</span>
      </div>
      <PostCard
        post={post}
        currentUserId={currentUserId}
        onReact={handleReact}
        onBookmark={handleBookmark}
      />
    </div>
  );
}
