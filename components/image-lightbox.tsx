'use client'
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { X, ZoomIn, ZoomOut, Download } from 'lucide-react'

interface ImageLightboxContextType {
  openImage: (url: string, alt?: string) => void
  closeImage: () => void
}

const ImageLightboxContext = createContext<ImageLightboxContextType>({
  openImage: () => {},
  closeImage: () => {},
})

export const useImageLightbox = () => useContext(ImageLightboxContext)

export function ImageLightboxProvider({ children }: { children: React.ReactNode }) {
  const [activeImage, setActiveImage] = useState<{ url: string; alt?: string } | null>(null)
  const [scale, setScale] = useState(1)

  const openImage = useCallback((url: string, alt?: string) => {
    setActiveImage({ url, alt })
    setScale(1)
  }, [])

  const closeImage = useCallback(() => {
    setActiveImage(null)
    setScale(1)
  }, [])

  useEffect(() => {
    if (!activeImage) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeImage()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeImage, closeImage])

  return (
    <ImageLightboxContext.Provider value={{ openImage, closeImage }}>
      {children}
      {activeImage && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-150 select-none"
          onClick={closeImage}
        >
          {/* Top Actions */}
          <div
            className="absolute top-4 right-4 z-10 flex items-center gap-2"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setScale(s => Math.min(s + 0.25, 3))}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all border border-white/10 cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn size={16} />
            </button>
            <button
              type="button"
              onClick={() => setScale(s => Math.max(s - 0.25, 0.75))}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all border border-white/10 cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut size={16} />
            </button>
            <a
              href={activeImage.url}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all border border-white/10 cursor-pointer"
              title="Buka / Download file asli"
            >
              <Download size={16} />
            </a>
            <button
              type="button"
              onClick={closeImage}
              className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-all border border-white/20 cursor-pointer ml-1"
              title="Tutup (Esc)"
            >
              <X size={18} />
            </button>
          </div>

          {/* Image Container */}
          <div
            className="relative max-w-full max-h-full flex items-center justify-center overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <img
              src={activeImage.url}
              alt={activeImage.alt || 'Preview'}
              style={{ transform: `scale(${scale})`, transition: 'transform 0.15s ease' }}
              className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}
    </ImageLightboxContext.Provider>
  )
}
