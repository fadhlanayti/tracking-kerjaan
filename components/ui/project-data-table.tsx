"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { cva } from "class-variance-authority";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, FolderKanban, Code2, Users2, Calendar } from "lucide-react";

// --- TYPE DEFINITIONS ---
export interface Contributor {
  id?: string;
  name: string;
  role?: string;
  src?: string;
  fallback: string;
}

export type StatusVariant = "active" | "inProgress" | "onHold";

export interface ProjectRow {
  id: string;
  name: string;
  repository?: string | null;
  team: string;
  tech: string;
  createdAt: string;
  contributors: Contributor[];
  status: {
    text: string;
    variant: StatusVariant;
  };
}

// --- PROPS INTERFACE ---
interface ProjectDataTableProps {
  projects: ProjectRow[];
  visibleColumns: Set<keyof ProjectRow>;
}

// --- STATUS BADGE VARIANTS ---
const badgeVariants = cva("capitalize text-white font-semibold text-[11px] px-2.5 py-1 rounded-full shadow-xs border-none", {
  variants: {
    variant: {
      active: "bg-emerald-500 hover:bg-emerald-600",
      inProgress: "bg-amber-500 hover:bg-amber-600",
      onHold: "bg-rose-500 hover:bg-rose-600",
    },
  },
  defaultVariants: {
    variant: "active",
  },
});

