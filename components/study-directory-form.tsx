"use client"

import { LoaderCircle, Search } from "lucide-react"
import { useRouter } from "next/navigation"
import { createContext, useContext, useEffect, useRef, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { studyDirectoryHref } from "@/lib/study-directory-view"

const StudyDirectoryPendingContext = createContext(false)

export function StudyDirectoryForm({ children, className }: { children: React.ReactNode; className?: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const pendingRef = useRef(false)

  useEffect(() => {
    if (!pending) pendingRef.current = false
  }, [pending])

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pendingRef.current) return
    const formData = new FormData(event.currentTarget)
    const destination = studyDirectoryHref({
      field: formData.get("field"),
      query: formData.get("query"),
      minDifficulty: formData.get("minDifficulty"),
      view: formData.get("view"),
    })
    const currentParams = new URLSearchParams(window.location.search)
    const currentDestination = studyDirectoryHref({
      field: currentParams.get("field"),
      query: currentParams.get("query"),
      page: currentParams.get("page"),
      minDifficulty: currentParams.get("minDifficulty"),
      view: currentParams.get("view"),
    })
    if (currentDestination === destination) return

    pendingRef.current = true
    startTransition(() => router.push(destination))
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
