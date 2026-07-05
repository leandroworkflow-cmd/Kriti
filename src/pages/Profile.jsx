import { db } from "@/lib/db";
import React, { useState, useEffect } from "react";

import { Loader2, Edit2, Brain, Calendar, Check, Camera } from "lucide-react";
import PostCard from "@/components/post/PostCard";
import AvatarCropper from "@/components/profile/AvatarCropper";
import { Button } from "@/components/ui/button";
import moment from "moment";

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editBio, setEditBio] = useState("");
  const [editName, setEditName] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [cropFile, setCropFile] = useState(null);
  const [showCropper, setShowCropper] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const me = await db.auth.me();
        const profiles = await db.entities.UserProfile.filter({ user_id: me.id });
        if (profiles.length > 0) {
          setProfile(profiles[0]);
          setEditBio(profiles[0].bio || "");
          setEditName(profiles[0].display_name || "");
        }
        const userPosts = await db.entities.Post.filter({ author_id: me.id }, "-created_date", 30);
        setPosts(userPosts);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, []);

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setCropFile(file);
    setShowCropper(true);
  };

  const handleCroppedPhoto = async (croppedFile) => {
    setShowCropper(false);
    setCropFile(null);
    if (!profile) return;
    setUploadingPhoto(true);
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file: croppedFile });
      await db.entities.UserProfile.update(profile.id, { avatar_url: file_url });
      setProfile(prev => ({ ...prev, avatar_url: file_url }));
    } catch (err) { console.error(err); }
    setUploadingPhoto(false);
  };

  const handleCoverSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (!profile) return;
    setUploadingCover(true);
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      await db.entities.UserProfile.update(profile.id, { cover_url: file_url });
      setProfile(prev => ({ ...prev, cover_url: file_url }));
    } catch (err) { console.error(err); }
    setUploadingCover(false);
  };

  const saveProfile = async () => {
    try {
      await db.entities.UserProfile.update(profile.id, {
        display_name: editName.trim(),
        bio: editBio.trim()
      });
      setProfile(prev => ({ ...prev, display_name: editName.trim(), bio: editBio.trim() }));
      setEditing(false);
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (postId) => {
    await db.entities.Post.delete(postId);
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <label className="relative h-32 block cursor-pointer group/cover overflow-hidden bg-gradient-to-r from-purple-600/30 to-indigo-600/30">
        {profile?.cover_url && (
          <img src={profile.cover_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-black/0 group-hover/cover:bg-black/40 transition-colors flex items-center justify-center">
          {uploadingCover ? (
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          ) : (
            <Camera className="w-6 h-6 text-white opacity-0 group-hover/cover:opacity-100 transition-opacity" />
          )}
        </div>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleCoverSelect}
          disabled={uploadingCover}
        />
      </label>
      <div className="px-4 -mt-12">
        <div className="flex items-end justify-between">
          <div className="relative w-20 h-20 group">
            <div className="w-20 h-20 rounded-full border-4 border-background bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={profile?.display_name} className="w-full h-full object-cover" />
              ) : (
                profile?.display_name?.[0]?.toUpperCase() || "?"
              )}
            </div>
            <label className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary border-2 border-background flex items-center justify-center cursor-pointer hover:bg-primary/90 transition-colors">
              {uploadingPhoto ? (
                <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
              ) : (
                <Camera className="w-3.5 h-3.5 text-white" />
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoSelect}
                disabled={uploadingPhoto}
              />
            </label>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => editing ? saveProfile() : setEditing(true)}
            className="rounded-full"
          >
            {editing ? <><Check className="w-4 h-4 mr-1" /> Salvar</> : <><Edit2 className="w-4 h-4 mr-1" /> Editar</>}
          </Button>
        </div>

        <div className="mt-3">
          {editing ? (
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="bg-secondary rounded-lg px-3 py-1.5 text-lg font-bold outline-none w-full"
            />
          ) : (
            <h2 className="text-xl font-bold">{profile?.display_name}</h2>
          )}
          <p className="text-sm text-muted-foreground">@{profile?.username}</p>
        </div>

        {editing ? (
          <textarea
            value={editBio}
            onChange={(e) => setEditBio(e.target.value)}
            placeholder="Escreva algo sobre você..."
            className="mt-2 w-full bg-secondary rounded-lg px-3 py-2 text-sm outline-none resize-none"
            rows={3}
          />
        ) : (
          profile?.bio && <p className="text-sm mt-2">{profile.bio}</p>
        )}

        <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Brain className="w-4 h-4 text-primary" />
            QI {profile?.iq_score || "—"}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {moment(profile?.created_date).format("MMM YYYY")}
          </span>
        </div>

        <div className="flex gap-4 mt-3 text-sm pb-4 border-b border-border">
          <span><strong>{profile?.following_count || 0}</strong> <span className="text-muted-foreground">seguindo</span></span>
          <span><strong>{profile?.followers_count || 0}</strong> <span className="text-muted-foreground">seguidores</span></span>
        </div>
      </div>

      <AvatarCropper
        file={cropFile}
        open={showCropper}
        onClose={() => { setShowCropper(false); setCropFile(null); }}
        onCropped={handleCroppedPhoto}
      />

      {/* Posts */}
      {posts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Nenhuma publicação ainda
        </div>
      ) : (
        posts.map(post => (
          <PostCard
            key={post.id}
            post={post}
            currentUserId={profile?.user_id}
            onDelete={handleDelete}
          />
        ))
      )}
    </div>
  );
}