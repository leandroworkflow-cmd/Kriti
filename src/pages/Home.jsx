import { db } from "@/lib/db";
import React, { useState, useEffect, useCallback } from "react";

import PostComposer from "@/components/post/PostComposer";
import PostCard from "@/components/post/PostCard";
import { Loader2 } from "lucide-react";
import moment from "moment";
moment.locale("pt-br");

export default function Home() {
  const [posts, setPosts] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [likes, setLikes] = useState({});

  const loadData = useCallback(async () => {
    try {
      const me = await db.auth.me();
      const profiles = await db.entities.UserProfile.filter({ user_id: me.id });
      if (profiles.length > 0) {
        setProfile(profiles[0]);
      } else {
        const username = me.email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
        const newProfile = await db.entities.UserProfile.create({
          user_id: me.id,
          display_name: me.full_name || username,
          username,
          test_passed: me.role === "admin",
          iq_score: 0,
        });
        setProfile(newProfile);
      }

      const allPosts = await db.entities.Post.filter(
        { forum_category: "general" }, "-created_date", 50
      );
      
      const myLikes = await db.entities.PostLike.filter({ user_id: me.id });
      const likeMap = {};
      myLikes.forEach(l => { likeMap[l.post_id] = l.id; });
      setLikes(likeMap);
      
      setPosts(allPosts.map(p => ({ ...p, _liked: !!likeMap[p.id] })));
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
        <h2 className="font-display text-xl font-bold">Feed</h2>
      </div>

      <PostComposer profile={profile} onPosted={loadData} />

      {posts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">Nenhuma publicação ainda</p>
          <p className="text-sm mt-1">Seja o primeiro a compartilhar uma ideia!</p>
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
          />
        ))
      )}
    </div>
  );
}