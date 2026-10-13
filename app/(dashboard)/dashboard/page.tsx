"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  FolderKanban,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Users,
  TrendingUp,
  Plus,
} from "lucide-react";
import { StatusBadge } from "@/components/status-badge";

interface Project {
  id: string;
  name: string;
  status: string;
  description: string | null;
  _count: { issues: number };
  members: { user: { name: string; role: string } }[];
  updatedAt: string;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [userData, setUserData] = useState<{ name: string; avatar?: string | null; role: string } | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/users/me")
      .then((r) => r.json())
      .then((d) => { if (d && !d.error) setUserData(d); })
      .catch(() => {});

    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        setProjects(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading)
    return <div className="loading-state !text-black font-semibold">Loading...</div>;

  const activeProjects = projects.filter((p) => p.status === "ACTIVE").length;
  const totalIssues = projects.reduce((sum, p) => sum + p._count.issues, 0);
  const isAdmin = session?.user?.role === "ADMIN";
  const uniqueMembers = [
    ...new Set(projects.flatMap((p) => p.members.map((m) => m.user.name))),
  ].length;

  const stats = [
    {
      label: "Total Projects",
      value: projects.length,
      sub: `${activeProjects} active`,
      icon: FolderKanban,
      cls: "border-l-accent",
      iconCls: "icon-bg-accent",
      iconColor: "#087CF0",
    },
    {
      label: "Open Issues",
      value: totalIssues,
      sub: "across all projects",
      icon: AlertCircle,
      cls: "border-l-orange",
      iconCls: "icon-bg-orange",
      iconColor: "#F97316",
    },
    {
      label: "Team Members",
      value: uniqueMembers,
      sub: "across projects",
      icon: Users,
      cls: "border-l-purple",
      iconCls: "icon-bg-purple",
      iconColor: "#7C3AED",
    },
    {
      label: "Completed",
      value: projects.filter((p) => p.status === "COMPLETED").length,
      sub: "projects done",
      icon: CheckCircle2,
      cls: "border-l-green",
      iconCls: "icon-bg-green",
      iconColor: "#15803D",
    },
  ];

  return (
    <div
      className="flex flex-col gap-6"
      style={{ maxWidth: "1100px", margin: "0 auto", width: "100%" }}
    >
      {/* Welcome header */}
      <div className="dashboard-welcome">
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold shrink-0 overflow-hidden border border-white/10"
            style={{ backgroundColor: "var(--accent)" }}
          >
            {userData?.avatar || (session?.user as any)?.image ? (
              <img
                src={userData?.avatar || (session?.user as any)?.image}
                alt={userData?.name || session?.user?.name || "User"}
                className="w-full h-full object-cover"
              />
            ) : (
              (userData?.name || session?.user?.name || "U")[0].toUpperCase()
            )}
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: "#FFFFFF" }}>
              Welcome back
            </p>
            <h1 className="text-xl font-bold" style={{ color: "#FFFFFF" }}>
              {userData?.name || session?.user?.name}
            </h1>
            <p
              className="text-xs font-medium"
              style={{ color: "#FFFFFF", marginTop: "0.125rem" }}
            >
              {userData?.role || session?.user?.role} · WeballCreative
            </p>
          </div>
        </div>
        <div className="dashboard-welcome-meta">
          <p className="text-sm font-medium" style={{ color: "#FFFFFF" }}>
            {new Date().toLocaleDateString("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          {isAdmin && (
            <Link
              href="/projects/new"
              className="inline-flex items-center gap-1.5 !mt-3 px-3 py-1.5 text-xs font-semibold rounded-lg text-black no-underline"
              style={{ backgroundColor: "var(--accent)" }}
            >
              <Plus size={13} /> New Project
            </Link>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="dashboard-stats">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`card flex items-center gap-3 ${stat.cls}`}
            style={{ padding: "1rem 1.25rem" }}
          >
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${stat.iconCls}`}
            >
              <stat.icon size={20} color={stat.iconColor} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p
                className="text-2xl font-bold leading-tight"
                style={{ color: "var(--text-primary)" }}
              >
                {stat.value}
              </p>
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--text-primary)", marginTop: "0.125rem" }}
              >
                {stat.label}
              </p>
              <p
                className="text-xs text-muted"
                style={{ marginTop: "0.125rem" }}
              >
                {stat.sub}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Projects */}
      <div className="card overflow-hidden">
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <TrendingUp size={16} style={{ color: "var(--accent)" }} />
            <h2
              className="text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              Recent Projects
            </h2>
          </div>
          <Link
            href="/projects"
            className="flex items-center gap-1 text-xs font-medium no-underline"
            style={{ color: "var(--accent)" }}
          >
            View all <ArrowRight size={13} />
          </Link>
        </div>

        {projects.length === 0 ? (
          <div className="empty-state">
            <FolderKanban
              size={32}
              className="mb-2"
              style={{ color: "var(--border)" }}
            />
            <p>No projects yet</p>
            {isAdmin && (
              <Link
                href="/projects/new"
                className="btn-primary mt-3"
                style={{ fontSize: "0.8125rem" }}
              >
                <Plus size={14} /> Create first project
              </Link>
            )}
          </div>
        ) : (
          <div>
            {projects.slice(0, 8).map((project, i) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="flex items-center justify-between px-5 py-4 transition-colors no-underline"
                style={{
                  borderBottom:
                    i < Math.min(projects.length, 8) - 1
                      ? "1px solid var(--border)"
                      : "none",
                  color: "inherit",
                  gap: "0.75rem",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--bg-elevated)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <div
                  className="flex items-center gap-3"
                  style={{ minWidth: 0, flex: 1 }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: "var(--accent)" }}
                  >
                    {project.name[0].toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p
                      className="text-sm font-semibold truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {project.name}
                    </p>
                    <div
                      className="flex items-center gap-2"
                      style={{ marginTop: "0.125rem", flexWrap: "wrap" }}
                    >
                      <span
                        className="flex items-center gap-1 text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <AlertCircle size={11} /> {project._count.issues} issues
                      </span>
                      <span style={{ color: "var(--border)" }}>·</span>
                      <span
                        className="flex items-center gap-1 text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <Users size={11} /> {project.members.length} members
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge value={project.status} />
                  <ArrowRight size={15} style={{ color: "var(--border)" }} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
