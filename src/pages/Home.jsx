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
  const [reactions, setReactions] = useState({});
  const [bookmarks, setBookmarks] = useState({});
  const [provocation, setProvocation] = useState(null);
  const [feedMode, setFeedMode] = useState("recent"); // "recent" | "trending"

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
        : await db.entities.Post.filter({ forum_category: "general" }, "-created_date", 50);

      const myReactions = await db.entities.PostReaction.filter({ user_id: me.id });
      const reactionMap = {}; // { postId: { pensou: reactionId, aprendi: reactionId, ... } }
      myReactions.forEach(r => {
        if (!reactionMap[r.post_id]) reactionMap[r.post_id] = {};
        reactionMap[r.post_id][r.reaction_type] = r.id;
      });
      setReactions(reactionMap);

      const myBookmarks = await db.entities.PostBookmark.filter({ user_id: me.id });
      const bookmarkMap = {};
      myBookmarks.forEach(b => { bookmarkMap[b.post_id] = b.id; });
      setBookmarks(bookmarkMap);

      const provocationPosts = await db.entities.Post.filter({ is_provocation: true }, "-created_date", 1);
      const todaysProvocation = provocationPosts[0] || null;
      setProvocation(todaysProvocation
        ? { ...todaysProvocation, _myReactions: reactionMap[todaysProvocation.id] || {}, _bookmarked: !!bookmarkMap[todaysProvocation.id] }
        : null);

      const feedPosts = allPosts.filter(p => !p.is_provocation);
      setPosts(feedPosts.map(p => ({ ...p, _myReactions: reactionMap[p.id] || {}, _bookmarked: !!bookmarkMap[p.id] })));
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [feedMode]);

  useEffect(() => { setLoading(true); loadData(); }, [loadData]);

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
      const isProvocation = provocation?.id === postId;
      const post = isProvocation ? provocation : posts.find(p => p.id === postId);
      const existingId = reactions[postId]?.[reactionType];

      if (existingId) {
        await db.entities.PostReaction.delete(existingId);
        await db.entities.Post.update(postId, { [countColumn]: Math.max(0, (post[countColumn] || 1) - 1) });
        setReactions(prev => ({ ...prev, [postId]: { ...prev[postId], [reactionType]: undefined } }));
        if (isProvocation) {
          setProvocation(prev => ({ ...prev, [countColumn]: Math.max(0, (prev[countColumn] || 1) - 1), _myReactions: { ...prev._myReactions, [reactionType]: false } }));
        } else {
          setPosts(prev => prev.map(p => p.id === postId
            ? { ...p, [countColumn]: Math.max(0, (p[countColumn] || 1) - 1), _myReactions: { ...p._myReactions, [reactionType]: false } }
            : p));
        }
      } else {
        const reaction = await db.entities.PostReaction.create({ post_id: postId, user_id: me.id, reaction_type: reactionType });
        await db.entities.Post.update(postId, { [countColumn]: (post[countColumn] || 0) + 1 });
        setReactions(prev => ({ ...prev, [postId]: { ...prev[postId], [reactionType]: reaction.id } }));
        if (isProvocation) {
          setProvocation(prev => ({ ...prev, [countColumn]: (prev[countColumn] || 0) + 1, _myReactions: { ...prev._myReactions, [reactionType]: true } }));
        } else {
          setPosts(prev => prev.map(p => p.id === postId
            ? { ...p, [countColumn]: (p[countColumn] || 0) + 1, _myReactions: { ...p._myReactions, [reactionType]: true } }
            : p));
        }
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
      if (bookmarks[postId]) {
        await db.entities.PostBookmark.delete(bookmarks[postId]);
        setBookmarks(prev => { const n = { ...prev }; delete n[postId]; return n; });
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, _bookmarked: false } : p));
      } else {
        const bookmark = await db.entities.PostBookmark.create({ post_id: postId, user_id: me.id });
        setBookmarks(prev => ({ ...prev, [postId]: bookmark.id }));
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, _bookmarked: true } : p));
      }
    } catch (e) { console.error(e); }
  };

  const createRepost = async (originalPost, quoteContent = "") => {
    try {
      const me = await db.auth.me();
      const profiles = await db.entities.UserProfile.filter({ user_id: me.id });
      const p = profiles[0];

      // Se o post original já é um repost, aponta pro post original de verdade
      // (evita "repost de repost" aninhado)
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
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-lg border-b border-border px-4 py-3">
        <h2 className="font-display text-xl font-bold mb-3">Feed</h2>
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
        <div className="border-2 border-purple-500/40 rounded-xl mx-4 mt-2 mb-1 overflow-hidden">
          <div className="flex items-center gap-1.5 px-4 pt-3 text-xs font-semibold text-purple-400">
            <span>⚡</span> Provocação do dia
          </div>
          <PostCard
            post={provocation}
            currentUserId={profile?.user_id}
            onReact={handleReact}
            onComment={loadData}
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
            onComment={loadData}
            onBookmark={handleBookmark}
            onRepost={handleRepost}
            onQuote={handleQuote}
          />
        ))
      )}
    </div>
  );
}
