'use client'
import { useState, useEffect, use, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  AlertCircle,
  MessageSquare,
  Users,
  ArrowRight,
  Ticket,
  UserPlus,
  X,
  Check,
  Plus,
  Image as ImageIcon,
  Send,
  StickyNote,
  Clock,
  Sparkles,
  Loader2,
  Bug,
  CheckCircle2,
  Layers,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  UserCheck
} from 'lucide-react'
import { StatusBadge } from '@/components/status-badge'
import { findTechPreset, TechStackSelector } from '@/components/tech-stack-selector'
import { getSocket } from '@/lib/socket-client'
import { ProjectChatWidget } from '@/components/project-chat-widget'
import { useImageLightbox } from '@/components/image-lightbox'
import { MentionTextarea } from '@/components/mention-textarea'

interface Member {
  user: { id: string; name: string; email: string; role: string; avatar?: string | null }
  role: string
}

interface IssueRef {
  id: string
  title: string
  status: string
  priority: string
  createdAt: string
}

interface TimelineLog {
  id: string
  content: string
  notes?: string | null
  status?: 'DO' | 'DOING' | 'DONE' | null
  attachments: string[]
  createdAt: string
  author: { id: string; name: string; role: string; avatar?: string }
}

interface ProjectUpdate {
  id: string
  title: string
  content: string | null
  notes: string | null
  status: 'DO' | 'DOING' | 'DONE'
  attachments: string[]
  createdAt: string
  author: { id: string; name: string; role: string; avatar?: string }
  assignedTo?: { id: string; name: string; role: string; avatar?: string } | null
  assignedToId?: string | null
  issues: IssueRef[]
  timelineLogs?: TimelineLog[]
}

interface Project {
  id: string
  name: string
  description: string | null
  repository: string | null
  techStack: string | null
  status: string
  _count: { issues: number }
  members: Member[]
  createdBy: { id: string; name: string }
}

interface User {
  id: string
  name: string
  email: string
  role: string
}

const roleStyle: Record<string, { avatar: string; badge: string }> = {
  ADMIN:     { avatar: '#202524', badge: '#F3F4F6' },
  PM:        { avatar: '#202524', badge: '#F3F4F6' },
  DEVELOPER: { avatar: '#087CF0', badge: 'rgba(8,124,240,0.1)' },
  CLIENT:    { avatar: '#D9F3EC', badge: '#D9F3EC' },
}
const roleTxt: Record<string, { avatar: string; badge: string }> = {
  ADMIN:     { avatar: '#fff', badge: '#202524' },
  PM:        { avatar: '#fff', badge: '#202524' },
  DEVELOPER: { avatar: '#fff', badge: '#087CF0' },
  CLIENT:    { avatar: '#0E7490', badge: '#0E7490' },
}

