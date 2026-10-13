"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ProjectDataTable, ProjectRow } from "@/components/ui/project-data-table";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ListFilter, Columns, Plus, RefreshCw, FolderKanban } from "lucide-react";
import { useSession } from "next-auth/react";

const allColumns: (keyof ProjectRow)[] = [
  "name",
  "repository",
  "team",
  "tech",
  "createdAt",
  "contributors",
  "status",
];

export default function ProjectContributorsPage() {
  const { data: session } = useSession();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [visibleColumns, setVisibleColumns] = useState<Set<keyof ProjectRow>>(
    new Set(allColumns)
  );

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/projects/contributors");
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const matchesSearch =
        searchFilter === "" ||
        project.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        project.tech.toLowerCase().includes(searchFilter.toLowerCase()) ||
        project.team.toLowerCase().includes(searchFilter.toLowerCase()) ||
        project.contributors.some((c) =>
          c.name.toLowerCase().includes(searchFilter.toLowerCase())
        );

      const matchesStatus =
        statusFilter === "all" || project.status.variant === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [projects, searchFilter, statusFilter]);

  const toggleColumn = (column: keyof ProjectRow) => {
    setVisibleColumns((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(column)) {
        if (newSet.size > 1) newSet.delete(column);
      } else {
        newSet.add(column);
      }
      return newSet;
    });
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-accent text-zinc-950 flex items-center justify-center font-bold shadow-xs">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                Project & Contributors
              </h1>
              <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-0.5">
                Monitoring project dan developer contributor aktif
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchProjects}
            disabled={loading}
            className="rounded-full bg-white text-zinc-800 border-zinc-200 hover:bg-zinc-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          {session?.user?.role === "ADMIN" && (
            <Link href="/projects/new" className="btn-primary" style={{ padding: "0.45rem 1rem" }}>
              <Plus size={15} />
              New Project
            </Link>
          )}
        </div>
      </div>

      {/* Toolbar Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-white border border-zinc-200/80 shadow-xs">
        <div className="flex flex-1 flex-wrap sm:flex-nowrap items-center gap-2">
          <Input
            placeholder="Cari project, developer, tech..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="max-w-xs h-9 text-xs rounded-full bg-zinc-50 border-zinc-200"
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-full text-xs flex items-center gap-1.5 bg-white border-zinc-200"
              >
                <ListFilter className="h-3.5 w-3.5" />
                <span>Status: {statusFilter.toUpperCase()}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44 bg-white border-zinc-200">
              <DropdownMenuLabel className="text-xs">Filter Status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={statusFilter === "all"}
                onCheckedChange={() => setStatusFilter("all")}
                className="text-xs"
              >
                All Status
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={statusFilter === "active"}
                onCheckedChange={() => setStatusFilter("active")}
                className="text-xs"
              >
                Active
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={statusFilter === "inProgress"}
                onCheckedChange={() => setStatusFilter("inProgress")}
                className="text-xs"
              >
                In Progress
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={statusFilter === "onHold"}
                onCheckedChange={() => setStatusFilter("onHold")}
                className="text-xs"
              >
                On Hold
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-full text-xs flex items-center gap-1.5 bg-white border-zinc-200"
              >
                <Columns className="h-3.5 w-3.5" />
                <span>Kolom ({visibleColumns.size})</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-white border-zinc-200">
              <DropdownMenuLabel className="text-xs">Pengaturan Kolom</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {allColumns.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col}
                  className="capitalize text-xs"
                  checked={visibleColumns.has(col)}
                  onCheckedChange={() => toggleColumn(col)}
                >
                  {col}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="h-48 flex items-center justify-center text-sm text-[var(--text-muted)] bg-white rounded-2xl border border-zinc-200 shadow-xs">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-[var(--accent-secondary)]" />
            <span>Memuat data project & contributors...</span>
          </div>
        </div>
      ) : (
        <ProjectDataTable
          projects={filteredProjects}
          visibleColumns={visibleColumns}
        />
      )}
    </div>
  );
}
