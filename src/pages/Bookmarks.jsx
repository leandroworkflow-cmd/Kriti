import { db } from "@/lib/db";
import React, { useState, useEffect, useCallback } from "react";

import PostCard from "@/components/post/PostCard";
import { Loader2, Bookmark } from "lucide-react";

export default function Bookmarks() {
  const [posts, setPosts] = useState([]);
  const [profile, setProfile] = useState(null);
  const [reactions, setReactions] = useState({});
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const me = await db.auth.me();
      const profiles = await db.entities.UserProfile.filter({ user_id: me.id });
      setProfile(profiles[0] || null);

      const myBookmarks = await db.entities.PostBookmark.filter({ user_id: me.id }, "-created_date", 100);
      const bookmarkMap = {};
      myBookmarks.forEach(b => { bookmarkMap[b.post_id] = b.id; });

      const myReactions = await db.entities.PostReaction.filter({ user_id: me.id });
      const reactionMap = {};
      myReactions.forEach(r => {
        if (!reactionMap[r.post_id]) reactionMap[r.post_id] = {};
        reactionMap[r.post_id][r.reaction_type] = r.id;
      });
      setReactions(reactionMap);

      // Busca cada post salvo individualmente (mantendo a ordem de quando foi salvo)
      const savedPosts = await Promise.all(
        myBookmarks.map(b => db.entities.Post.get(b.post_id).catch(() => null))
      );

      setPosts(
        savedPosts
          .filter(Boolean)
          .map(p => ({ ...p, _myReactions: reactionMap[p.id] || {}, _bookmarked: true }))
      );
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Coluna de contagem correspondente a cada tipo de reação
  const REACTION_COUNT_COLUMN = {
    pensou: "count_pensou",
    aprendi: "count_aprendi",
    fundamentado: "count_fundamentado",
    original: "count_original",
  };

  const handleReact = async (postId, reactionType) => {
    try {
      const me = await db.auth.me();
      const countColumn = REACTION_COUNT_COLUMN[reactionType];
      const post = posts.find(p => p.id === postId);
      const existingId = reactions[postId]?.[reactionType];

      if (existingId) {
        await db.entities.PostReaction.delete(existingId);
        await db.entities.Post.update(postId, { [countColumn]: Math.max(0, (post[countColumn] || 1) - 1) });
        setReactions(prev => ({ ...prev, [postId]: { ...prev[postId], [reactionType]: undefined } }));
        setPosts(prev => prev.map(p => p.id === postId
          ? { ...p, [countColumn]: Math.max(0, (p[countColumn] || 1) - 1), _myReactions: { ...p._myReactions, [reactionType]: false } }
          : p));
      } else {
        const reaction = await db.entities.PostReaction.create({ post_id: postId, user_id: me.id, reaction_type: reactionType });
        await db.entities.Post.update(postId, { [countColumn]: (post[countColumn] || 0) + 1 });
        setReactions(prev => ({ ...prev, [postId]: { ...prev[postId], [reactionType]: reaction.id } }));
        setPosts(prev => prev.map(p => p.id === postId
          ? { ...p, [countColumn]: (p[countColumn] || 0) + 1, _myReactions: { ...p._myReactions, [reactionType]: true } }
          : p));
      }
    } catch (e) { console.error(e); }
  };

  const handleBookmark = async (postId) => {
    try {
      const post = posts.find(p => p.id === postId);
      if (post?._bookmarked) {
        const bookmarks = await db.entities.PostBookmark.filter({ post_id: postId, user_id: profile?.user_id });
        if (bookmarks[0]) await db.entities.PostBookmark.delete(bookmarks[0].id);
        setPosts(prev => prev.filter(p => p.id !== postId));
      }
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (postId) => {
    try {
      await db.entities.Post.delete(postId);
      setPosts(prev => prev.filter(p => p.id !== postId));
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
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-lg border-b border-border px-4 py-3">
        <h2 className="font-display text-xl font-bold">Salvos</h2>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Bookmark className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium">Nenhum post salvo ainda</p>
          <p className="text-sm mt-1">Toque no ícone de marcador em qualquer post para guardá-lo aqui.</p>
        </div>
      ) : (
        posts.map(post => (
          <PostCard
            key={post.id}
            post={post}
            currentUserId={profile?.user_id}
            onReact={handleReact}
            onDelete={handleDelete}
            onComment={loadData}
            onBookmark={handleBookmark}
          />
        ))
      )}
    </div>
  );
}
