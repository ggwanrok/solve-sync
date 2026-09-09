"use client"

import { LoaderCircle, Search } from "lucide-react"
import { useRouter } from "next/navigation"
import { createContext, useContext, useRef, useState } from "react"
import { Button } from "@/components/ui/button"

const StudyDirectoryPendingContext = createContext(false)

export function StudyDirectoryForm({ children, className }: { children: React.ReactNode; className?: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pendingRef.current) return
    const params = new URLSearchParams()

    for (const [key, value] of new FormData(event.currentTarget)) {
      if (typeof value === "string" && value) params.append(key, value)
    }

    const query = params.toString()
    const destination = query ? `/study?${query}` : "/study"
    if (`${window.location.pathname}${window.location.search}` === destination) return

    pendingRef.current = true
    setPending(true)
    router.push(destination)
  }

  return (
    <StudyDirectoryPendingContext.Provider value={pending}>
      <form onSubmit={submit} className={className} aria-busy={pending}>{children}</form>
    </StudyDirectoryPendingContext.Provider>
  )
}

export function StudyDirectorySubmitButton({ className }: { className?: string }) {
  const pending = useContext(StudyDirectoryPendingContext)
  return (
    <Button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? <LoaderCircle className="animate-spin" /> : <Search />}
      {pending ? "검색 중" : "검색"}
    </Button>
  )
}
