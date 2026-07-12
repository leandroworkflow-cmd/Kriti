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
      myReactions.forEach(r => { reactionMap[r.post_id] = r; });
      setReactions(reactionMap);

      // Busca cada post salvo individualmente (mantendo a ordem de quando foi salvo)
      const savedPosts = await Promise.all(
        myBookmarks.map(b => db.entities.Post.get(b.post_id).catch(() => null))
      );

      setPosts(
        savedPosts
          .filter(Boolean)
          .map(p => ({ ...p, _reaction: reactionMap[p.id]?.reaction_type || null, _bookmarked: true }))
      );
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleReact = async (postId, type) => {
    try {
      const me = await db.auth.me();
      const post = posts.find(p => p.id === postId);
      const existing = reactions[postId];

      if (existing && existing.reaction_type === type) {
        await db.entities.PostReaction.delete(existing.id);
        await db.entities.Post.update(postId, { [`${type}_count`]: Math.max(0, (post[`${type}_count`] || 1) - 1) });
        setReactions(prev => { const n = { ...prev }; delete n[postId]; return n; });
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, [`${type}_count`]: Math.max(0, (p[`${type}_count`] || 1) - 1), _reaction: null } : p));
      } else if (existing) {
        await db.entities.PostReaction.update(existing.id, { reaction_type: type });
        await db.entities.Post.update(postId, {
          [`${existing.reaction_type}_count`]: Math.max(0, (post[`${existing.reaction_type}_count`] || 1) - 1),
          [`${type}_count`]: (post[`${type}_count`] || 0) + 1,
        });
        setReactions(prev => ({ ...prev, [postId]: { ...existing, reaction_type: type } }));
        setPosts(prev => prev.map(p => p.id === postId ? {
          ...p,
          [`${existing.reaction_type}_count`]: Math.max(0, (p[`${existing.reaction_type}_count`] || 1) - 1),
          [`${type}_count`]: (p[`${type}_count`] || 0) + 1,
          _reaction: type,
        } : p));
      } else {
        const newReaction = await db.entities.PostReaction.create({ post_id: postId, user_id: me.id, reaction_type: type });
        await db.entities.Post.update(postId, { [`${type}_count`]: (post[`${type}_count`] || 0) + 1 });
        setReactions(prev => ({ ...prev, [postId]: newReaction }));
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, [`${type}_count`]: (p[`${type}_count`] || 0) + 1, _reaction: type } : p));
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
