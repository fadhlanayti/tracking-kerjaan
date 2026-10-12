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
    const proto = (req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim()
    const url = new URL(req.url, `${proto}://${req.headers.host || 'localhost'}`)
    const pathname = url.pathname

    // If client requested via HTTPS, ensure any redirect Location header uses https://
    if (proto === 'https') {
      const origSetHeader = res.setHeader.bind(res)
      res.setHeader = function(name, value) {
        if (typeof name === 'string' && name.toLowerCase() === 'location' && typeof value === 'string') {
          if (value.startsWith('http://')) {
            value = value.replace('http://', 'https://')
          }
        }
        return origSetHeader(name, value)
      }

      const origWriteHead = res.writeHead.bind(res)
      res.writeHead = function(statusCode, ...args) {
        let headers = args[args.length - 1]
        if (headers && typeof headers === 'object' && !Array.isArray(headers)) {
          for (const key of Object.keys(headers)) {
            if (key.toLowerCase() === 'location' && typeof headers[key] === 'string') {
              if (headers[key].startsWith('http://')) {
                headers[key] = headers[key].replace('http://', 'https://')
              }
            }
          }
        }
        const currentLoc = res.getHeader('location')
        if (typeof currentLoc === 'string' && currentLoc.startsWith('http://')) {
          res.setHeader('location', currentLoc.replace('http://', 'https://'))
        }
        return origWriteHead(statusCode, ...args)
      }
    }

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
