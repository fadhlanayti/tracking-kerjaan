"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Plus, AlertCircle, Users, FolderOpen } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  _count: { issues: number };
  members: { user: { id: string; name: string; role: string } }[];
  createdAt: string;
}

const statusColor: Record<string, string> = {
  ACTIVE: "#087CF0",
  ON_HOLD: "#F97316",
  COMPLETED: "#34C759",
  ARCHIVED: "#86868B",
};

export default function ProjectsPage() {
  const { data: session } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        setProjects(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading)
    return <div className="loading-state !text-black font-semibold">Loading...</div>;

  return (
    <div style={{ width: "100%" }}>
      <div className="page-header" style={{ marginBottom: "1.5rem" }}>
        <div>
          <h2 className="page-title">Projects</h2>
          <p
            style={{
              fontSize: "0.875rem",
              color: "var(--text-muted)",
              marginTop: "0.25rem",
            }}
          >
            {projects.length} project{projects.length !== 1 ? "s" : ""}
          </p>
        </div>
        {session?.user?.role === "ADMIN" && (
          <Link href="/projects/new" className="btn-primary ">
            <Plus size={16} />
            New Project
          </Link>
        )}
      </div>

      <div
        style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}
      >
        {projects.map((project) => (
          <Link
            key={project.id}
            href={`/projects/${project.id}`}
            className="card-link"
            style={{ padding: "1.25rem 1.5rem" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  minWidth: 0,
                }}
              >
                {/* Icon */}
                <div
                  style={{
                    width: "2.75rem",
                    height: "2.75rem",
                    borderRadius: "0.875rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontSize: "1.125rem",
                    fontWeight: 700,
                    flexShrink: 0,
                    backgroundColor: statusColor[project.status] ?? "#087CF0",
                    opacity: project.status === "ARCHIVED" ? 0.6 : 1,
                  }}
                >
                  {project.name[0].toUpperCase()}
                </div>

                {/* Info */}
                <div style={{ minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: "0.9375rem",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      marginBottom: "0.2rem",
                    }}
                  >
                    {project.name}
                  </p>
                  {project.description && (
                    <p
                      style={{
                        fontSize: "0.8125rem",
                        color: "var(--text-secondary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        marginBottom: "0.35rem",
                      }}
                    >
                      {project.description}
                    </p>
                  )}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.875rem",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-muted)",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.3rem",
                      }}
                    >
                      <AlertCircle size={12} />
                      {project._count.issues} issues
                    </span>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-muted)",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.3rem",
                      }}
                    >
                      <Users size={12} />
                      {project.members.length} members
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ flexShrink: 0 }}>
                <StatusBadge value={project.status} />
              </div>
            </div>
          </Link>
        ))}

        {projects.length === 0 && (
          <div
            className="card"
            style={{
              padding: "4rem 2rem",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
            }}
          >
            <FolderOpen
              size={36}
              style={{ color: "var(--text-muted)", marginBottom: "1rem" }}
            />
            <p
              style={{
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: "0.25rem",
              }}
            >
              No projects yet
            </p>
            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
              Projects will appear here once created.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
