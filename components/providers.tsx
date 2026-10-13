'use client'
2import { SessionProvider } from 'next-auth/react'
3import { createContext, useContext, useState, useCallback } from 'react'
4import { ImageLightboxProvider } from './image-lightbox'
5
6const SidebarCtx = createContext({ open: false, toggle: () => {} })
7export const useSidebar = () => useContext(SidebarCtx)
8
9export function Providers({ children }: { children: React.ReactNode }) {
10  const [open, setOpen] = useState(false)
11  const toggle = useCallback(() => setOpen(o => !o), [])
12
13  return (
14    <SessionProvider>
15      <ImageLightboxProvider>
16        <SidebarCtx.Provider value={{ open, toggle }}>
17          {children}
18        </SidebarCtx.Provider>
19      </ImageLightboxProvider>
20    </SessionProvider>
21  )
22}
23