export const ProjectDataTable = ({ projects, visibleColumns }: ProjectDataTableProps) => {
  const rowVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: Math.min(i * 0.03, 0.3),
        duration: 0.2,
        ease: "easeOut" as const,
      },
    }),
  };

  const tableHeaders: { key: keyof ProjectRow; label: string; icon?: React.ElementType }[] = [
    { key: "name", label: "Project", icon: FolderKanban },
    { key: "repository", label: "Repository", icon: ExternalLink },
    { key: "team", label: "Team", icon: Users2 },
    { key: "tech", label: "Tech Stack", icon: Code2 },
    { key: "createdAt", label: "Created At", icon: Calendar },
    { key: "contributors", label: "Contributors", icon: Users2 },
    { key: "status", label: "Status" },
  ];

  return (
    <div className="w-full flex flex-col gap-3">
      {/* ── Mobile Card View (md:hidden) ── */}
      <div className="flex flex-col gap-3.5 md:hidden">
        {projects.length > 0 ? (
          projects.map((project, index) => (
            <motion.div
              key={`mob-${project.id}`}
              custom={index}
              initial="hidden"
              animate="visible"
              variants={rowVariants}
              className="bg-white rounded-2xl p-4 border border-zinc-200/90 shadow-sm flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/projects/${project.id}`}
                  className="inline-flex items-center gap-2.5 text-zinc-900 font-bold text-sm no-underline group"
                >
                  <div className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-700 flex items-center justify-center shrink-0">
                    <FolderKanban className="w-4 h-4 text-zinc-700" />
                  </div>
                  <span className="group-hover:text-[var(--accent-secondary)] transition-colors">
                    {project.name}
                  </span>
                </Link>

                {visibleColumns.has("status") && (
                  <Badge className={cn(badgeVariants({ variant: project.status.variant }), "shrink-0")}>
                    {project.status.text}
                  </Badge>
                )}
              </div>

              {/* Badges / Tech / Team */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {visibleColumns.has("team") && (
                  <span className="bg-zinc-100/90 px-2.5 py-1 rounded-full text-zinc-700 font-medium text-[11px]">
                    {project.team}
                  </span>
                )}
                {visibleColumns.has("tech") && project.tech && (
                  <span className="bg-amber-50 text-amber-900 border border-amber-200/60 px-2 py-0.5 rounded-md font-mono text-[11px] font-semibold">
                    {project.tech}
                  </span>
                )}
                {visibleColumns.has("createdAt") && (
                  <span className="text-zinc-400 text-[11px] ml-auto">
                    {project.createdAt}
                  </span>
                )}
              </div>

              {/* Repository & Contributors */}
              <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-zinc-100">
                <div>
                  {visibleColumns.has("repository") && project.repository ? (
                    <a
                      href={project.repository.startsWith("http") ? project.repository : `https://${project.repository}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent-secondary)] bg-sky-50 px-2.5 py-1 rounded-full border border-sky-100"
                    >
                      <span className="truncate max-w-[150px]">Repo</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  ) : (
                    <span className="text-xs text-zinc-400 font-mono">-</span>
                  )}
                </div>

                {visibleColumns.has("contributors") && (
                  <div className="flex -space-x-1.5 items-center">
                    {project.contributors.slice(0, 4).map((c, idx) => (
                      <Avatar
                        key={c.id || idx}
                        title={c.name}
                        className="h-7 w-7 border-2 border-white bg-zinc-900 text-white shrink-0 text-[10px]"
                      >
                        {c.src && <AvatarImage src={c.src} alt={c.name} />}
                        <AvatarFallback className="bg-zinc-900 text-white font-bold">
                          {c.fallback}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {project.contributors.length > 4 && (
                      <span className="text-[10px] font-bold text-zinc-500 pl-2">
                        +{project.contributors.length - 4}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))
        ) : (
          <div className="bg-white rounded-2xl p-8 border border-zinc-200/90 text-center text-sm text-zinc-400">
            Tidak ada data project.
          </div>
        )}
      </div>

      {/* ── Desktop Table View (hidden md:block) ── */}
      <div className="hidden md:block w-full rounded-2xl bg-white border border-zinc-200/90 shadow-sm overflow-hidden">
        <div className="relative w-full overflow-x-auto">
          <Table className="w-full bg-white">
            <TableHeader>
              <TableRow className="bg-zinc-50/90 border-b border-zinc-200 hover:bg-zinc-50/90">
                {tableHeaders
                  .filter((header) => visibleColumns.has(header.key))
                  .map((header) => (
                    <TableHead
                      key={header.key}
                      className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 py-3.5 px-5 select-none"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {header.label}
                      </span>
                    </TableHead>
                  ))}
              </TableRow>
            </TableHeader>
            <TableBody className="bg-white divide-y divide-zinc-100">
              {projects.length > 0 ? (
                projects.map((project, index) => (
                  <motion.tr
                    key={project.id}
                    custom={index}
                    initial="hidden"
                    animate="visible"
                    variants={rowVariants}
                    className="bg-white transition-colors hover:bg-amber-50/40"
                  >
                    {visibleColumns.has("name") && (
                      <TableCell className="px-5 py-4 font-semibold text-sm">
                        <Link
                          href={`/projects/${project.id}`}
                          className="inline-flex items-center gap-2.5 text-zinc-900 hover:text-[var(--accent-secondary)] transition-colors no-underline font-semibold group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-zinc-100 group-hover:bg-amber-100/70 text-zinc-700 flex items-center justify-center shrink-0 transition-colors">
                            <FolderKanban className="w-4 h-4 text-zinc-700" />
                          </div>
                          <span className="group-hover:underline underline-offset-2">{project.name}</span>
                        </Link>
                      </TableCell>
                    )}

                    {visibleColumns.has("repository") && (
                      <TableCell className="px-5 py-4 text-sm">
                        {project.repository ? (
                          <a
                            href={project.repository.startsWith('http') ? project.repository : `https://${project.repository}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent-secondary)] hover:underline bg-sky-50 px-2.5 py-1 rounded-full border border-sky-100 max-w-[220px]"
                          >
                            <span className="truncate">
                              {project.repository.replace(/^https?:\/\//, '')}
                            </span>
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        ) : (
                          <span className="text-xs text-zinc-400 font-mono">-</span>
                        )}
                      </TableCell>
                    )}

                    {visibleColumns.has("team") && (
                      <TableCell className="px-5 py-4 text-xs font-medium text-zinc-600">
                        <span className="inline-flex items-center gap-1.5 bg-zinc-100/80 px-2.5 py-1 rounded-full text-zinc-700">
                          {project.team}
                        </span>
                      </TableCell>
                    )}

                    {visibleColumns.has("tech") && (
                      <TableCell className="px-5 py-4">
                        {project.tech ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md bg-amber-50 text-amber-900 border border-amber-200/60 font-mono">
                            {project.tech}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-400">-</span>
                        )}
                      </TableCell>
                    )}

                    {visibleColumns.has("createdAt") && (
                      <TableCell className="px-5 py-4 text-xs font-medium text-zinc-500 whitespace-nowrap">
                        {project.createdAt}
                      </TableCell>
                    )}

                    {visibleColumns.has("contributors") && (
                      <TableCell className="px-5 py-4">
                        {project.contributors.length > 0 ? (
                          <div className="flex -space-x-2 items-center">
                            {project.contributors.slice(0, 6).map((contributor, idx) => (
                              <Avatar
                                key={contributor.id || idx}
                                title={`${contributor.name}${contributor.role ? ` (${contributor.role})` : ''}`}
                                className="h-8 w-8 border-2 border-white bg-zinc-900 text-white shrink-0 text-xs shadow-sm hover:z-10 hover:scale-105 transition-transform"
                              >
                                {contributor.src && (
                                  <AvatarImage src={contributor.src} alt={contributor.name} />
                                )}
                                <AvatarFallback className="bg-zinc-900 text-white font-bold text-[10px]">
                                  {contributor.fallback}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                            {project.contributors.length > 6 && (
                              <span className="text-[11px] font-semibold text-zinc-500 pl-3">
                                +{project.contributors.length - 6}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-400">Belum ada</span>
                        )}
                      </TableCell>
                    )}

                    {visibleColumns.has("status") && (
                      <TableCell className="px-5 py-4">
                        <Badge className={cn(badgeVariants({ variant: project.status.variant }))}>
                          {project.status.text}
                        </Badge>
                      </TableCell>
                    )}
                  </motion.tr>
                ))
              ) : (
                <TableRow className="bg-white">
                  <TableCell
                    colSpan={visibleColumns.size}
                    className="h-36 text-center text-sm text-zinc-400 bg-white"
                  >
                    Tidak ada data project.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};
