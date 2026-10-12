import { createServer } from 'http'
import next from 'next'
import { Server } from 'socket.io'
import { createReadStream, existsSync, statSync } from 'fs'
import { join } from 'path'

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

const MIME_TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  zip: 'application/zip',
  mp4: 'video/mp4',
  webm: 'video/webm',
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
    const pathname = url.pathname

    // Directly serve /uploads/* from public/uploads at HTTP level
    if (pathname.startsWith('/uploads/')) {
      const filename = pathname.replace(/^\/uploads\//, '').replace(/[^a-zA-Z0-9._-]/g, '')
      const filePath = join(process.cwd(), 'public', 'uploads', filename)

      if (existsSync(filePath)) {
        const ext = filename.split('.').pop()?.toLowerCase() || ''
        const contentType = MIME_TYPES[ext] || 'application/octet-stream'
        const stat = statSync(filePath)

        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': stat.size,
          'Cache-Control': 'public, max-age=31536000, immutable',
        })
        createReadStream(filePath).pipe(res)
        return
      }
    }

    handle(req, res, url)
  })

  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  })

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)

    socket.on('join:project', ({ projectId, userId, userName }) => {
      socket.join(`project:${projectId}`)
      socket.data = { projectId, userId, userName }
    })

    socket.on('join:issue', ({ issueId }) => {
      socket.join(`issue:${issueId}`)
    })

    socket.on('message:send', (message) => {
      io.to(`project:${message.projectId}`).emit('message:new', message)
    })

    socket.on('issue:typing', ({ issueId, userId, name }) => {
      socket.to(`issue:${issueId}`).emit('user:typing', { issueId, userId, name })
    })

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id)
    })
  })

  // Make io accessible for API routes to emit events
  globalThis.__io = io

  const port = parseInt(process.env.PORT || '3000', 10)
  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`)
  })
})
