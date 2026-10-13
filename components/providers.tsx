'use client'
import { SessionProvider } from 'next-auth/react'
import { createContext, useContext, useState, useCallback } from 'react'
import { ImageLightboxProvider } from './image-lightbox'

const SidebarCtx = createContext({ open: false, toggle: () => {} })
export const useSidebar = () => useContext(SidebarCtx)

export function Providers({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const toggle = useCallback(() => setOpen(o => !o), [])

  return (
    <SessionProvider>
      <ImageLightboxProvider>
        <SidebarCtx.Provider value={{ open, toggle }}>
          {children}
        </SidebarCtx.Provider>
      </ImageLightboxProvider>
    </SessionProvider>
  )
}
