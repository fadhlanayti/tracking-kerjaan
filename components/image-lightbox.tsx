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
          className="fixed inset-0 z-9999 flex flex-col bg-black/90 backdrop-blur-md animate-in fade-in duration-150 select-none"
          onClick={closeImage}
        >
          {/* Header Bar - terpisah dari area gambar */}
          <div
            className="w-full h-14 flex items-center justify-between px-4 sm:px-6 shrink-0 z-50 bg-black/40"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-white/70 text-xs sm:text-sm font-medium truncate max-w-[50vw]">
              {activeImage.alt && activeImage.alt !== 'Preview' ? activeImage.alt : ''}
            </div>

            {/* Pill Toolbar Kontras Tinggi */}
            <div className="flex items-center gap-1.5 bg-zinc-900/95 border border-zinc-700/80 px-2.5 py-1 rounded-full shadow-2xl">
              <button
                type="button"
                onClick={() => setScale(s => Math.min(s + 0.25, 3))}
                className="w-8 h-8 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer border-none bg-transparent"
                title="Zoom In"
              >
                <ZoomIn size={16} />
              </button>
              <button
                type="button"
                onClick={() => setScale(s => Math.max(s - 0.25, 0.75))}
                className="w-8 h-8 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer border-none bg-transparent"
                title="Zoom Out"
              >
                <ZoomOut size={16} />
              </button>
              {scale !== 1 && (
                <button
                  type="button"
                  onClick={() => setScale(1)}
                  className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer border-none"
                  title="Reset Zoom"
                >
                  {Math.round(scale * 100)}%
                </button>
              )}
              <div className="w-px h-4 bg-zinc-700 mx-1" />
              <a
                href={activeImage.url}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Download file asli"
              >
                <Download size={16} />
              </a>
              <button
                type="button"
                onClick={closeImage}
                className="w-8 h-8 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition-colors cursor-pointer border-none ml-1 shadow-sm"
                title="Tutup (Esc)"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Area Gambar - flex-1 min-h-0 mencegah gambar menimpa header */}
          <div
            className="flex-1 min-h-0 w-full flex items-center justify-center p-3 sm:p-6 overflow-hidden"
            onClick={closeImage}
          >
            <div
              className="relative max-w-full max-h-full flex items-center justify-center"
              onClick={e => e.stopPropagation()}
            >
              <img
                src={activeImage.url}
                alt={activeImage.alt || 'Preview'}
                style={{ transform: `scale(${scale})`, transition: 'transform 0.15s ease' }}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
            </div>
          </div>
        </div>
      )}
    </ImageLightboxContext.Provider>
  )
}
