import { db } from "@/lib/db";
import React, { useState, useEffect } from "react";

import { Loader2, Edit2, Brain, Calendar, Check, Camera, ShieldAlert, Trash2, X, BadgeCheck, Trophy, Flame, MessagesSquare, Heart, Repeat2 } from "lucide-react";
import PostCard from "@/components/post/PostCard";
import AvatarCropper from "@/components/profile/AvatarCropper";
import { Button } from "@/components/ui/button";
import moment from "moment";

const ACHIEVEMENTS = [
  { id: "primeira_ideia", label: "Primeira Ideia", Icon: Flame, check: ({ posts }) => posts.length >= 1 },
  { id: "voz_ativa", label: "Voz Ativa (10+ posts)", Icon: Trophy, check: ({ posts }) => posts.length >= 10 },
  { id: "debatedor", label: "Debatedor (5+ participações em fóruns)", Icon: MessagesSquare, check: ({ debatesCount }) => debatesCount >= 5 },
  { id: "bem_recebido", label: "Bem Recebido (10+ reações recebidas)", Icon: Heart, check: ({ reputationScore }) => reputationScore >= 10 },
  { id: "influente", label: "Influente (posts repostados)", Icon: Repeat2, check: ({ posts }) => posts.some(p => (p.reposts_count || 0) > 0) },
  { id: "qi_elevado", label: "QI Elevado (130+)", Icon: Brain, check: ({ iqScore }) => iqScore >= 130 },
];

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editBio, setEditBio] = useState("");
  const [editName, setEditName] = useState("");
  const [editInterests, setEditInterests] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [cropFile, setCropFile] = useState(null);
  const [showCropper, setShowCropper] = useState(false);
  const [debatesCount, setDebatesCount] = useState(0);

  // Reputação intelectual: soma real das reações e reposts recebidos nos posts
  const reputationScore = posts.reduce((sum, p) =>
    sum + (p.insight_count || 0) * 2 + (p.aprendi_count || 0) * 2 + (p.discordo_count || 0) + (p.reposts_count || 0) * 3
  , 0);

  useEffect(() => {
    const load = async () => {
      try {
        const me = await db.auth.me();
        const profiles = await db.entities.UserProfile.filter({ user_id: me.id });
        if (profiles.length > 0) {
          setProfile(profiles[0]);
          setEditBio(profiles[0].bio || "");
          setEditName(profiles[0].display_name || "");
          setEditInterests(profiles[0].interests || "");
        }
        const userPosts = await db.entities.Post.filter({ author_id: me.id }, "-created_date", 30);
        setPosts(userPosts);

        const [threads, replies] = await Promise.all([
          db.entities.ForumThread.filter({ author_id: me.id }),
          db.entities.ForumReply.filter({ author_id: me.id }),
        ]);
        setDebatesCount(threads.length + replies.length);
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
        bio: editBio.trim(),
        interests: editInterests.trim(),
      });
      setProfile(prev => ({ ...prev, display_name: editName.trim(), bio: editBio.trim(), interests: editInterests.trim() }));
      setEditing(false);
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (postId) => {
    await db.entities.Post.delete(postId);
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await db.auth.deleteAccount();
      window.location.href = "/login";
    } catch (err) {
      console.error(err);
      setDeletingAccount(false);
      setShowDeleteConfirm(false);
    }
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
            <h2 className="text-xl font-bold flex items-center gap-1.5">
              {profile?.display_name}
              {profile?.verified && (
                <BadgeCheck className="w-5 h-5 text-primary fill-primary/20 shrink-0" />
              )}
            </h2>
          )}
          <p className="text-sm text-muted-foreground">@{profile?.username}</p>
        </div>

        {editing ? (
          <>
            <textarea
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              placeholder="Escreva algo sobre você..."
              className="mt-2 w-full bg-secondary rounded-lg px-3 py-2 text-sm outline-none resize-none"
              rows={3}
            />
            <input
              value={editInterests}
              onChange={(e) => setEditInterests(e.target.value)}
              placeholder="Áreas de interesse, separadas por vírgula (ex: Tecnologia, Filosofia, IA)"
              className="mt-2 w-full bg-secondary rounded-lg px-3 py-2 text-sm outline-none"
            />
          </>
        ) : (
          <>
            {profile?.bio && <p className="text-sm mt-2">{profile.bio}</p>}
            {profile?.interests && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {profile.interests.split(",").map(tag => tag.trim()).filter(Boolean).map((tag, i) => (
                  <span key={i} className="text-xs font-medium px-2.5 py-1 rounded-full bg-secondary text-foreground/80">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </>
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

        <div className="flex gap-5 mt-3 text-sm pb-4 border-b border-border flex-wrap">
          <span><strong>{posts.length}</strong> <span className="text-muted-foreground">Insights publicados</span></span>
          <span><strong>{posts.filter(p => p.title).length}</strong> <span className="text-muted-foreground">Artigos escritos</span></span>
          <span><strong>{debatesCount}</strong> <span className="text-muted-foreground">Debates participados</span></span>
          <span><strong>{reputationScore}</strong> <span className="text-muted-foreground">Reputação intelectual</span></span>
        </div>

        {/* Conquistas: só acende quando o marco real foi atingido */}
        <div className="flex gap-2 py-4 border-b border-border">
          {ACHIEVEMENTS.map((ach) => {
            const unlocked = ach.check({ posts, debatesCount, reputationScore, iqScore: profile?.iq_score || 0 });
            return (
              <div key={ach.id} className="group relative">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                  unlocked ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground/30"
                }`}>
                  <ach.Icon className="w-5 h-5" />
                </div>
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 hidden group-hover:block bg-popover border border-border text-xs px-2 py-1 rounded-lg whitespace-nowrap z-10">
                  {ach.label}{!unlocked && " (bloqueada)"}
                </div>
              </div>
            );
          })}
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
            post={{ ...post, author_avatar: profile?.avatar_url || post.author_avatar }}
            currentUserId={profile?.user_id}
            onDelete={handleDelete}
          />
        ))
      )}

      {/* Configurações da conta / LGPD */}
      <div className="p-4 border-t border-border mt-4">
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">Configurações da conta</h3>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 text-sm text-destructive hover:underline"
          >
            <Trash2 className="w-4 h-4" /> Excluir minha conta
          </button>
        ) : (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold">Isso é permanente</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Sua conta, perfil, publicações, comentários e curtidas serão apagados
                  definitivamente e não podem ser recuperados.
                </p>
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteAccount}
                    disabled={deletingAccount}
                  >
                    {deletingAccount ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Excluindo...</>
                    ) : (
                      "Sim, excluir permanentemente"
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={deletingAccount}
                  >
                    <X className="w-4 h-4 mr-1" /> Cancelar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}