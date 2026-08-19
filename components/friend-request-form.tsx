"use client"

import { useEffect, useState } from "react"
import { LoaderCircle, Search, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { sendFriendRequest } from "@/app/actions"
import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { authenticatedFetch } from "@/lib/authenticated-fetch"

type SearchProfile = {
  id: string
  handle: string
  nickname: string
  avatar_url: string | null
}

type SearchStatus = "idle" | "loading" | "done"

export function FriendRequestForm() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchProfile[]>([])
  const [searchStatus, setSearchStatus] = useState<SearchStatus>("idle")
  const [pendingHandle, setPendingHandle] = useState<string | null>(null)
  const normalizedHandle = query.trim().replace(/^@+/, "")

  useEffect(() => {
    if (!normalizedHandle) return

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void authenticatedFetch(`/api/friends/search?q=${encodeURIComponent(normalizedHandle)}`, { signal: controller.signal })
        .then(async (response) => {
          const result = await response.json() as { error?: string; profiles?: SearchProfile[] }
          if (controller.signal.aborted) return
          if (!response.ok) throw new Error(result.error || "아이디를 검색하지 못했습니다.")
          setResults(result.profiles || [])
          setSearchStatus("done")
        })
        .catch((error) => {
          if (controller.signal.aborted) return
          setResults([])
          setSearchStatus("done")
          toast.error(error instanceof Error ? error.message : "아이디를 검색하지 못했습니다.")
        })
    }, 250)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [normalizedHandle])

  async function requestFriend(handle: string) {
    setPendingHandle(handle)

    try {
      const formData = new FormData()
      formData.set("handle", handle)
      const result = await sendFriendRequest(formData)

      if (result.status === "sent") {
        setQuery("")
        setResults([])
        setSearchStatus("idle")
        toast.success(result.message)
      } else if (["already_sent", "incoming_pending", "already_friends"].includes(result.status)) {
        toast.info(result.message)
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "친구 요청을 보내지 못했습니다.")
    } finally {
      setPendingHandle(null)
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (normalizedHandle) void requestFriend(normalizedHandle)
  }

  function updateQuery(value: string) {
    const sanitized = value.toLowerCase().replace(/[^@a-z0-9_]/g, "")
    const nextQuery = sanitized.startsWith("@")
      ? `@${sanitized.slice(1).replace(/@/g, "")}`
      : sanitized.replace(/@/g, "")
    setQuery(nextQuery)
    setResults([])
    setSearchStatus(nextQuery.replace(/^@+/, "") ? "loading" : "idle")
  }

  return (
    <div>
      <form onSubmit={submit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="handle"
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
            placeholder="@아이디로 친구 검색"
            className="pl-9"
            maxLength={21}
            autoComplete="off"
            disabled={pendingHandle !== null}
            required
          />
        </div>
        <Button type="submit" className="gap-2" disabled={!normalizedHandle || pendingHandle !== null}>
          {pendingHandle === normalizedHandle ? <LoaderCircle className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
          {pendingHandle === normalizedHandle ? "요청 중..." : "친구 추가"}
        </Button>
      </form>

      {normalizedHandle && searchStatus !== "idle" && (
        <div className="mt-2 overflow-hidden rounded-xl border bg-card shadow-sm" aria-live="polite">
          {searchStatus === "loading" ? (
            <div className="flex items-center justify-center gap-2 px-4 py-5 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />아이디 검색 중...
            </div>
          ) : results.length ? (
            <ul className="divide-y">
              {results.map((profile) => {
                const name = profile.nickname || profile.handle
                const pending = pendingHandle === profile.handle
                return (
                  <li key={profile.id} className="flex items-center gap-3 px-3 py-2.5">
                    <UserAvatar name={name} imageUrl={profile.avatar_url} className="size-9" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{name}</p>
                      <p className="truncate text-xs text-muted-foreground">@{profile.handle}</p>
                    </div>
                    <Button type="button" size="xs" variant="outline" onClick={() => void requestFriend(profile.handle)} disabled={pendingHandle !== null}>
                      {pending ? <LoaderCircle className="animate-spin" /> : <UserPlus />}
                      {pending ? "요청 중" : "친구 추가"}
                    </Button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="px-4 py-5 text-center text-sm text-muted-foreground">일치하는 아이디가 없습니다.</p>
          )}
        </div>
      )}
    </div>
  )
}
