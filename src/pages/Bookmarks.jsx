import { db } from "@/lib/db";
import React, { useState, useEffect, useCallback } from "react";

import PostCard from "@/components/post/PostCard";
import { Loader2, Bookmark } from "lucide-react";

export default function Bookmarks() {
  const [posts, setPosts] = useState([]);
  const [profile, setProfile] = useState(null);
  const [likes, setLikes] = useState({});
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const me = await db.auth.me();
      const profiles = await db.entities.UserProfile.filter({ user_id: me.id });
      setProfile(profiles[0] || null);

      const myBookmarks = await db.entities.PostBookmark.filter({ user_id: me.id }, "-created_date", 100);
      const bookmarkMap = {};
      myBookmarks.forEach(b => { bookmarkMap[b.post_id] = b.id; });

      const myLikes = await db.entities.PostLike.filter({ user_id: me.id });
      const likeMap = {};
      myLikes.forEach(l => { likeMap[l.post_id] = l.id; });
      setLikes(likeMap);

      // Busca cada post salvo individualmente (mantendo a ordem de quando foi salvo)
      const savedPosts = await Promise.all(
        myBookmarks.map(b => db.entities.Post.get(b.post_id).catch(() => null))
      );

      setPosts(
        savedPosts
          .filter(Boolean)
          .map(p => ({ ...p, _liked: !!likeMap[p.id], _bookmarked: true }))
      );
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleLike = async (postId) => {
    try {
      const me = await db.auth.me();
      if (likes[postId]) {
        await db.entities.PostLike.delete(likes[postId]);
        const post = posts.find(p => p.id === postId);
        await db.entities.Post.update(postId, { likes_count: Math.max(0, (post.likes_count || 1) - 1) });
        setLikes(prev => { const n = { ...prev }; delete n[postId]; return n; });
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes_count: Math.max(0, (p.likes_count || 1) - 1), _liked: false } : p));
      } else {
        const like = await db.entities.PostLike.create({ post_id: postId, user_id: me.id });
        const post = posts.find(p => p.id === postId);
        await db.entities.Post.update(postId, { likes_count: (post.likes_count || 0) + 1 });
        setLikes(prev => ({ ...prev, [postId]: like.id }));
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes_count: (p.likes_count || 0) + 1, _liked: true } : p));
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
            onLike={handleLike}
            onDelete={handleDelete}
            onComment={loadData}
            onBookmark={handleBookmark}
          />
        ))
      )}
    </div>
  );
}
