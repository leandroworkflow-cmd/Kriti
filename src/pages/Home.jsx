import { db } from "@/lib/db";
import React, { useState, useEffect, useCallback } from "react";

import PostComposer from "@/components/post/PostComposer";
import PostCard from "@/components/post/PostCard";
import { Loader2, Sparkles } from "lucide-react";
import moment from "moment";
moment.locale("pt-br");

export default function Home() {
  const [posts, setPosts] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reactions, setReactions] = useState({});
  const [bookmarks, setBookmarks] = useState({});
  const [provocation, setProvocation] = useState(null);
  const [feedMode, setFeedMode] = useState("recent"); // "recent" | "trending"
  const [stats, setStats] = useState({ novasIdeias: 0, debatesAtivos: 0 });

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

      const allPosts = feedMode === "trending"
        ? await db.rpc("get_trending_posts", { days_back: 3, max_results: 50 })
        : await db.entities.Post.list("-created_date", 50);

      const myReactions = await db.entities.PostReaction.filter({ user_id: me.id });
      const reactionMap = {};
      myReactions.forEach(r => { reactionMap[r.post_id] = r; });
      setReactions(reactionMap);

      const myBookmarks = await db.entities.PostBookmark.filter({ user_id: me.id });
      const bookmarkMap = {};
      myBookmarks.forEach(b => { bookmarkMap[b.post_id] = b.id; });
      setBookmarks(bookmarkMap);

      // Provocação do dia: gerada por IA e guardada como um post especial (is_provocation)
      const provocationPosts = await db.entities.Post.filter({ is_provocation: true }, "-created_date", 1);
      const todaysProvocation = provocationPosts[0] || null;
      setProvocation(todaysProvocation
        ? { ...todaysProvocation, _reaction: reactionMap[todaysProvocation.id]?.reaction_type || null, _bookmarked: !!bookmarkMap[todaysProvocation.id] }
        : null);

      const feedPosts = allPosts.filter(p => !p.is_provocation);
      setPosts(feedPosts.map(p => ({
        ...p,
        _reaction: reactionMap[p.id]?.reaction_type || null,
        _bookmarked: !!bookmarkMap[p.id],
      })));

      // Estatísticas simples do dia
      const startOfDay = moment().startOf("day");
      const novasIdeias = feedPosts.filter(p => moment(p.created_date).isSameOrAfter(startOfDay)).length;
      const threads = await db.entities.ForumThread.list("-created_date", 100);
      const debatesAtivos = threads.filter(t => moment(t.created_date).isAfter(moment().subtract(7, "days"))).length;
      setStats({ novasIdeias, debatesAtivos });
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [feedMode]);

  useEffect(() => { setLoading(true); loadData(); }, [loadData]);

  const handleReact = async (postId, type) => {
    try {
      const me = await db.auth.me();
      const isProvocation = provocation?.id === postId;
      const post = isProvocation ? provocation : posts.find(p => p.id === postId);
      const existing = reactions[postId];

      const applyLocal = (updater) => {
        if (isProvocation) setProvocation(prev => updater(prev));
        else setPosts(prev => prev.map(p => p.id === postId ? updater(p) : p));
      };

      if (existing && existing.reaction_type === type) {
        await db.entities.PostReaction.delete(existing.id);
        await db.entities.Post.update(postId, { [`${type}_count`]: Math.max(0, (post[`${type}_count`] || 1) - 1) });
        setReactions(prev => { const n = { ...prev }; delete n[postId]; return n; });
        applyLocal(p => ({ ...p, [`${type}_count`]: Math.max(0, (p[`${type}_count`] || 1) - 1), _reaction: null }));
      } else if (existing) {
        await db.entities.PostReaction.update(existing.id, { reaction_type: type });
        await db.entities.Post.update(postId, {
          [`${existing.reaction_type}_count`]: Math.max(0, (post[`${existing.reaction_type}_count`] || 1) - 1),
          [`${type}_count`]: (post[`${type}_count`] || 0) + 1,
        });
        setReactions(prev => ({ ...prev, [postId]: { ...existing, reaction_type: type } }));
        applyLocal(p => ({
          ...p,
          [`${existing.reaction_type}_count`]: Math.max(0, (p[`${existing.reaction_type}_count`] || 1) - 1),
          [`${type}_count`]: (p[`${type}_count`] || 0) + 1,
          _reaction: type,
        }));
      } else {
        const newReaction = await db.entities.PostReaction.create({ post_id: postId, user_id: me.id, reaction_type: type });
        await db.entities.Post.update(postId, { [`${type}_count`]: (post[`${type}_count`] || 0) + 1 });
        setReactions(prev => ({ ...prev, [postId]: newReaction }));
        applyLocal(p => ({ ...p, [`${type}_count`]: (p[`${type}_count`] || 0) + 1, _reaction: type }));
      }
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (postId) => {
    try {
      await db.entities.Post.delete(postId);
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch (e) { console.error(e); }
  };

  const handleBookmark = async (postId) => {
    try {
      const me = await db.auth.me();
      const isProvocation = provocation?.id === postId;
      if (bookmarks[postId]) {
        await db.entities.PostBookmark.delete(bookmarks[postId]);
        setBookmarks(prev => { const n = { ...prev }; delete n[postId]; return n; });
        if (isProvocation) setProvocation(prev => ({ ...prev, _bookmarked: false }));
        else setPosts(prev => prev.map(p => p.id === postId ? { ...p, _bookmarked: false } : p));
      } else {
        const bookmark = await db.entities.PostBookmark.create({ post_id: postId, user_id: me.id });
        setBookmarks(prev => ({ ...prev, [postId]: bookmark.id }));
        if (isProvocation) setProvocation(prev => ({ ...prev, _bookmarked: true }));
        else setPosts(prev => prev.map(p => p.id === postId ? { ...p, _bookmarked: true } : p));
      }
    } catch (e) { console.error(e); }
  };

  const createRepost = async (originalPost, quoteContent = "") => {
    try {
      const me = await db.auth.me();
      const profiles = await db.entities.UserProfile.filter({ user_id: me.id });
      const p = profiles[0];

      const sourcePost = originalPost.is_repost
        ? {
            id: originalPost.original_post_id,
            author_name: originalPost.original_author_name,
            author_username: originalPost.original_author_username,
            author_avatar: originalPost.original_author_avatar,
            content: originalPost.original_content,
            image_url: originalPost.original_image_url,
          }
        : originalPost;

      await db.entities.Post.create({
        author_id: me.id,
        author_name: p?.display_name || me.full_name,
        author_username: p?.username || "user",
        author_avatar: p?.avatar_url || "",
        content: quoteContent,
        is_repost: true,
        original_post_id: sourcePost.id,
        original_author_name: sourcePost.author_name,
        original_author_username: sourcePost.author_username,
        original_author_avatar: sourcePost.author_avatar,
        original_content: sourcePost.content,
        original_image_url: sourcePost.image_url,
        forum_category: "general",
      });

      await db.entities.Post.update(sourcePost.id, {
        reposts_count: (originalPost.is_repost ? 0 : originalPost.reposts_count || 0) + 1
      }).catch(() => {});

      loadData();
    } catch (e) { console.error(e); }
  };

  const handleRepost = (post) => createRepost(post, "");
  const handleQuote = (post, text) => createRepost(post, text);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-lg border-b border-border px-6 py-4">
        <div className="flex items-center gap-6 text-xs text-muted-foreground mb-4">
          <span><strong className="text-foreground">{stats.novasIdeias}</strong> novas ideias hoje</span>
          <span><strong className="text-foreground">{stats.debatesAtivos}</strong> debates ativos</span>
        </div>

        <div className="flex gap-1 bg-secondary rounded-full p-1 w-fit">
          <button
            onClick={() => setFeedMode("recent")}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
              feedMode === "recent" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Recentes
          </button>
          <button
            onClick={() => setFeedMode("trending")}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
              feedMode === "trending" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Em Alta
          </button>
        </div>
      </div>

      <PostComposer profile={profile} onPosted={loadData} />

      {provocation && (
        <div className="border-2 border-purple-500/40 rounded-2xl mx-6 mt-4 mb-2 overflow-hidden">
          <div className="flex items-center gap-1.5 px-4 pt-3 text-xs font-semibold text-purple-400">
            <Sparkles className="w-3.5 h-3.5" /> Provocação do dia
          </div>
          <PostCard
            post={provocation}
            currentUserId={profile?.user_id}
            onReact={handleReact}
            onBookmark={handleBookmark}
            onRepost={handleRepost}
            onQuote={handleQuote}
          />
        </div>
      )}

      {posts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">
            {feedMode === "trending" ? "Nada em alta nos últimos dias" : "Nenhuma publicação ainda"}
          </p>
          <p className="text-sm mt-1">
            {feedMode === "trending" ? "Volte quando houver mais discussões acontecendo." : "Seja o primeiro a compartilhar uma ideia!"}
          </p>
        </div>
      ) : (
        posts.map(post => (
          <PostCard
            key={post.id}
            post={post.author_id === profile?.user_id ? { ...post, author_avatar: profile?.avatar_url || post.author_avatar } : post}
            currentUserId={profile?.user_id}
            onReact={handleReact}
            onDelete={handleDelete}
            onBookmark={handleBookmark}
            onRepost={handleRepost}
            onQuote={handleQuote}
          />
        ))
      )}
    </div>
  );
}
