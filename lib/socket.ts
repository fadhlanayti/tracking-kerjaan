/** Safe socket emit — only works when server.mjs sets globalThis.__io */
export function emitSocket(room: string, event: string, data: unknown) {
  try {
    const io = (globalThis as any).__io
    if (io && typeof io.to === 'function') {
      io.to(room).emit(event, data)
    }
  } catch (e) {
    console.error('Socket emit error:', e)
  }
}