function renderDescriptionWithLinks(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = text.split(urlRegex)

  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[#38BDF8] hover:text-[#7DD3FC] underline underline-offset-2 break-all transition-colors"
          onClick={e => e.stopPropagation()}
        >
          <span>{part}</span>
          <ExternalLink size={11} className="shrink-0" />
        </a>
      )
    }
    return part
  })
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: session } = useSession()
  const { openImage } = useImageLightbox()
  const [project, setProject] = useState<Project | null>(null)
  const [updates, setUpdates] = useState<ProjectUpdate[]>([])
  const [loading, setLoading] = useState(true)
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const isChatOpenRef = useRef(isChatOpen)
  useEffect(() => {
    isChatOpenRef.current = isChatOpen
    if (isChatOpen) setUnreadCount(0)
  }, [isChatOpen])
  const [expandedUpdateIds, setExpandedUpdateIds] = useState<Record<string, boolean>>({})

  function toggleUpdateExpand(updateId: string) {
    setExpandedUpdateIds(prev => ({
      ...prev,
      [updateId]: !prev[updateId],
    }))
  }

  // Member management state
  const [showAddMember, setShowAddMember] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRole, setSelectedRole] = useState<'DEVELOPER' | 'CLIENT' | 'PM'>('DEVELOPER')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  // Edit Project state
  const [showEditProjectModal, setShowEditProjectModal] = useState(false)
  const [editProjectName, setEditProjectName] = useState('')
  const [editProjectDescription, setEditProjectDescription] = useState('')
  const [editProjectRepository, setEditProjectRepository] = useState('')
  const [editProjectTechStack, setEditProjectTechStack] = useState('')
  const [editProjectStatus, setEditProjectStatus] = useState('ACTIVE')
  const [submittingEditProject, setSubmittingEditProject] = useState(false)

  function openEditProjectModal() {
    if (!project) return
    setEditProjectName(project.name)
    setEditProjectDescription(project.description || '')
    setEditProjectRepository(project.repository || '')
    setEditProjectTechStack(project.techStack || '')
    setEditProjectStatus(project.status)
    setShowEditProjectModal(true)
  }

  async function handleSaveProject(e: React.FormEvent) {
    e.preventDefault()
    if (!editProjectName.trim() || submittingEditProject) return

    setSubmittingEditProject(true)
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editProjectName.trim(),
          description: editProjectDescription.trim(),
          repository: editProjectRepository.trim() || null,
          techStack: editProjectTechStack.trim() || null,
          status: editProjectStatus,
        }),
      })

      if (res.ok) {
        const updated = await res.json()
        setProject(prev => prev ? { ...prev, ...updated } : updated)
        setShowEditProjectModal(false)
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'Gagal menyimpan perubahan project')
      }
    } catch (err) {
      console.error(err)
      alert('Terjadi kesalahan saat menyimpan project')
    } finally {
      setSubmittingEditProject(false)
    }
  }

  // Create / Edit Update state (For Developers)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [editingUpdateId, setEditingUpdateId] = useState<string | null>(null)
  const [updateTitle, setUpdateTitle] = useState('')
  const [updateContent, setUpdateContent] = useState('')
  const [updateNotes, setUpdateNotes] = useState('')
  const [updateStatus, setUpdateStatus] = useState<'DO' | 'DOING' | 'DONE'>('DOING')
  const [updateAssigneeId, setUpdateAssigneeId] = useState('')
  const [updateImages, setUpdateImages] = useState<string[]>([])
  const [updatePendingFiles, setUpdatePendingFiles] = useState<{ file: File; preview: string }[]>([])
  const [submittingUpdate, setSubmittingUpdate] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto remove from R2 helper
  async function deleteR2Image(url: string) {
    try {
      await fetch('/api/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
    } catch (e) {
      console.error('Failed to delete image from R2', e)
    }
  }

  function startEditUpdate(up: ProjectUpdate) {
    setEditingUpdateId(up.id)
    setUpdateTitle(up.title)
    setUpdateContent(up.content || '')
    setUpdateNotes(up.notes || '')
    setUpdateStatus(up.status)
    setUpdateAssigneeId(up.assignedToId || '')
    setUpdateImages(up.attachments || [])
    updatePendingFiles.forEach(f => URL.revokeObjectURL(f.preview))
    setUpdatePendingFiles([])
    setShowUpdateModal(true)
  }

  async function cancelUpdateModal() {
    updatePendingFiles.forEach(f => URL.revokeObjectURL(f.preview))
    setUpdatePendingFiles([])
    setEditingUpdateId(null)
    setUpdateTitle('')
    setUpdateContent('')
    setUpdateNotes('')
    setUpdateImages([])
    setShowUpdateModal(false)
  }

  async function cancelIssueModal() {
    issuePendingFiles.forEach(f => URL.revokeObjectURL(f.preview))
    setIssuePendingFiles([])
    setIssueTitle('')
    setIssueDescription('')
    setIssueImages([])
    setIssueModalUpdate(null)
  }

  // Create Issue Modal state
  const [issueModalUpdate, setIssueModalUpdate] = useState<ProjectUpdate | null>(null)
  const [issueTitle, setIssueTitle] = useState('')
  const [issueDescription, setIssueDescription] = useState('')
  const [issuePriority, setIssuePriority] = useState('MEDIUM')
  const [issueImages, setIssueImages] = useState<string[]>([])
  const [issuePendingFiles, setIssuePendingFiles] = useState<{ file: File; preview: string }[]>([])
  const [submittingIssue, setSubmittingIssue] = useState(false)
  const issueFileInputRef = useRef<HTMLInputElement>(null)

  // Sub-update / Timeline Log state
  const [activeLogUpdateId, setActiveLogUpdateId] = useState<string | null>(null)
  const [logContent, setLogContent] = useState('')
  const [logNotes, setLogNotes] = useState('')
  const [logStatus, setLogStatus] = useState<'DO' | 'DOING' | 'DONE' | ''>('')
  const [logPendingFiles, setLogPendingFiles] = useState<{ file: File; preview: string }[]>([])
  const [submittingLog, setSubmittingLog] = useState(false)
  const logFileInputRef = useRef<HTMLInputElement>(null)

  // Fetch project details & updates
  function fetchProject() {
    fetch(`/api/projects/${id}`)
      .then(r => r.json())
      .then(data => { setProject(data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  const [updatesLoading, setUpdatesLoading] = useState(true)

  function fetchUpdates() {
    fetch(`/api/projects/${id}/updates`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setUpdates(data)
        setUpdatesLoading(false)
      })
      .catch(() => setUpdatesLoading(false))
  }

  useEffect(() => {
    fetchProject()
    fetchUpdates()
  }, [id])

  // Socket.IO Realtime integration
  useEffect(() => {
    if (!id) return
    const socket = getSocket()
    socket.emit('join:project', {
      projectId: id,
      userId: session?.user?.id,
      userName: session?.user?.name,
    })

    function handleNewUpdate(newUpdate: ProjectUpdate) {
      setUpdates(prev => {
        // Cegah duplikasi jika sudah ada id yang sama atau update optimistic (temp-)
        const exists = prev.some(u => u.id === newUpdate.id)
        if (exists) return prev

        const tempIndex = prev.findIndex(u => u.id.startsWith('temp-') && u.title === newUpdate.title)
        if (tempIndex !== -1) {
          const next = [...prev]
          next[tempIndex] = { ...newUpdate, timelineLogs: next[tempIndex].timelineLogs || newUpdate.timelineLogs || [] }
          return next
        }

        return [newUpdate, ...prev]
      })
    }

    function handleStatusUpdate(updatedRecord: ProjectUpdate) {
      setUpdates(prev => prev.map(u => u.id === updatedRecord.id ? updatedRecord : u))
    }

    function handleDeleteUpdate(deleted: { id: string }) {
      setUpdates(prev => prev.filter(u => u.id !== deleted.id))
    }

    function handleNewIssue(newIssue: any) {
      fetchProject()
      fetchUpdates()
    }

    function handleUpdateLog(data: { updateId: string, log: TimelineLog }) {
      setUpdates(prev => prev.map(up => {
        if (up.id === data.updateId) {
          const exists = up.timelineLogs?.find(l => l.id === data.log.id)
          if (exists) return up
          return {
            ...up,
            timelineLogs: [data.log, ...(up.timelineLogs || [])]
          }
        }
        return up
      }))
    }

    function handleChatMessage(message: any) {
      if (!isChatOpenRef.current && message?.sender?.id !== session?.user?.id) {
        setUnreadCount(prev => prev + 1)
      }
    }

    function handleProjectUpdated(updatedProj: Project) {
      setProject(prev => prev ? { ...prev, ...updatedProj } : updatedProj)
    }

    socket.on('project:update:new', handleNewUpdate)
    socket.on('project:update:status', handleStatusUpdate)
    socket.on('project:update:delete', handleDeleteUpdate)
    socket.on('project:updated', handleProjectUpdated)
    socket.on('issue:new', handleNewIssue)
    socket.on('project:update:log', handleUpdateLog)
    socket.on('message:new', handleChatMessage)

    return () => {
      socket.off('project:update:new', handleNewUpdate)
      socket.off('project:update:status', handleStatusUpdate)
      socket.off('project:update:delete', handleDeleteUpdate)
      socket.off('project:updated', handleProjectUpdated)
      socket.off('issue:new', handleNewIssue)
      socket.off('project:update:log', handleUpdateLog)
      socket.off('message:new', handleChatMessage)
    }
  }, [id, session])

  const isAdmin = session?.user?.role === 'ADMIN'
  const isPM = project?.members.some(m => m.user.id === session?.user?.id && m.role === 'PM')
  const isPMorAdmin = isAdmin || isPM
  const isDev = session?.user?.role === 'DEVELOPER' || isAdmin || isPM || project?.members.some(m => m.user.id === session?.user?.id && m.role === 'DEVELOPER')

  useEffect(() => {
    if (!isAdmin) return
    fetch('/api/users')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setAllUsers(data) })
      .catch(() => {})
  }, [isAdmin])

  async function addMember(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedUserId) return
    setAdding(true)
    setAddError('')

    const user = allUsers.find(u => u.id === selectedUserId)
    if (user && project) {
      // Optimistic
      setProject(prev => prev ? {
        ...prev,
        members: [...prev.members, { user: { id: user.id, name: user.name, email: user.email, role: user.role }, role: selectedRole }]
      } : prev)
      setShowAddMember(false)
      setSelectedUserId('')
    }

    try {
      const res = await fetch(`/api/projects/${id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserId, role: selectedRole }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setAddError(data.error || 'Gagal menambahkan member')
        fetchProject() // rollback
      }
    } catch {
      fetchProject()
    }
    setAdding(false)
  }

  // Handle Multiple Image Upload to Cloudflare R2
  // Instant thumbnail preview without uploading immediately
  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>, target: 'update' | 'issue') {
    const files = e.target.files
    if (!files || files.length === 0) return
    const fileList = Array.from(files)

    const newPending = fileList.map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }))

    if (target === 'update') {
      setUpdatePendingFiles(prev => [...prev, ...newPending])
    } else {
      setIssuePendingFiles(prev => [...prev, ...newPending])
    }
    if (e.target) e.target.value = ''
  }

  // Submit Progress Update (Developer) — Instant Optimistic UI
  async function handleCreateUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!updateTitle.trim()) return

    const isEditing = !!editingUpdateId
    const currentTitle = updateTitle.trim()
    const currentContent = updateContent.trim()
    const currentNotes = updateNotes.trim()
    const currentStatus = updateStatus
    const currentAssigneeId = updateAssigneeId
    const currentPending = [...updatePendingFiles]
    const currentExistingImages = [...updateImages]
    const tempId = isEditing ? editingUpdateId : `temp-${Date.now()}`

    // Optimistic Update: langsung tampilkan di UI seketika
    if (isEditing) {
      setUpdates(prev => prev.map(u => {
        if (u.id !== editingUpdateId) return u
        return {
          ...u,
          title: currentTitle,
          content: currentContent || null,
          notes: currentNotes || null,
          status: currentStatus,
          assignedToId: currentAssigneeId || u.assignedToId,
          attachments: [...currentExistingImages, ...currentPending.map(p => p.preview)],
        }
      }))
    } else {
      const assignedUser = project?.members.find(m => m.user.id === currentAssigneeId)?.user || null
      const optimisticItem: ProjectUpdate = {
        id: tempId,
        author: {
          id: session?.user?.id || '',
          name: session?.user?.name || 'Saya',
          role: session?.user?.role || 'DEVELOPER',
        },
        assignedTo: assignedUser ? {
          id: assignedUser.id,
          name: assignedUser.name,
          role: (assignedUser as any).role || 'DEVELOPER',
        } : null,
        assignedToId: currentAssigneeId || session?.user?.id || null,
        status: currentStatus,
        title: currentTitle,
        content: currentContent || null,
        notes: currentNotes || null,
        attachments: currentPending.map(p => p.preview),
        createdAt: new Date().toISOString(),
        timelineLogs: [],
        issues: [],
      }
      setUpdates(prev => [optimisticItem, ...prev])
    }

    // Langsung tutup modal tanpa delay
    setShowUpdateModal(false)
    setEditingUpdateId(null)
    setUpdateTitle('')
    setUpdateContent('')
    setUpdateNotes('')
    setUpdateImages([])
    setUpdatePendingFiles([])

    // Proses upload & simpan di background
    try {
      const newlyUploadedUrls: string[] = []
      for (const { file } of currentPending) {
        try {
          const formData = new FormData()
          formData.append('file', file)
          const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          })
          const data = await res.json()
          if (data.url) newlyUploadedUrls.push(data.url)
        } catch { /* skip */ }
      }

      const allAttachments = [...currentExistingImages, ...newlyUploadedUrls]
      const res = await fetch(`/api/projects/${id}/updates`, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(isEditing ? { updateId: tempId } : {}),
          title: currentTitle,
          content: currentContent,
          notes: currentNotes,
          status: currentStatus,
          assignedToId: currentAssigneeId || undefined,
          attachments: allAttachments,
        }),
      })

      if (res.ok) {
        const saved = await res.json()
        setUpdates(prev => prev.map(u => u.id === tempId ? { ...saved, timelineLogs: saved.timelineLogs || u.timelineLogs || [] } : u))
      }
      currentPending.forEach(f => URL.revokeObjectURL(f.preview))
    } catch (err) {
      console.error(err)
    }
  }

  // Quick update status from card — Instant Optimistic
  async function handleQuickStatusChange(updateId: string, newStatus: 'DO' | 'DOING' | 'DONE') {
    // Ubah UI seketika
    setUpdates(prev => prev.map(u => u.id === updateId ? { ...u, status: newStatus } : u))

    try {
      const res = await fetch(`/api/projects/${id}/updates`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updateId, status: newStatus }),
      })
      if (res.ok) {
        const updated = await res.json()
        setUpdates(prev => prev.map(u => u.id === updateId ? updated : u))
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Delete progress update — Instant Optimistic Deletion
  async function handleDeleteUpdate(updateId: string) {
    if (!window.confirm('Yakin ingin menghapus progress update ini?')) return
    // Hapus dari UI seketika
    setUpdates(prev => prev.filter(u => u.id !== updateId))

    try {
      await fetch(`/api/projects/${id}/updates`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updateId }),
      })
    } catch (e) {
      console.error(e)
    }
  }

  // Add timeline log to progress update — Instant Optimistic
  async function handleAddLog(updateId: string) {
    if (!logContent.trim()) return

    const currentLogContent = logContent.trim()
    const currentLogNotes = logNotes.trim()
    const currentLogStatus = logStatus
    const currentFiles = [...logPendingFiles]
    const tempLogId = `temp-log-${Date.now()}`

    const optimisticLog: TimelineLog = {
      id: tempLogId,
      content: currentLogContent,
      notes: currentLogNotes || null,
      status: currentLogStatus || null,
      attachments: currentFiles.map(f => f.preview),
      createdAt: new Date().toISOString(),
      author: {
        id: session?.user?.id || '',
        name: session?.user?.name || 'Saya',
        role: session?.user?.role || 'DEVELOPER',
      },
    }

    // Update UI seketika
    setUpdates(prev => prev.map(u => {
      if (u.id !== updateId) return u
      return {
        ...u,
        status: currentLogStatus ? (currentLogStatus as any) : u.status,
        timelineLogs: [optimisticLog, ...(u.timelineLogs || [])],
      }
    }))

    // Reset input seketika
    setLogContent('')
    setLogNotes('')
    setLogStatus('')
    setLogPendingFiles([])
    setActiveLogUpdateId(null)
    if (logFileInputRef.current) logFileInputRef.current.value = ''

    try {
      const uploadedUrls: string[] = []
      for (const { file } of currentFiles) {
        try {
          const formData = new FormData()
          formData.append('file', file)
          const res = await fetch('/api/upload', { method: 'POST', body: formData })
          const data = await res.json()
          if (data.url) uploadedUrls.push(data.url)
        } catch {}
      }

      const res = await fetch(`/api/projects/${id}/updates/${updateId}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: currentLogContent,
          notes: currentLogNotes || undefined,
          status: currentLogStatus || undefined,
          attachments: uploadedUrls,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        currentFiles.forEach(({ preview }) => URL.revokeObjectURL(preview))
        setUpdates(prev => prev.map(u => {
          if (u.id !== updateId) return u
          return { ...data.update, timelineLogs: data.update.timelineLogs ?? [] }
        }))
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Just create blob preview — no upload yet
  function handleLogImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    const newFiles = Array.from(files).map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }))
    setLogPendingFiles(prev => [...prev, ...newFiles])
    if (logFileInputRef.current) logFileInputRef.current.value = ''
  }

  // Submit Issue from Progress Update — Optimistic
  async function handleCreateIssue(e: React.FormEvent) {
    e.preventDefault()
    if (!issueTitle.trim() || !issueModalUpdate) return

    const currentTitle = issueTitle.trim()
    const currentDesc = issueDescription.trim()
    const currentPriority = issuePriority
    const currentUpdateId = issueModalUpdate.id
    const currentFiles = [...issuePendingFiles]
    const currentExistingImages = [...issueImages]
    const tempIssueId = `temp-issue-${Date.now()}`

    // Optimistic: add to update's issues, close modal
    setUpdates(prev => prev.map(u => {
      if (u.id !== currentUpdateId) return u
      return {
        ...u,
        issues: [...(u.issues || []), {
          id: tempIssueId,
          title: currentTitle,
          status: 'OPEN',
          priority: currentPriority,
          createdAt: new Date().toISOString(),
        }],
      }
    }))
    setIssueTitle('')
    setIssueDescription('')
    setIssueImages([])
    setIssuePendingFiles([])
    setIssueModalUpdate(null)

    // Upload & save in background
    try {
      const newlyUploadedUrls: string[] = []
      for (const { file } of currentFiles) {
        try {
          const formData = new FormData()
          formData.append('file', file)
          const res = await fetch('/api/upload', { method: 'POST', body: formData })
          const data = await res.json()
          if (data.url) newlyUploadedUrls.push(data.url)
        } catch {}
      }

      const allAttachments = [...currentExistingImages, ...newlyUploadedUrls]
      const res = await fetch(`/api/projects/${id}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: currentTitle,
          description: currentDesc,
          priority: currentPriority,
          attachments: allAttachments,
          projectUpdateId: currentUpdateId,
        }),
      })

      if (res.ok) {
        currentFiles.forEach(f => URL.revokeObjectURL(f.preview))
        fetchProject()
        fetchUpdates()
      }
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) return <div className="loading-state !text-black font-semibold">Loading...</div>
  if (!project) return <div style={{ color: 'var(--red)' }}>Project not found</div>

  const memberIds = new Set(project.members.map(m => m.user.id))
  const availableUsers = allUsers.filter(u => !memberIds.has(u.id))

  async function handleDeleteProject() {
    if (!window.confirm('Yakin ingin menghapus project ini? Semua data terkait (issues, progress, chat) akan ikut terhapus.')) return
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/projects')
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'Gagal menghapus project')
      }
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-6 w-full px-1 sm:px-0 pb-24 sm:pb-28">

      {/* Project Header Banner (Apple-Inspired Premium Card) */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#242426] to-[#1A1A1C] text-white shadow-xl border border-white/10 p-5 sm:p-7">
        {/* Subtle background glow */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-[#0071E3]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col gap-5">
          {/* Top row: Avatar + Title + Status + Action button */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <div className="flex items-center justify-center text-white text-2xl font-bold shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0071E3] to-[#0051A8] shadow-lg shadow-blue-500/25 border border-white/20">
                {project.name[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 flex flex-col gap-3.5">
                {/* 1. Baris Judul Project */}
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white truncate">
                    {project.name}
                  </h1>
                  <StatusBadge value={project.status} />
                  {project.repository && (
                    <a
                      href={project.repository.startsWith('http') ? project.repository : `https://${project.repository}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-sky-400/20 text-sky-300 hover:bg-sky-400/30 border border-sky-400/30 transition-colors"
                    >
                      <span>Repository</span>
                      <ExternalLink size={10} />
                    </a>
                  )}
                </div>

                {/* 2. Baris Badge Tech Stack */}
                {project.techStack && (
                  <div className="flex items-center gap-2 flex-wrap py-0.5">
                    {project.techStack.split(',').map(s => s.trim()).filter(Boolean).map(techName => {
                      const preset = findTechPreset(techName)
                      const displayName = preset ? preset.name : techName.replace(/\.+$/, '')
                      return (
                        <span
                          key={techName}
                          className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-white text-zinc-950 border border-zinc-200 shadow-sm"
                        >
                          {preset ? (
                            <span style={{ color: preset.accent }} className="flex items-center shrink-0">
                              {preset.icon}
                            </span>
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                          )}
                          <span>{displayName}</span>
                        </span>
                      )
                    })}
                  </div>
                )}

                {/* 3. Baris Deskripsi Project */}
                {project.description && (
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed break-words">
                    {renderDescriptionWithLinks(project.description)}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              {isPMorAdmin && (
                <button
                  onClick={openEditProjectModal}
                  className="inline-flex items-center gap-1.5 font-medium bg-white/10 hover:bg-white/20 text-white border border-white/20 hover:border-white/30 px-3 py-1.5 rounded-full transition-all cursor-pointer text-xs"
                  title="Edit project"
                >
                  <Edit2 size={13} />
                  <span>Edit Project</span>
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={handleDeleteProject}
                  className="inline-flex items-center gap-1.5 font-medium bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-300 border border-white/10 hover:border-red-500/30 px-3 py-1.5 rounded-full transition-all cursor-pointer text-xs"
                  title="Hapus project"
                >
                  <Trash2 size={13} />
                  <span>Hapus</span>
                </button>
              )}
            </div>
          </div>

          {/* Bottom stats row */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap pt-4 border-t border-white/10 text-xs text-white">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-sm text-white">
              <AlertCircle size={14} className="text-orange-400 shrink-0" />
              <span className="text-white/90">Issues:</span>
              <span className="font-semibold text-white">{project._count.issues}</span>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-sm text-white">
              <Layers size={14} className="text-blue-400 shrink-0" />
              <span className="text-white/90">Updates:</span>
              <span className="font-semibold text-white">{updates.length}</span>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-sm text-white">
              <Users size={14} className="text-emerald-400 shrink-0" />
              <span className="text-white/90">Members:</span>
              <span className="font-semibold text-white">{project.members.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <Link
          href={`/projects/${id}/issues`}
          className="card p-4 sm:p-5 flex items-center justify-between no-underline group hover:border-[#0071E3]/40 hover:shadow-md transition-all active:scale-[0.99]"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-orange-500/10 text-orange-600 border border-orange-500/20 group-hover:bg-orange-500/15 transition-colors">
              <AlertCircle size={22} />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900 group-hover:text-[#0071E3] transition-colors">Issue Tracker</p>
              <p className="text-xs text-zinc-500 mt-0.5">{project._count.issues} Total issues terdaftar</p>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-zinc-100 group-hover:bg-[#0071E3] group-hover:text-white text-zinc-500 transition-all">
            <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        <Link
          href={`/projects/${id}/tickets`}
          className="card p-4 sm:p-5 flex items-center justify-between no-underline group hover:border-purple-500/40 hover:shadow-md transition-all active:scale-[0.99]"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-purple-500/10 text-purple-600 border border-purple-500/20 group-hover:bg-purple-500/15 transition-colors">
              <Ticket size={22} />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900 group-hover:text-purple-600 transition-colors">Tiket Permintaan</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {isDev
                  ? 'Permintaan klien yang telah disetujui PM'
                  : session?.user?.role === 'CLIENT'
                  ? 'Ajukan kebutuhan, fitur baru, dan perubahan'
                  : 'Kurasi permintaan klien & persetujuan rilis'}
              </p>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-zinc-100 group-hover:bg-purple-600 group-hover:text-white text-zinc-500 transition-all">
            <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>
      </div>

      {/* Main Content Layout: Progress Updates (Col 1) & Team Members (Col 2) */}
      <div className={`grid grid-cols-1 ${session?.user?.role !== 'CLIENT' ? 'lg:grid-cols-[2.7fr_1.3fr]' : ''} gap-5 sm:gap-6 items-start`}>

        {/* Column 1: Progress Updates */}
        <div className="flex flex-col gap-4 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-[#00060c]" />
              <h2 className="text-base font-bold text-zinc-900">Feature Updates & Progress</h2>
            </div>
            {isDev && (
              <button
                onClick={() => setShowUpdateModal(true)}
                className="btn-primary text-xs"
              >
                <Plus size={14} /> Post Progress
              </button>
            )}
          </div>

          {/* List of Updates */}
          {updatesLoading ? (
            <div className="card flex items-center justify-center text-zinc-400" style={{ padding: '3.5rem 2rem', minHeight: '12rem' }}>
              <Loader2 size={24} className="animate-spin text-[#0071E3]" />
            </div>
          ) : updates.length === 0 ? (
            <div className="card flex flex-col items-center justify-center text-center" style={{ padding: '3.5rem 2rem', minHeight: '20rem', gap: '0.75rem' }}>
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#0071E3] flex items-center justify-center" style={{ marginBottom: '0.5rem' }}>
                <Layers size={30} />
              </div>
              <p className="text-base font-bold text-zinc-900">Belum ada update progress</p>
              <p className="text-sm text-zinc-500" style={{ maxWidth: '26rem', lineHeight: '1.6' }}>
                Developer dapat mendokumentasikan fitur atau perbaikan yang selesai dikerjakan di sini.
              </p>
              {isDev && (
                <button
                  onClick={() => setShowUpdateModal(true)}
                  className="btn-primary"
                  style={{ marginTop: '0.75rem' }}
                >
                  <Plus size={16} /> Mulai Update Pertama
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3.5">
              {updates.map(up => (
                <div key={up.id} className="card p-4 sm:p-5 flex flex-col transition-all">

                  {/* Update Header (Clickable Accordion) */}
                  <div
                    onClick={() => toggleUpdateExpand(up.id)}
                    className="cursor-pointer select-none"
                  >
                    <div className="flex items-start gap-3">
                      {/* Chevron toggle */}
                      <div className="text-zinc-400 hover:text-zinc-700 transition-colors shrink-0 mt-1">
                        {expandedUpdateIds[up.id] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </div>

                      {/* Author Avatar */}
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs text-white shrink-0 bg-gradient-to-br from-[#0071E3] to-[#0051A8] shadow-xs overflow-hidden">
                        {up.author.avatar ? (
                          <img src={up.author.avatar} alt={up.author.name} className="w-full h-full object-cover" />
                        ) : (
                          up.author.name[0].toUpperCase()
                        )}
                      </div>

                      {/* Main Info Column */}
                      <div className="min-w-0 flex-1 flex flex-col gap-2">
                        {/* Row 1: Title + Action Buttons */}
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-sm font-bold text-zinc-900 leading-snug break-words">
                            {up.title}
                          </h3>

                          {/* Action Buttons Top-Right */}
                          <div
                            onClick={e => e.stopPropagation()}
                            className="flex items-center gap-1.5 shrink-0"
                          >
                            {(isAdmin || up.author.id === session?.user?.id) && (
                              <button
                                onClick={() => startEditUpdate(up)}
                                className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-sky-600 bg-sky-50 hover:bg-sky-100 transition-colors border border-sky-200/80 cursor-pointer shadow-2xs"
                                title="Edit progress"
                              >
                                <Edit2 size={13} />
                              </button>
                            )}

                            {isAdmin && (
                              <button
                                onClick={() => {
                                  setIssueModalUpdate(up)
                                  setIssueTitle(`Issue: ${up.title}`)
                                  setIssueDescription('')
                                  setIssueImages([])
                                }}
                                className="h-7 px-2 rounded-lg inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors border border-amber-200/80 cursor-pointer shadow-2xs"
                                title="Lapor Issue"
                              >
                                <Bug size={12} />
                                <span className="hidden sm:inline text-[11px]">Issue</span>
                              </button>
                            )}

                            {(isAdmin || up.author.id === session?.user?.id) && (
                              <button
                                onClick={() => handleDeleteUpdate(up.id)}
                                className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors border border-rose-200/80 cursor-pointer shadow-2xs"
                                title="Hapus progress"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Row 2: Metadata Badges (Author, Status, Date, Assignee) */}
                        <div className="flex items-center flex-wrap gap-2 text-xs">
                          {/* Author badge */}
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-md">
                            <span>oleh</span>
                            <span className="font-semibold text-zinc-900 truncate max-w-[140px]">{up.author.name}</span>
                          </span>

                          {/* Status Badge */}
                          {up.status && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 uppercase tracking-wide ${
                              up.status === 'DONE'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/90'
                                : up.status === 'DOING'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200/90'
                                : 'bg-orange-50 text-orange-700 border border-orange-200/90'
                            }`}>
                              {up.status}
                            </span>
                          )}

                          {/* Created at */}
                          <span className="inline-flex items-center gap-1 text-zinc-500 text-[11px]">
                            <Clock size={11} className="text-zinc-400 shrink-0" />
                            <span>{new Date(up.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                          </span>

                          {/* Assigned to */}
                          {up.assignedTo && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-blue-800 bg-blue-50/90 border border-blue-200/70 px-2 py-0.5 rounded-md">
                              <UserCheck size={11} className="text-[#0071E3] shrink-0" />
                              <span className="text-blue-600">Ditugaskan:</span>
                              <span className="font-semibold">{up.assignedTo.name}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Collapsible Detail — Clean Unified Timeline */}
                  {expandedUpdateIds[up.id] && (
                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>

                      {/* Status toggle */}
                      {isDev && (up.assignedToId === session?.user?.id || isAdmin) && (
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 p-2 rounded-xl" style={{ marginBottom: '1rem' }}>
                          <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider ml-1">Status:</span>
                          <div className="flex bg-white rounded-lg border border-slate-200 p-0.5 shadow-sm">
                            {(['DO', 'DOING', 'DONE'] as const).map(st => {
                              const isSelected = up.status === st
                              const activeClass =
                                st === 'DO'
                                  ? 'bg-orange-500 text-white shadow-sm'
                                  : st === 'DONE'
                                  ? 'bg-emerald-600 text-white shadow-sm'
                                  : 'bg-[#0071E3] text-white shadow-sm'
                              return (
                                <button
                                  key={st}
                                  onClick={() => handleQuickStatusChange(up.id, st)}
                                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                                    isSelected ? activeClass : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100'
                                  }`}
                                >
                                  {st}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* === Unified vertical timeline (scrollable) === */}
                      <div style={{ position: 'relative', paddingLeft: '1.75rem', maxHeight: '32rem', overflowY: 'auto' }}>
                        {/* Vertical line — runs full height */}
                        <div style={{ position: 'absolute', left: '9px', top: 0, bottom: 0, width: '2px', background: '#e4e4e7' }} />

                        {/* Node: Content (desc) + foto progress + catatan */}
                        {(up.content || (up.attachments && up.attachments.length > 0) || up.notes) && (
                          <div style={{ position: 'relative', paddingBottom: '1.25rem' }}>
                            <div style={{ position: 'absolute', left: '-1.75rem', top: '4px', width: '10px', height: '10px', borderRadius: '50%', background: '#a1a1aa' }} />
                            {up.content && (
                              <p className="text-sm whitespace-pre-wrap leading-relaxed text-zinc-700">{up.content}</p>
                            )}
                            {/* Foto progress — di bawah desc */}
                            {up.attachments && up.attachments.length > 0 && (
                              <div className="flex gap-2 flex-wrap" style={{ marginTop: up.content ? '0.625rem' : 0 }}>
                                {up.attachments.map((imgUrl, i) => (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={() => openImage(imgUrl)}
                                    className="block rounded-xl overflow-hidden border border-black/5 hover:opacity-90 shadow-sm cursor-pointer p-0 bg-transparent"
                                  >
                                    <img src={imgUrl} alt="progress" className="w-24 sm:w-28 object-cover" style={{ height: '4.5rem' }} />
                                  </button>
                                ))}
                              </div>
                            )}
                            {/* Catatan — di bawah foto */}
                            {up.notes && (
                              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-zinc-50 border border-zinc-200/60" style={{ marginTop: '0.625rem' }}>
                                <StickyNote size={13} className="text-zinc-400 shrink-0 mt-0.5" />
                                <p className="text-xs text-zinc-600 whitespace-pre-wrap">{up.notes}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Nodes: Timeline Logs */}
                        {up.timelineLogs && up.timelineLogs.length > 0 && (
                          [...up.timelineLogs].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map(log => (
                            <div key={log.id} style={{ position: 'relative', paddingBottom: '1.25rem' }}>
                              {/* Dot */}
                              <div style={{
                                position: 'absolute', left: '-1.75rem', top: '3px', width: '12px', height: '12px', borderRadius: '50%',
                                background: log.status === 'DONE' ? '#22c55e' : log.status === 'DO' ? '#fb923c' : log.status === 'DOING' ? '#0071E3' : '#d4d4d8',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                {log.status === 'DONE' && (
                                  <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                )}
                              </div>
                              {/* Content */}
                              <p className="text-sm text-zinc-800 leading-relaxed">{log.content}</p>
                              {/* Log images */}
                              {log.attachments && log.attachments.length > 0 && (
                                <div className="flex flex-wrap gap-2" style={{ marginTop: '0.5rem' }}>
                                  {log.attachments.map((imgUrl: string, i: number) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => openImage(imgUrl)}
                                      className="block rounded-xl overflow-hidden border border-black/5 hover:opacity-90 shadow-sm cursor-pointer p-0 bg-transparent"
                                    >
                                      <img src={imgUrl} alt={`log ${i+1}`} className="w-28 h-20 sm:w-36 sm:h-24 object-cover" />
                                    </button>
                                  ))}
                                </div>
                              )}
                              {/* Log notes */}
                              {log.notes && (
                                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-zinc-50 border border-zinc-200/60" style={{ marginTop: '0.5rem' }}>
                                  <StickyNote size={13} className="text-zinc-400 shrink-0 mt-0.5" />
                                  <p className="text-xs text-zinc-600 whitespace-pre-wrap">{log.notes}</p>
                                </div>
                              )}
                              {/* Meta */}
                              <div className="flex items-center gap-2" style={{ marginTop: '0.375rem' }}>
                                <span className="text-[11px] font-medium text-zinc-500">{log.author.name}</span>
                                <span className="text-[10px] text-zinc-300">·</span>
                                <span className="text-[11px] text-zinc-400">
                                  {new Date(log.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {log.status && (
                                  <>
                                    <span className="text-[10px] text-zinc-300">·</span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                      log.status === 'DONE' ? 'bg-emerald-100 text-emerald-700' :
                                      log.status === 'DO' ? 'bg-orange-100 text-orange-700' :
                                      'bg-blue-100 text-blue-700'
                                    }`}>{log.status}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          ))
                        )}

                        {/* Node: Add log form or button */}
                        {isDev && (
                          <div style={{ position: 'relative', paddingBottom: '0.5rem' }}>
                            <div style={{ position: 'absolute', left: '-1.75rem', top: '3px', width: '12px', height: '12px', borderRadius: '50%', background: activeLogUpdateId === up.id ? '#0071E3' : '#e4e4e7' }} />
                            {activeLogUpdateId === up.id ? (
                              <div className="flex flex-col gap-2.5 p-3.5 rounded-xl" style={{ background: 'rgba(0,113,227,0.04)', border: '1.5px solid rgba(0,113,227,0.2)' }}>
                                <MentionTextarea
                                  value={logContent}
                                  onChange={v => setLogContent(v)}
                                  rows={3}
                                  members={project.members.map(m => ({ id: m.user.id, name: m.user.name, avatar: m.user.avatar, role: m.role }))}
                                  placeholder="Tulis update progress... (@nama untuk tag)"
                                  className="input text-sm"
                                  style={{ background: '#fff' }}
                                />
                                <textarea
                                  value={logNotes}
                                  onChange={e => setLogNotes(e.target.value)}
                                  rows={2}
                                  placeholder="Catatan tambahan (opsional)..."
                                  className="input text-sm"
                                  style={{ background: '#fff' }}
                                />
                                {logPendingFiles.length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {logPendingFiles.map((item, i) => (
                                      <div key={i} className="relative group">
                                        <img src={item.preview} alt="" className="w-20 h-16 object-cover rounded-lg border border-black/5 shadow-sm" />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            URL.revokeObjectURL(item.preview)
                                            setLogPendingFiles(prev => prev.filter((_, idx) => idx !== i))
                                          }}
                                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity border-none cursor-pointer p-0 shadow"
                                        >
                                          <X size={10} />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-1.5">
                                    {(['DO', 'DOING', 'DONE'] as const).map(st => (
                                      <button
                                        key={st}
                                        type="button"
                                        onClick={() => setLogStatus(logStatus === st ? '' : st)}
                                        className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all ${
                                          logStatus === st
                                            ? st === 'DO' ? 'bg-orange-500 text-white' : st === 'DONE' ? 'bg-emerald-500 text-white' : 'bg-[#0071E3] text-white'
                                            : 'text-zinc-500 bg-zinc-200/70 hover:bg-zinc-200'
                                        }`}
                                      >
                                        {st}
                                      </button>
                                    ))}
                                    <button
                                      type="button"
                                      onClick={() => logFileInputRef.current?.click()}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-100 hover:bg-violet-200 text-violet-700 transition-colors border-none cursor-pointer"
                                    >
                                      <ImageIcon size={13} />
                                      Foto
                                    </button>
                                    <input ref={logFileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleLogImageUpload} />
                                  </div>
                                  <div className="flex gap-1.5">
                                    <button type="button" onClick={() => { logPendingFiles.forEach(f => URL.revokeObjectURL(f.preview)); setActiveLogUpdateId(null); setLogContent(''); setLogNotes(''); setLogStatus(''); setLogPendingFiles([]) }} className="btn-secondary text-xs py-1 px-3">
                                      Batal
                                    </button>
                                    <button type="button" disabled={submittingLog || !logContent.trim()} onClick={() => handleAddLog(up.id)} className="btn-primary text-xs py-1 px-3">
                                      {submittingLog ? <Loader2 size={13} className="animate-spin" /> : <Send size={12} />}
                                      Kirim
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => { setActiveLogUpdateId(up.id); setLogContent(''); setLogNotes(''); setLogStatus(''); setLogPendingFiles([]) }}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0071E3] hover:text-blue-700 cursor-pointer bg-transparent border-none p-0"
                              >
                                <Plus size={14} /> Tambah Update
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* === Footer: Issues only — below timeline === */}
                      {up.issues && up.issues.length > 0 && (
                        <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block" style={{ marginBottom: '0.5rem' }}>
                            Issues Terkait ({up.issues.length})
                          </span>
                          <div className="flex flex-col gap-1.5">
                            {up.issues.map(iss => (
                              <Link
                                key={iss.id}
                                href={`/projects/${id}/issues/${iss.id}`}
                                className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-50 hover:bg-zinc-100 transition-colors no-underline text-xs"
                              >
                                <span className="font-medium text-zinc-800 truncate mr-2">{iss.title}</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  iss.status === 'RESOLVED' || iss.status === 'CLOSED'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-rose-100 text-rose-700'
                                }`}>
                                  {iss.status}
                                </span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  )}

                </div>
              ))}
            </div>
          )}
        </div>

        {/* Column 2: Team Members — hidden from Client */}
        {session?.user?.role !== 'CLIENT' && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-4 sm:px-5 py-3.5 border-b border-zinc-100">
            <Users size={16} className="text-[#0071E3]" />
            <h2 className="text-sm font-semibold text-zinc-900">Team Members</h2>
            <span className="text-xs text-zinc-400 ml-auto">{project.members.length}</span>
            {isAdmin && (
              <button
                onClick={() => setShowAddMember(!showAddMember)}
                className="btn-primary text-xs ml-2"
                style={{ padding: '0.3rem 0.75rem' }}
              >
                <UserPlus size={13} /> Add
              </button>
            )}
          </div>

          {/* Add member form */}
          {showAddMember && (
            <form onSubmit={addMember} style={{
              padding: '1rem',
              borderBottom: '1px solid var(--border)',
              backgroundColor: '#FFFFFF',
              display: 'flex', flexDirection: 'column', gap: '0.75rem'
            }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Tambah Member</p>
              <select
                value={selectedUserId}
                onChange={e => setSelectedUserId(e.target.value)}
                className="input text-xs"
                required
              >
                <option value="">Pilih user...</option>
                {availableUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
              <select
                value={selectedRole}
                onChange={e => setSelectedRole(e.target.value as any)}
                className="input text-xs"
              >
                <option value="DEVELOPER">Developer</option>
                <option value="CLIENT">Client</option>
                <option value="PM">PM</option>
              </select>
              <div className="flex gap-2">
                <button type="submit" disabled={adding || !selectedUserId} className="btn-primary text-xs flex-1">
                  <Check size={14} /> Tambah
                </button>
                <button type="button" onClick={() => { setShowAddMember(false); setAddError('') }} className="btn-secondary text-xs">
                  <X size={14} />
                </button>
              </div>
              {addError && <p className="text-xs" style={{ color: 'var(--red)' }}>{addError}</p>}
            </form>
          )}

          <div>
            {project.members.map((m, i) => {
              const rs = roleStyle[m.role] || roleStyle['CLIENT']
              const rt = roleTxt[m.role] || roleTxt['CLIENT']
              return (
                <div
                  key={m.user.id}
                  className="flex items-center gap-3 px-5 py-3"
                  style={{ borderBottom: i < project.members.length - 1 ? '1px solid var(--border)' : 'none' }}
                >
                  <div
                    className="flex items-center justify-center text-xs font-semibold shrink-0"
                    style={{ width: '2rem', height: '2rem', borderRadius: '50%', backgroundColor: rs.avatar, color: rt.avatar }}
                  >
                    {m.user.name[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{m.user.name}</p>
                    <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{m.user.email}</p>
                  </div>
                  <span
                    className="text-[10px] font-semibold"
                    style={{ backgroundColor: rs.badge, color: rt.badge, padding: '0.2rem 0.5rem', borderRadius: '0.375rem' }}
                  >
                    {m.role}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
        )}

      </div>

      {/* Modal: Post Progress Update (Developer Only) */}
      {showUpdateModal && (
        <div className="apple-modal-overlay">
          <div className="apple-modal-sheet relative" style={{ padding: '0 1.75rem 1.5rem' }}>
            <div className="sheet-handle" />
            <button
              onClick={cancelUpdateModal}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 border-none bg-transparent cursor-pointer transition-colors"
              style={{ zIndex: 1 }}
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 pb-5 mb-5 border-b border-zinc-100" style={{ paddingTop: '1rem' }}>
              <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900 leading-tight">
                  {editingUpdateId ? 'Edit Progress Fitur' : 'Update Progress Fitur'}
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {editingUpdateId ? 'Perbarui detail, catatan, atau status progress fitur.' : 'Catat kemajuan pekerjaan atau fitur yang telah selesai.'}
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateUpdate} className="flex flex-col gap-4 overflow-y-auto max-h-[70vh] pr-1">
              <div>
                <label className="label text-xs font-semibold mb-2 block">Judul Fitur / Update</label>
                <input
                  type="text"
                  placeholder="Contoh: Selesai Integrasi Gateway Pembayaran"
                  value={updateTitle}
                  onChange={e => setUpdateTitle(e.target.value)}
                  required
                  className="input text-sm"
                />
              </div>

              {/* Status Radio Check Chips */}
              <div>
                <label className="label text-xs font-semibold mb-1.5 block">Status Progress</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'DO', label: 'DO', desc: 'Belum dimulai', color: 'orange' },
                    { id: 'DOING', label: 'DOING', desc: 'Sedang dikerjakan', color: 'blue' },
                    { id: 'DONE', label: 'DONE', desc: 'Selesai', color: 'emerald' },
                  ].map(s => {
                    const isSelected = updateStatus === s.id
                    const selectedStyles =
                      s.id === 'DO'
                        ? 'bg-orange-50 border-orange-500 text-orange-700 shadow-sm'
                        : s.id === 'DONE'
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-700 shadow-sm'
                        : 'bg-blue-50 border-[#0071E3] text-[#0071E3] shadow-sm'

                    const checkBg =
                      s.id === 'DO'
                        ? 'bg-orange-500 border-orange-500 text-white'
                        : s.id === 'DONE'
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'bg-[#0071E3] border-[#0071E3] text-white'

                    return (
                      <button
                        type="button"
                        key={s.id}
                        onClick={() => setUpdateStatus(s.id as any)}
                        className={`p-2.5 rounded-xl text-left border cursor-pointer transition-all flex flex-col justify-between ${
                          isSelected
                            ? selectedStyles
                            : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100/70'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-bold">{s.id}</span>
                          <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border ${
                            isSelected ? checkBg : 'border-zinc-300 bg-white'
                          }`}>
                            {isSelected && <Check size={10} strokeWidth={3} />}
                          </div>
                        </div>
                        <span className="text-[10px] text-zinc-500 mt-1 truncate">{s.desc}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="label text-xs font-semibold mb-1.5 block">Assignee (Penanggung Jawab)</label>
                <select
                  value={updateAssigneeId}
                  onChange={e => setUpdateAssigneeId(e.target.value)}
                  className="input text-sm"
                >
                  <option value="">Saya sendiri</option>
                  {project.members
                    .filter(m => m.role === 'DEVELOPER' || m.role === 'PM')
                    .map(m => (
                    <option key={m.user.id} value={m.user.id}>
                      {m.user.name} ({m.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label text-xs font-semibold mb-1.5 block">Keterangan / Rincian Progress</label>
                <textarea
                  rows={2}
                  placeholder="Jelaskan apa saja yang telah dikerjakan..."
                  value={updateContent}
                  onChange={e => setUpdateContent(e.target.value)}
                  className="input text-sm resize-none"
                />
              </div>

              <div>
                <label className="label text-xs font-semibold mb-1.5 block">Notes Tambahan (Opsional)</label>
                <textarea
                  rows={2}
                  placeholder="Catatan teknis, testing guide..."
                  value={updateNotes}
                  onChange={e => setUpdateNotes(e.target.value)}
                  className="input text-sm resize-none"
                />
              </div>

              {/* Upload Screenshots */}
              <div>
                <label className="label text-xs font-semibold mb-1.5 block">Lampirkan Screenshot / Foto</label>
                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  onChange={e => handleImageUpload(e, 'update')}
                  accept="image/*"
                  className="hidden"
                />

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-secondary text-xs"
                    style={{ padding: '0.4rem 0.75rem' }}
                  >
                    <ImageIcon size={13} />
                    <span>Pilih Foto</span>
                  </button>

                  {/* Thumbnail yang sudah ada (edit mode) */}
                  {updateImages.map((url, idx) => (
                    <div key={`existing-${idx}`} className="relative w-11 h-11 rounded-lg border border-zinc-200 overflow-hidden group">
                      <img src={url} alt="thumb" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          deleteR2Image(url)
                          setUpdateImages(prev => prev.filter((_, i) => i !== idx))
                        }}
                        className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity border-none cursor-pointer"
                        title="Hapus foto"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}

                  {/* Instant local blob thumbnail preview */}
                  {updatePendingFiles.map((p, idx) => (
                    <div key={`pending-${idx}`} className="relative w-11 h-11 rounded-lg border border-blue-200 overflow-hidden group shadow-xs">
                      <img src={p.preview} alt="preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          URL.revokeObjectURL(p.preview)
                          setUpdatePendingFiles(prev => prev.filter((_, i) => i !== idx))
                        }}
                        className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity border-none cursor-pointer"
                        title="Hapus foto"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-2 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={cancelUpdateModal}
                  className="btn-secondary text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingUpdate || !updateTitle.trim()}
                  className="btn-primary text-xs"
                >
                  {submittingUpdate
                    ? 'Menyimpan...'
                    : editingUpdateId
                    ? 'Simpan Perubahan'
                    : 'Posting Progress'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Issue from Update */}
      {issueModalUpdate && (
        <div className="apple-modal-overlay">
          <div className="apple-modal-sheet relative" style={{ padding: '0 1.75rem 1.5rem' }}>
            <div className="sheet-handle" />
            <button
              onClick={cancelIssueModal}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 border-none bg-transparent cursor-pointer transition-colors"
              style={{ zIndex: 1 }}
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 pb-5 mb-5 border-b border-zinc-100" style={{ paddingTop: '1rem' }}>
              <div className="w-9 h-9 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Bug size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900 leading-tight">Laporkan Issue</h3>
                <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-[280px] sm:max-w-md">
                  Mengaitkan ke: <span className="font-semibold text-zinc-800">"{issueModalUpdate.title}"</span>
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateIssue} className="flex flex-col gap-4 overflow-y-auto max-h-[70vh] pr-1">
              <div>
                <label className="label text-xs font-semibold mb-2 block">Judul Masalah / Bug</label>
                <input
                  type="text"
                  value={issueTitle}
                  onChange={e => setIssueTitle(e.target.value)}
                  required
                  className="input text-sm"
                />
              </div>

              <div>
                <label className="label text-xs font-semibold mb-1.5 block">Deskripsi Masalah</label>
                <textarea
                  rows={3}
                  placeholder="Jelaskan kendala atau langkah mereproduksi..."
                  value={issueDescription}
                  onChange={e => setIssueDescription(e.target.value)}
                  required
                  className="input text-sm resize-none"
                />
              </div>

              {/* Priority Radio Check Chips */}
              <div>
                <label className="label text-xs font-semibold mb-1.5 block">Prioritas</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: 'LOW', label: 'Low', color: 'text-zinc-600' },
                    { id: 'MEDIUM', label: 'Medium', color: 'text-blue-600' },
                    { id: 'HIGH', label: 'High', color: 'text-amber-600' },
                    { id: 'URGENT', label: 'Urgent', color: 'text-rose-600' },
                  ].map(p => {
                    const isSelected = issuePriority === p.id
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => setIssuePriority(p.id)}
                        className={`py-2 px-1 rounded-xl text-center border cursor-pointer transition-all flex flex-col items-center justify-center gap-1 ${
                          isSelected
                            ? 'bg-blue-50/70 border-[#0071E3] text-[#0071E3] font-bold shadow-sm'
                            : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100/70'
                        }`}
                      >
                        <span className={`text-xs ${p.color}`}>{p.label}</span>
                        <div className={`w-3 h-3 rounded-full flex items-center justify-center border ${
                          isSelected ? 'bg-[#0071E3] border-[#0071E3] text-white' : 'border-zinc-300 bg-white'
                        }`}>
                          {isSelected && <Check size={8} strokeWidth={3} />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="label text-xs font-semibold mb-1.5 block">Lampirkan Bukti / Gambar Issue</label>
                <input
                  type="file"
                  multiple
                  ref={issueFileInputRef}
                  onChange={e => handleImageUpload(e, 'issue')}
                  accept="image/*"
                  className="hidden"
                />

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => issueFileInputRef.current?.click()}
                    className="btn-secondary text-xs"
                    style={{ padding: '0.4rem 0.75rem' }}
                  >
                    <ImageIcon size={13} />
                    <span>Pilih Foto</span>
                  </button>

                  {issueImages.map((url, idx) => (
                    <div key={`existing-${idx}`} className="relative w-11 h-11 rounded-lg border border-zinc-200 overflow-hidden group">
                      <img src={url} alt="issue thumb" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          deleteR2Image(url)
                          setIssueImages(prev => prev.filter((_, i) => i !== idx))
                        }}
                        className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity border-none cursor-pointer"
                        title="Hapus foto"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}

                  {issuePendingFiles.map((p, idx) => (
                    <div key={`pending-${idx}`} className="relative w-11 h-11 rounded-lg border border-blue-200 overflow-hidden group shadow-xs">
                      <img src={p.preview} alt="preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          URL.revokeObjectURL(p.preview)
                          setIssuePendingFiles(prev => prev.filter((_, i) => i !== idx))
                        }}
                        className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity border-none cursor-pointer"
                        title="Hapus foto"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-2 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={cancelIssueModal}
                  className="btn-secondary text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingIssue || !issueTitle.trim()}
                  className="btn-primary text-xs"
                >
                  {submittingIssue ? 'Mengirim...' : 'Kirim Issue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Discussion Trigger Button (Compact Circular FAB) */}
      {!isChatOpen && (
        <button
          type="button"
          onClick={() => {
            setIsChatOpen(true)
            setUnreadCount(0)
          }}
          aria-label="Buka Live Discussion"
          title="Project Discussion"
          className="fixed bottom-6 right-6 z-40 flex items-center justify-center w-14 h-14 rounded-full text-white shadow-xl hover:shadow-2xl transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer border-none group"
          style={{
            background: 'linear-gradient(135deg, #0071E3 0%, #087CF0 100%)',
            boxShadow: '0 8px 24px rgba(0, 113, 227, 0.4)',
          }}
        >
          <div className="relative flex items-center justify-center">
            <MessageSquare size={22} className="stroke-[2.2] transition-transform group-hover:scale-110" />
            {unreadCount > 0 && (
              <span className="absolute -top-3.5 -right-3.5 min-w-[22px] h-[22px] px-1 rounded-full bg-rose-500 text-white text-[11px] font-extrabold flex items-center justify-center border-2 border-white animate-bounce shadow-md">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
        </button>
      )}

      {/* Floating Chat Widget */}
      <ProjectChatWidget
        projectId={id}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        members={project.members.map(m => ({ id: m.user.id, name: m.user.name, avatar: m.user.avatar, role: m.role }))}
      />

      {/* Modal: Edit Project */}
      {showEditProjectModal && (
        <div className="apple-modal-overlay">
          <div className="apple-modal-sheet relative" style={{ padding: '0 1.75rem 1.5rem', maxWidth: 520 }}>
            <div className="sheet-handle" />
            <button
              onClick={() => setShowEditProjectModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 border-none bg-transparent cursor-pointer transition-colors"
              style={{ zIndex: 1 }}
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 pb-5 mb-5 border-b border-zinc-100" style={{ paddingTop: '1rem' }}>
              <div className="w-10 h-10 rounded-2xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center shrink-0">
                <Edit2 size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900 leading-tight">Edit Detail Project</h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Ubah nama, deskripsi, atau status kelangsungan project
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveProject} className="flex flex-col gap-4 overflow-y-auto max-h-[70vh] pr-1">
              <div>
                <label className="label text-xs font-semibold mb-1.5 block">Nama Project</label>
                <input
                  type="text"
                  value={editProjectName}
                  onChange={e => setEditProjectName(e.target.value)}
                  placeholder="Nama project..."
                  required
                  className="input text-sm"
                />
              </div>

              <div>
                <label className="label text-xs font-semibold mb-1.5 block">Status Project</label>
                <select
                  value={editProjectStatus}
                  onChange={e => setEditProjectStatus(e.target.value)}
                  className="input text-sm font-medium"
                >
                  <option value="ACTIVE">Aktif (ACTIVE)</option>
                  <option value="ON_HOLD">Tertunda (ON_HOLD)</option>
                  <option value="COMPLETED">Selesai (COMPLETED)</option>
                  <option value="ARCHIVED">Diarsipkan (ARCHIVED)</option>
                </select>
              </div>

              <div>
                <label className="label text-xs font-semibold mb-1.5 block">Repository URL</label>
                <input
                  type="url"
                  value={editProjectRepository}
                  onChange={e => setEditProjectRepository(e.target.value)}
                  placeholder="https://github.com/..."
                  className="input text-sm"
                />
              </div>

              <div>
                <label className="label text-xs font-semibold mb-1.5 block">Pilih Tech Stack</label>
                <TechStackSelector
                  value={editProjectTechStack}
                  onChange={setEditProjectTechStack}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label text-xs font-semibold block">Deskripsi Project</label>
                  <span className="text-[11px] text-zinc-400">Link URL otomatis aktif</span>
                </div>
                <textarea
                  rows={4}
                  value={editProjectDescription}
                  onChange={e => setEditProjectDescription(e.target.value)}
                  placeholder="Deskripsi singkat atau link dokumen / Figma / repository (opsional)..."
                  className="input text-sm resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 mt-2 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowEditProjectModal(false)}
                  className="btn-secondary text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingEditProject || !editProjectName.trim()}
                  className="btn-primary text-xs"
                >
                  {submittingEditProject ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
