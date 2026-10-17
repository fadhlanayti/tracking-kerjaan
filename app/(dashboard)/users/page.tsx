"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  UserPlus,
  Trash2,
  KeyRound,
  Copy,
  Check,
  X,
  MessageCircle,
  Camera,
  Loader2,
  Users as UsersIcon,
  Linkedin,
  Github,
  Edit2,
  ExternalLink,
} from "lucide-react";

interface User {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  avatar: string | null;
  position: string | null;
  linkedin: string | null;
  github: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export default function UsersPage() {
  const { data: session, update: updateSession } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [resetModal, setResetModal] = useState<{
    user: User;
    resetUrl: string;
    phone: string | null;
  } | null>(null);
  const [generatingReset, setGeneratingReset] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [uploadingAvatarId, setUploadingAvatarId] = useState<string | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedUserForAvatar, setSelectedUserForAvatar] = useState<
    string | null
  >(null);

  // Edit Sosmed & Detail User Modal
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState("");
  const [editPosition, setEditPosition] = useState("");
  const [editLinkedin, setEditLinkedin] = useState("");
  const [editGithub, setEditGithub] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setUsers(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function openEditModal(u: User) {
    setEditingUser(u);
    setEditName(u.name || "");
    setEditPosition(u.position || "");
    setEditLinkedin(u.linkedin || "");
    setEditGithub(u.github || "");
    setEditPhone(u.phone || "");
  }

  async function handleSaveSocials(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser || !editName.trim()) return;

    setSavingEdit(true);
    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          position: editPosition.trim() || null,
          linkedin: editLinkedin.trim() || null,
          github: editGithub.trim() || null,
          phone: editPhone.trim() || null,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setUsers((prev) =>
          prev.map((u) => (u.id === editingUser.id ? { ...u, ...updated } : u)),
        );
        if (session?.user?.id === editingUser.id) {
          await updateSession?.({ name: editName.trim() });
        }
        setEditingUser(null);
      } else {
        alert("Gagal menyimpan perubahan");
      }
    } catch {
      alert("Terjadi kesalahan");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleAvatarClick(userId: string) {
    setSelectedUserForAvatar(userId);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  }

  async function handleAvatarFileChange(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0];
    const userId = selectedUserForAvatar;
    if (!file || !userId) return;

    setUploadingAvatarId(userId);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error("Gagal mengupload gambar profil");
      }

      const { url } = await uploadRes.json();

      // Update user avatar di database
      const patchRes = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar: url }),
      });

      if (!patchRes.ok) {
        throw new Error("Gagal memperbarui avatar user");
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, avatar: url } : u)),
      );
    } catch (err: any) {
      alert(err.message || "Terjadi kesalahan saat upload avatar");
    } finally {
      setUploadingAvatarId(null);
      setSelectedUserForAvatar(null);
    }
  }

  async function toggleActive(user: User) {
    await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !user.isActive }),
    });
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, isActive: !u.isActive } : u)),
    );
  }

  async function deleteUser(user: User) {
    if (
      !confirm(
        `Hapus user "${user.name}" secara permanen? Semua data terkait (project, issue, comment) juga akan dihapus.`,
      )
    )
      return;
    setDeleting(user.id);
    const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Gagal menghapus user");
    }
    setDeleting(null);
  }

  async function handleResetPassword(user: User) {
    setGeneratingReset(user.id);
    try {
      const res = await fetch(`/api/users/${user.id}/reset-password`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setResetModal({
          user,
          resetUrl: data.resetUrl,
          phone: data.phone,
        });
      } else {
        alert(data.error || "Gagal membuat link reset password");
      }
    } catch (err) {
      alert("Terjadi kesalahan saat membuat link reset password");
    } finally {
      setGeneratingReset(null);
    }
  }

  function copyLink(url: string) {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading)
    return <div className="loading-state !text-white">Loading...</div>;

  return (
    <div className="w-full flex flex-col gap-5">
      {/* Hidden File Input for Avatar Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleAvatarFileChange}
        accept="image/png,image/jpeg,image/webp,image/gif"
        style={{ display: "none" }}
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent text-zinc-950 flex items-center justify-center font-bold shadow-xs">
            <UsersIcon size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--accent)' }}>
              Users Management
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
              Kelola akun, foto profil, dan sosial media anggota
            </p>
          </div>
        </div>
        <Link
          href="/users/invite"
          className="btn-primary"
          style={{ padding: "0.45rem 1rem" }}
        >
          <UserPlus size={16} />
          <span>Invite User</span>
        </Link>
      </div>

      {/* Mobile Card List (Hidden on desktop md:) */}
      <div className="flex flex-col gap-3 md:hidden">
        {users.map((user) => {
          const isUploading = uploadingAvatarId === user.id;
          return (
            <div
              key={`mobile-${user.id}`}
              className="bg-white rounded-2xl p-4 border border-zinc-200/90 shadow-sm flex flex-col gap-3.5"
            >
              {/* User Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    onClick={() => handleAvatarClick(user.id)}
                    className="relative w-12 h-12 rounded-full shrink-0 cursor-pointer group shadow-xs overflow-hidden border border-zinc-200"
                    title="Klik untuk ubah foto profil"
                  >
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-zinc-900 text-white font-bold text-sm flex items-center justify-center">
                        {user.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div
                      className={`absolute inset-0 bg-black/50 text-white flex items-center justify-center transition-opacity ${
                        isUploading ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      {isUploading ? (
                        <Loader2 size={16} className="animate-spin text-white" />
                      ) : (
                        <Camera size={14} className="text-white" />
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-zinc-900 text-sm leading-tight">
                      {user.name}
                    </h3>
                    {user.position && (
                      <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md inline-block mt-1">
                        {user.position}
                      </span>
                    )}
                    <p className="text-xs text-zinc-500 font-mono mt-0.5">
                      {user.email}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span
                    className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      user.role === "ADMIN"
                        ? "bg-zinc-900 text-white"
                        : user.role === "DEVELOPER"
                        ? "bg-sky-50 text-[var(--accent-secondary)] border border-sky-200/60"
                        : "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                    }`}
                  >
                    {user.role}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                      user.isActive ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        user.isActive ? "bg-emerald-500" : "bg-rose-500"
                      }`}
                    />
                    {user.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>

              {/* Detail Info: Phone & Socials */}
              <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-zinc-100 text-xs">
                <div>
                  {user.phone ? (
                    <span className="text-zinc-600 font-mono text-[11px]">
                      {user.phone}
                    </span>
                  ) : (
                    <span className="text-zinc-400 text-[11px]">Tidak ada WA</span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {user.linkedin && (
                    <a
                      href={
                        user.linkedin.startsWith("http")
                          ? user.linkedin
                          : `https://${user.linkedin}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200"
                    >
                      <Linkedin size={11} />
                      <span>LinkedIn</span>
                    </a>
                  )}
                  {user.github && (
                    <a
                      href={
                        user.github.startsWith("http")
                          ? user.github
                          : `https://${user.github}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-800 border border-zinc-200"
                    >
                      <Github size={11} />
                      <span>GitHub</span>
                    </a>
                  )}
                  {!user.linkedin && !user.github && (
                    <span className="text-zinc-400 text-[11px]">-</span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => openEditModal(user)}
                  className="btn-secondary text-xs py-1 px-2.5 inline-flex items-center gap-1"
                >
                  <Edit2 size={12} className="text-zinc-600" />
                  <span>Edit</span>
                </button>

                <button
                  onClick={() => handleResetPassword(user)}
                  disabled={generatingReset === user.id}
                  className="btn-secondary text-xs py-1 px-2.5 inline-flex items-center gap-1"
                >
                  <KeyRound size={12} style={{ color: "var(--accent)" }} />
                  <span>
                    {generatingReset === user.id ? "Generating..." : "Reset"}
                  </span>
                </button>

                <button
                  onClick={() => toggleActive(user)}
                  className="btn-secondary text-xs py-1 px-2"
                  style={{
                    color: user.isActive ? "var(--red)" : "var(--green)",
                  }}
                >
                  {user.isActive ? "Deactivate" : "Activate"}
                </button>

                <button
                  onClick={() => deleteUser(user)}
                  disabled={deleting === user.id}
                  className="btn-secondary text-xs py-1 px-2"
                  style={{ color: "var(--red)" }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Card Table (Hidden on mobile, visible on md:) */}
      <div className="hidden md:block rounded-2xl bg-white border border-zinc-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                <th className="text-left py-3.5 px-5 text-[11px] font-bold uppercase tracking-wider text-zinc-600">
                  User / Profil
                </th>
                <th className="text-left py-3.5 px-5 text-[11px] font-bold uppercase tracking-wider text-zinc-600">
                  Email
                </th>
                <th className="text-left py-3.5 px-5 text-[11px] font-bold uppercase tracking-wider text-zinc-600">
                  Sosial Media
                </th>
                <th className="text-left py-3.5 px-5 text-[11px] font-bold uppercase tracking-wider text-zinc-600">
                  Role
                </th>
                <th className="text-left py-3.5 px-5 text-[11px] font-bold uppercase tracking-wider text-zinc-600">
                  Status
                </th>
                <th className="text-right py-3.5 px-5 text-[11px] font-bold uppercase tracking-wider text-zinc-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {users.map((user) => {
                const isUploading = uploadingAvatarId === user.id;
                return (
                  <tr
                    key={user.id}
                    className="hover:bg-amber-50/30 transition-colors"
                  >
                    {/* Column Profil + PP */}
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        {/* Avatar dengan hover tombol ganti foto */}
                        <div
                          onClick={() => handleAvatarClick(user.id)}
                          className="relative w-10 h-10 rounded-full shrink-0 cursor-pointer group shadow-xs overflow-hidden border border-zinc-200"
                          title="Klik untuk ubah foto profil"
                        >
                          {user.avatar ? (
                            <img
                              src={user.avatar}
                              alt={user.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-zinc-900 text-white font-bold text-xs flex items-center justify-center">
                              {user.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}

                          {/* Hover / Loading Overlay */}
                          <div
                            className={`absolute inset-0 bg-black/50 text-white flex items-center justify-center transition-opacity ${
                              isUploading
                                ? "opacity-100"
                                : "opacity-0 group-hover:opacity-100"
                            }`}
                          >
                            {isUploading ? (
                              <Loader2
                                size={16}
                                className="animate-spin text-white"
                              />
                            ) : (
                              <Camera size={14} className="text-white" />
                            )}
                          </div>
                        </div>

                        {/* Name, Position & Phone */}
                        <div>
                          <div className="font-semibold text-zinc-900 flex items-center gap-1.5">
                            <span>{user.name}</span>
                          </div>
                          {user.position && (
                            <div className="text-[11px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-sm inline-block mt-0.5">
                              {user.position}
                            </div>
                          )}
                          {user.phone ? (
                            <div className="text-xs text-zinc-500 font-mono mt-0.5">
                              {user.phone}
                            </div>
                          ) : (
                            <div className="text-[11px] text-zinc-400">
                              Tidak ada WA
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-5 text-zinc-600 font-mono text-xs">
                      {user.email}
                    </td>

                    {/* Sosial Media (LinkedIn / GitHub) */}
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-2">
                        {user.linkedin ? (
                          <a
                            href={
                              user.linkedin.startsWith("http")
                                ? user.linkedin
                                : `https://${user.linkedin}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
                            title="Buka LinkedIn"
                          >
                            <Linkedin size={12} />
                            <span>LinkedIn</span>
                          </a>
                        ) : null}

                        {user.github ? (
                          <a
                            href={
                              user.github.startsWith("http")
                                ? user.github
                                : `https://${user.github}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-800 hover:bg-zinc-200 border border-zinc-200 transition-colors"
                            title="Buka GitHub"
                          >
                            <Github size={12} />
                            <span>GitHub</span>
                          </a>
                        ) : null}

                        {!user.linkedin && !user.github && (
                          <span className="text-xs text-zinc-400 font-mono">
                            -
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-5">
                      <span
                        className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                          user.role === "ADMIN"
                            ? "bg-zinc-900 text-white"
                            : user.role === "DEVELOPER"
                              ? "bg-sky-50 text-[var(--accent-secondary)] border border-sky-200/60"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>

                    <td className="py-3 px-5">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                          user.isActive ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${user.isActive ? "bg-emerald-500" : "bg-rose-500"}`}
                        />
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td className="py-3 px-5 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {/* Edit User Detail (Sosmed / Phone) */}
                        <button
                          type="button"
                          onClick={() => openEditModal(user)}
                          className="btn-secondary text-xs py-1 px-2.5 inline-flex items-center gap-1"
                          title="Edit LinkedIn / Sosmed"
                        >
                          <Edit2 size={12} className="text-zinc-600" />
                          <span>Edit</span>
                        </button>

                        {/* Reset Password */}
                        <button
                          onClick={() => handleResetPassword(user)}
                          disabled={generatingReset === user.id}
                          className="btn-secondary text-xs py-1 px-2.5 inline-flex items-center gap-1"
                          title="Kirim / Buat Link Reset Password"
                        >
                          <KeyRound
                            size={12}
                            style={{ color: "var(--accent)" }}
                          />
                          <span>
                            {generatingReset === user.id
                              ? "Generating..."
                              : "Reset Pass"}
                          </span>
                        </button>

                        {/* Deactivate / Activate */}
                        <button
                          onClick={() => toggleActive(user)}
                          className="btn-secondary text-xs py-1 px-2"
                          style={{
                            color: user.isActive
                              ? "var(--red)"
                              : "var(--green)",
                          }}
                        >
                          {user.isActive ? "Deactivate" : "Activate"}
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => deleteUser(user)}
                          disabled={deleting === user.id}
                          className="btn-secondary text-xs py-1 px-2"
                          style={{ color: "var(--red)" }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Edit Sosmed & Detail User */}
      {editingUser && (
        <div className="apple-modal-overlay">
          <div
            className="apple-modal-sheet relative"
            style={{ padding: "0 1.75rem 1.5rem", maxWidth: 460 }}
          >
            <button
              onClick={() => setEditingUser(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 border-none bg-transparent cursor-pointer transition-colors"
            >
              <X size={18} />
            </button>

            <div
              className="flex items-center gap-3 pb-4 mb-4 border-b border-zinc-100"
              style={{ paddingTop: "1.25rem" }}
            >
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Edit2 size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900 leading-tight">
                  Edit Info User
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {editingUser.name} ({editingUser.email})
                </p>
              </div>
            </div>

            <form
              onSubmit={handleSaveSocials}
              className="flex flex-col gap-3.5"
            >
              <div>
                <label className="label text-xs font-semibold mb-1 block">
                  Nama Lengkap <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Nama User"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="input text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="label text-xs font-semibold mb-1 block">
                  Posisi / Jabatan
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. Web Developer, Creative Director, UI/UX"
                    value={editPosition}
                    onChange={(e) => setEditPosition(e.target.value)}
                    className="input text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="label text-xs font-semibold mb-1 block">
                  LinkedIn Profile URL
                </label>
                <div className="relative">
                  <input
                    type="url"
                    placeholder="https://linkedin.com/in/username"
                    value={editLinkedin}
                    onChange={(e) => setEditLinkedin(e.target.value)}
                    className="input text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="label text-xs font-semibold mb-1 block">
                  GitHub Profile URL
                </label>
                <div className="relative">
                  <input
                    type="url"
                    placeholder="https://github.com/username"
                    value={editGithub}
                    onChange={(e) => setEditGithub(e.target.value)}
                    className="input text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="label text-xs font-semibold mb-1 block">
                  No. WhatsApp
                </label>
                <input
                  type="text"
                  placeholder="0872xxxxxxxx"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="input text-xs font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 mt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="btn-secondary text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="btn-primary text-xs"
                >
                  {savingEdit ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tampilan Link Reset Password */}
      {resetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div
            className="card w-full shadow-2xl relative"
            style={{
              maxWidth: 520,
              padding: "1.75rem",
              borderRadius: "1.25rem",
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "1rem",
                marginBottom: "1.25rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                }}
              >
                <div
                  style={{
                    width: "2.5rem",
                    height: "2.5rem",
                    borderRadius: "0.75rem",
                    backgroundColor: "var(--accent-subtle)",
                    color: "var(--accent)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: "1rem",
                      fontWeight: 700,
                      color: "var(--text-primary)",
                      margin: 0,
                    }}
                  >
                    Link Reset Password
                  </h3>
                  <p
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      margin: "0.25rem 0 0",
                    }}
                  >
                    Akun:{" "}
                    <strong style={{ color: "var(--text-secondary)" }}>
                      {resetModal.user.name}
                    </strong>{" "}
                    ({resetModal.user.email})
                  </p>
                </div>
              </div>

              <button
                onClick={() => setResetModal(null)}
                className="cursor-pointer"
                style={{
                  border: "none",
                  background: "none",
                  color: "var(--text-muted)",
                  padding: "0.25rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  display: "block",
                  marginBottom: "0.375rem",
                }}
              >
                Bagikan link berikut ke user:
              </label>
              <div
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                <input
                  type="text"
                  readOnly
                  value={resetModal.resetUrl}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="input select-all"
                  style={{
                    fontSize: "0.75rem",
                    fontFamily: "monospace",
                    padding: "0.625rem 0.75rem",
                    backgroundColor: "var(--bg-elevated)",
                    flex: 1,
                    minWidth: 0,
                  }}
                />
                <button
                  onClick={() => copyLink(resetModal.resetUrl)}
                  className="btn-primary"
                  style={{
                    fontSize: "0.75rem",
                    padding: "0.625rem 1rem",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    flexShrink: 0,
                    cursor: "pointer",
                  }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? "Tersalin" : "Salin"}</span>
                </button>
              </div>
            </div>

            {resetModal.phone && (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.625rem",
                  padding: "0.75rem 0.875rem",
                  borderRadius: "0.75rem",
                  backgroundColor: "rgba(52, 199, 89, 0.08)",
                  border: "1px solid rgba(52, 199, 89, 0.25)",
                  marginBottom: "1.25rem",
                }}
              >
                <MessageCircle
                  size={16}
                  style={{
                    color: "var(--green)",
                    flexShrink: 0,
                    marginTop: "0.125rem",
                  }}
                />
                <p
                  style={{
                    fontSize: "0.75rem",
                    color: "#15803D",
                    lineHeight: 1.5,
                    margin: 0,
                  }}
                >
                  Link reset password juga otomatis dikirimkan ke WhatsApp{" "}
                  <strong style={{ color: "#166534" }}>
                    {resetModal.phone}
                  </strong>
                  .
                </p>
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.5rem",
                paddingTop: "0.75rem",
                borderTop: "1px solid var(--border)",
              }}
            >
              <button
                onClick={() => setResetModal(null)}
                className="btn-secondary"
                style={{
                  fontSize: "0.75rem",
                  padding: "0.5rem 1.25rem",
                  cursor: "pointer",
                }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
