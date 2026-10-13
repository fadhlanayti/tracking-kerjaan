'use client'
import { useState, useEffect, use } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { ChevronRight, Paperclip, Send, Clock, MessageSquare, Check, Users } from 'lucide-react'
import { StatusBadge, statusLabels } from '@/components/status-badge'
import { FileUpload } from '@/components/file-upload'

interface Comment {
  id: string
  content: string
  attachments: string[]
  author: { id: string; name: string; avatar: string | null }
  createdAt: string
}

interface Issue {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  attachments: string[]
  createdBy: { id: string; name: string; avatar: string | null }
  assignedTo: { id: string; name: string; avatar: string | null } | null
  assignees?: { user: { id: string; name: string; avatar: string | null } }[]
  comments: Comment[]
  project: { id: string; name: string }
  createdAt: string
}

export default function IssueDetailPage({ params }: { params: Promise<{ id: string; issueId: string }> }) {
  const { id, issueId } = use(params)
  const { data: session } = useSession()
  const [issue, setIssue] = useState<Issue | null>(null)
  const [loading, setLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [commentAttachments, setCommentAttachments] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [members, setMembers] = useState<{ user: { id: string; name: string; role: string } }[]>([])

  function fetchIssue() {
    fetch(`/api/projects/${id}/issues/${issueId}`)
      .then(r => r.json())
      .then(data => { setIssue(data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchIssue()
    fetch(`/api/projects/${id}`)
      .then(r => r.json())
      .then(data => { if (data.members) setMembers(data.members) })
      .catch(() => {})
  }, [id, issueId])

  async function updateIssue(data: Record<string, any>) {
    await fetch(`/api/projects/${id}/issues/${issueId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    fetchIssue()
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentText.trim()) return
    setSubmitting(true)
    await fetch(`/api/projects/${id}/issues/${issueId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: commentText, attachments: commentAttachments }),
    })
    setCommentText('')
    setCommentAttachments([])
    setSubmitting(false)
    fetchIssue()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-sm text-white">
        Loading issue...
      </div>
    )
  }

  if (!issue) {
    return (
      <div className="p-6 rounded-2xl bg-red-50 text-red-600 border border-red-200 text-sm">
        Issue not found
      </div>
    )
  }

  const isAdmin = session?.user?.role === 'ADMIN'
  const isAssignee = session?.user?.id === issue.assignedTo?.id
  const isDeveloper = session?.user?.role === 'DEVELOPER'
  const canUpdateStatus = isAdmin || isAssignee || isDeveloper

  const statuses = ['OPEN', 'IN_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']
  const developers = members.filter(m => m.user.role === 'DEVELOPER' || m.user.role === 'ADMIN')

  return (
    <div style={{ width: '100%', maxWidth: 880, margin: '0 auto', paddingBottom: '4rem' }}>

      {/* Revisi #1: Breadcrumb dengan jarak lega ke card bawahnya */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1.25rem', marginTop: '0.25rem' }}>
        <Link
          href={`/projects/${id}`}
          style={{ color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}
        >
          {issue.project.name}
        </Link>
        <ChevronRight size={13} style={{ opacity: 0.5 }} />
        <Link
          href={`/projects/${id}/issues`}
          style={{ color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}
        >
          Issues
        </Link>
        <ChevronRight size={13} style={{ opacity: 0.5 }} />
        <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>
          {issue.title}
        </span>
      </nav>

      {/* Main Issue Card */}
      <div className="card p-6" style={{ marginBottom: '2rem' }}>
        {/* Top bar: title + badges */}
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0, lineHeight: 1.3 }}>
              {issue.title}
            </h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              <span>By <strong style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{issue.createdBy.name}</strong></span>
              <span>•</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Clock size={12} />
                {new Date(issue.createdAt).toLocaleDateString()}
              </span>
              {((issue.assignees && issue.assignees.length > 0) || issue.assignedTo) && (
                <>
                  <span>•</span>
                  <span>
                    Assigned to{' '}
                    <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                      {issue.assignees && issue.assignees.length > 0
                        ? issue.assignees.map(a => a.user.name).join(', ')
                        : issue.assignedTo?.name}
                    </strong>
                  </span>
                </>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <StatusBadge value={issue.priority} />
            <StatusBadge value={issue.status} />
          </div>
        </div>

        {/* Description */}
        <div style={{ padding: '1.25rem 0' }}>
          {issue.description ? (
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>
              {issue.description}
            </p>
          ) : (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
              No description
            </p>
          )}

          {/* Attachments */}
          {issue.attachments.length > 0 && (
            <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {issue.attachments.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                    padding: '0.375rem 0.75rem', borderRadius: '0.5rem',
                    fontSize: '0.75rem', fontWeight: 500,
                    backgroundColor: 'var(--accent-subtle)', color: 'var(--accent)',
                    textDecoration: 'none'
                  }}
                >
                  <Paperclip size={12} />
                  Attachment {i + 1}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Controls: Status & Assignee (tanpa terpotong) */}
        {canUpdateStatus && (
          <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1.25rem', fontSize: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Status:</label>
              <select
                value={issue.status}
                onChange={e => updateIssue({ status: e.target.value })}
                className="input"
                style={{ width: 'auto', padding: '0.375rem 0.75rem', fontSize: '0.75rem', fontWeight: 600, height: 'auto', lineHeight: 'normal' }}
              >
                {statuses.map(s => (
                  <option key={s} value={s}>{statusLabels[s] || s}</option>
                ))}
              </select>
            </div>

            {isAdmin && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  <Users size={14} />
                  <span>Assign Developer (Pilih satu atau lebih):</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {developers.map(m => {
                    const currentAssigneeIds = issue.assignees?.map(a => a.user.id) || (issue.assignedTo ? [issue.assignedTo.id] : [])
                    const isSelected = currentAssigneeIds.includes(m.user.id)

                    return (
                      <button
                        key={m.user.id}
                        type="button"
                        onClick={() => {
                          const nextIds = isSelected
                            ? currentAssigneeIds.filter(id => id !== m.user.id)
                            : [...currentAssigneeIds, m.user.id]
                          updateIssue({ assigneeIds: nextIds })
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                          padding: '0.375rem 0.75rem',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          border: isSelected ? '1px solid #0071E3' : '1px solid var(--border)',
                          backgroundColor: isSelected ? 'rgba(0, 113, 227, 0.12)' : 'var(--bg-elevated)',
                          color: isSelected ? '#0071E3' : 'var(--text-secondary)',
                        }}
                      >
                        <div
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: isSelected ? '#0071E3' : 'rgba(0,0,0,0.1)',
                            color: '#fff',
                            fontSize: 9,
                          }}
                        >
                          {isSelected && <Check size={10} />}
                        </div>
                        <span>{m.user.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Revisi #2: Judul Discussion dengan jarak lega ke atas dan ke bawah */}
      <div style={{ marginTop: '2rem', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <MessageSquare size={17} style={{ color: 'var(--accent)' }} />
          <span>Discussion</span>
          <span style={{
            fontSize: '0.75rem', padding: '0.125rem 0.5rem', borderRadius: '9999px',
            backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', fontWeight: 500
          }}>
            {issue.comments.length}
          </span>
        </h2>
      </div>

      {/* Comments List & Box */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {issue.comments.length === 0 ? (
          <div className="card p-6" style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            No discussion yet. Leave the first comment below!
          </div>
        ) : (
          issue.comments.map(c => (
            <div
              key={c.id}
              className="card p-4"
              style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <div style={{
                    width: '1.5rem', height: '1.5rem', borderRadius: '50%',
                    backgroundColor: 'var(--accent)', color: '#fff',
                    fontSize: '0.6875rem', fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    {c.author.name.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {c.author.name}
                  </span>
                </div>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                  {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(c.createdAt).toLocaleDateString()}
                </span>
              </div>

              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6, paddingLeft: '2.125rem', whiteSpace: 'pre-wrap' }}>
                {c.content}
              </div>

              {c.attachments.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', paddingLeft: '2.125rem', paddingTop: '0.25rem' }}>
                  {c.attachments.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                        fontSize: '0.6875rem', padding: '0.25rem 0.5rem', borderRadius: '0.375rem',
                        backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)',
                        color: 'var(--accent)', textDecoration: 'none'
                      }}
                    >
                      <Paperclip size={10} />
                      Attachment {i + 1}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))
        )}

        {/* Comment Box */}
        <form onSubmit={submitComment} className="card p-4" style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <textarea
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            placeholder="Write a comment..."
            rows={3}
            className="input resize-none"
            style={{ fontSize: '0.8125rem', padding: '0.75rem', width: '100%' }}
          />

          {commentAttachments.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {commentAttachments.map((url, i) => (
                <span
                  key={i}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                    fontSize: '0.75rem', padding: '0.25rem 0.625rem', borderRadius: '0.5rem',
                    backgroundColor: 'var(--accent-subtle)', color: 'var(--accent)', fontWeight: 500
                  }}
                >
                  <Paperclip size={12} />
                  File {i + 1}
                  <button
                    type="button"
                    onClick={() => setCommentAttachments(prev => prev.filter((_, j) => j !== i))}
                    style={{ marginLeft: '0.25rem', color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.25rem' }}>
            <FileUpload onUpload={(urls) => setCommentAttachments(prev => [...prev, ...urls])} />
            <button
              type="submit"
              disabled={submitting || !commentText.trim()}
              className="btn-primary"
              style={{ fontSize: '0.75rem', padding: '0.5rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer' }}
            >
              <Send size={13} />
              {submitting ? 'Posting...' : 'Comment'}
            </button>
          </div>
        </form>
      </div>

    </div>
  )
}
