const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from "react";

import { Search, Loader2, Users } from "lucide-react";
import { Link } from "react-router-dom";

export default function Explore() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [trendingPosts, setTrendingPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const posts = await db.entities.Post.list("-likes_count", 10);
        setTrendingPosts(posts);
        const profiles = await db.entities.UserProfile.filter({ test_passed: true }, "-iq_score", 20);
        setUsers(profiles);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, []);

  const filteredUsers = query
    ? users.filter(u =>
        u.display_name?.toLowerCase().includes(query.toLowerCase()) ||
        u.username?.toLowerCase().includes(query.toLowerCase())
      )
    : users;

  return (
    <div>
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-lg border-b border-border px-4 py-3">
        <h2 className="font-display text-xl font-bold mb-3">Explorar</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar na Kriti..."
            className="w-full bg-secondary rounded-full pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : (
        <div>
          {/* Top Minds */}
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Mentes Brilhantes
            </h3>
            <div className="space-y-2">
              {filteredUsers.map((u) => (
                <Link
                  key={u.id}
                  to={`/user/${u.user_id}`}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                    {u.display_name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{u.display_name}</p>
                    <p className="text-xs text-muted-foreground">@{u.username}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-primary">QI {u.iq_score}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Trending */}
          <div className="p-4">
            <h3 className="font-semibold text-sm mb-3">🔥 Em alta</h3>
            <div className="space-y-3">
              {trendingPosts.map((post) => (
                <div key={post.id} className="p-3 rounded-xl bg-card border border-border">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold">{post.author_name}</span>
                    <span className="text-[10px] text-muted-foreground">@{post.author_username}</span>
                  </div>
                  <p className="text-sm line-clamp-2">{post.content}</p>
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                    <span>❤️ {post.likes_count || 0}</span>
                    <span>💬 {post.comments_count || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}