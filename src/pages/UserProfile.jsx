const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from "react";

import { useParams } from "react-router-dom";
import { Loader2, Brain, Calendar, UserPlus, UserCheck } from "lucide-react";
import PostCard from "@/components/post/PostCard";
import { Button } from "@/components/ui/button";
import moment from "moment";

export default function UserProfilePage() {
  const { userId } = useParams();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followId, setFollowId] = useState(null);
  const [me, setMe] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const currentUser = await db.auth.me();
        setMe(currentUser);
        const profiles = await db.entities.UserProfile.filter({ user_id: userId });
        if (profiles.length > 0) setProfile(profiles[0]);
        const userPosts = await db.entities.Post.filter({ author_id: userId }, "-created_date", 30);
        setPosts(userPosts);
        const follows = await db.entities.Follow.filter({ follower_id: currentUser.id, following_id: userId });
        if (follows.length > 0) {
          setIsFollowing(true);
          setFollowId(follows[0].id);
        }
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, [userId]);

  const toggleFollow = async () => {
    if (isFollowing && followId) {
      await db.entities.Follow.delete(followId);
      setIsFollowing(false);
      setFollowId(null);
    } else {
      const f = await db.entities.Follow.create({ follower_id: me.id, following_id: userId });
      setIsFollowing(true);
      setFollowId(f.id);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>;
  }

  if (!profile) {
    return <div className="text-center py-16 text-muted-foreground">Perfil não encontrado</div>;
  }

  return (
    <div>
      <div className="h-32 bg-gradient-to-r from-purple-600/30 to-indigo-600/30" />
      <div className="px-4 -mt-12">
        <div className="flex items-end justify-between">
          <div className="w-20 h-20 rounded-full border-4 border-background bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold">
            {profile.display_name?.[0]?.toUpperCase()}
          </div>
          {me?.id !== userId && (
            <Button onClick={toggleFollow} variant={isFollowing ? "outline" : "default"} size="sm" className="rounded-full">
              {isFollowing ? <><UserCheck className="w-4 h-4 mr-1" /> Seguindo</> : <><UserPlus className="w-4 h-4 mr-1" /> Seguir</>}
            </Button>
          )}
        </div>
        <div className="mt-3">
          <h2 className="text-xl font-bold">{profile.display_name}</h2>
          <p className="text-sm text-muted-foreground">@{profile.username}</p>
        </div>
        {profile.bio && <p className="text-sm mt-2">{profile.bio}</p>}
        <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground pb-4 border-b border-border">
          <span className="flex items-center gap-1"><Brain className="w-4 h-4 text-primary" /> QI {profile.iq_score}</span>
          <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {moment(profile.created_date).format("MMM YYYY")}</span>
        </div>
      </div>
      {posts.map(post => (
        <PostCard key={post.id} post={post} currentUserId={me?.id} />
      ))}
    </div>
  );
}