"use client"

import { Camera, LoaderCircle, LogOut, MonitorSmartphone, NotebookPen, Save, Trash2, Unplug } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useRef, useState } from "react"
import { toast } from "sonner"
import { authenticatedFetch } from "@/lib/authenticated-fetch"
import { ExtensionBrowserStatusPanel, useExtensionConnection } from "@/components/extension-browser-connection"
import { ProfileImageCropDialog } from "@/components/profile-image-crop-dialog"
import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MAX_EXTENSION_CONNECTIONS } from "@/lib/extension-connect"
import { registeredExtensionDevicesLabel, type ExtensionDevice } from "@/lib/extension-browser-connection"
import { isSupportedProfileImage, NICKNAME_MAX_LENGTH, PROFILE_BIO_MAX_LENGTH, PROFILE_IMAGE_INPUT_MAX_BYTES } from "@/lib/profile"
import { cn } from "@/lib/utils"
import { createClient } from "@/utils/supabase/client"

export type AccountUser = {
  id: string
  name: string
  handle: string
  bio: string
  problemMemoPromptEnabled: boolean
  avatarUrl: string | null
  extensionDevices: ExtensionDevice[] | null
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })
}

export function AccountDialog({ user }: { user: AccountUser }) {
  const router = useRouter()
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const { devices, recheck } = useExtensionConnection()
  const [nickname, setNickname] = useState(user.name)
  const [bio, setBio] = useState(user.bio)
  const [problemMemoPromptEnabled, setProblemMemoPromptEnabled] = useState(user.problemMemoPromptEnabled)
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl)
  const [avatarCropFile, setAvatarCropFile] = useState<File | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPreferences, setSavingPreferences] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [revokingDevice, setRevokingDevice] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSavingProfile(true)
    try {
      const response = await authenticatedFetch("/api/account", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nickname, bio }),
      })
      const result = await response.json() as { error?: string; nickname?: string; bio?: string }
      if (!response.ok || !result.nickname) return toast.error(result.error || "프로필을 변경하지 못했습니다.")
      setNickname(result.nickname)
      setBio(result.bio || "")
      toast.success("프로필을 변경했습니다.")
      router.refresh()
    } catch {
      toast.error("프로필을 변경하지 못했습니다.")
    } finally {
      setSavingProfile(false)
    }
  }

  const toggleProblemMemoPrompt = async () => {
    const nextEnabled = !problemMemoPromptEnabled
    setSavingPreferences(true)
    try {
      const response = await authenticatedFetch("/api/account/preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ problemMemoPromptEnabled: nextEnabled }),
      })
      const result = await response.json() as { error?: string; problemMemoPromptEnabled?: boolean }
      if (!response.ok || typeof result.problemMemoPromptEnabled !== "boolean") {
        return toast.error(result.error || "개인 설정을 변경하지 못했습니다.")
      }
      setProblemMemoPromptEnabled(result.problemMemoPromptEnabled)
      toast.success(result.problemMemoPromptEnabled ? "풀이 성공 후 문제 메모를 엽니다." : "문제 메모 자동 열기를 껐습니다.")
      router.refresh()
    } catch {
      toast.error("개인 설정을 변경하지 못했습니다.")
    } finally {
      setSavingPreferences(false)
    }
  }

  const selectAvatar = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!isSupportedProfileImage(file, PROFILE_IMAGE_INPUT_MAX_BYTES)) {
      event.target.value = ""
      return toast.error("JPG, PNG, WebP 형식의 5MB 이하 이미지를 선택해 주세요.")
    }
    setAvatarCropFile(file)
  }

  const uploadAvatar = async (optimizedFile: File) => {
    setUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.set("avatar", optimizedFile)
      const response = await authenticatedFetch("/api/account/avatar", { method: "POST", body: formData })
      const result = await response.json() as { error?: string; avatarUrl?: string }
      if (!response.ok || !result.avatarUrl) {
        toast.error(result.error || "프로필 사진을 업로드하지 못했습니다.")
        return false
      }
      setAvatarUrl(result.avatarUrl)
      toast.success("프로필 사진을 변경했습니다.")
      router.refresh()
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "프로필 사진을 업로드하지 못했습니다.")
      return false
    } finally {
      setUploadingAvatar(false)
    }
  }

  const closeAvatarCrop = useCallback(() => {
    setAvatarCropFile(null)
    if (avatarInputRef.current) avatarInputRef.current.value = ""
  }, [])

  const revokeDevice = async (installationId: string) => {
    setRevokingDevice(installationId)
    try {
      const response = await authenticatedFetch("/api/extension/devices", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ installationId }),
      })
      const result = await response.json()
      if (!response.ok) return toast.error(result.error || "기기 연결을 해제하지 못했습니다.")
      toast.success("선택한 기기의 연결을 해제했습니다.")
      recheck()
    } catch {
      toast.error("기기 연결을 해제하지 못했습니다.")
    } finally {
      setRevokingDevice(null)
    }
  }

  const deleteAccount = async () => {
    setDeleting(true)
    try {
      const response = await authenticatedFetch("/api/account", { method: "DELETE" })
      const body = await response.text()
      let result: { error?: string } = {}
      try { result = body ? JSON.parse(body) : {} } catch { /* Vercel timeout/error page */ }
      if (!response.ok) return toast.error(result.error || "탈퇴 처리에 실패했습니다.")
      await createClient().auth.signOut({ scope: "local" })
      window.location.replace("/login")
    } catch {
      toast.error("탈퇴 요청을 완료하지 못했습니다. 네트워크 상태를 확인해 주세요.")
    } finally {
      setDeleting(false)
    }
  }

  const logout = async () => {
    await createClient().auth.signOut({ scope: "local" })
    window.location.replace("/auth/signout")
  }

  return (
    <Dialog>
      <DialogTrigger render={<button type="button" className="rounded-full outline-none ring-ring focus-visible:ring-2" aria-label="마이페이지 열기" />}>
        <UserAvatar name={nickname} imageUrl={avatarUrl} className="size-10" />
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader><DialogTitle>마이페이지</DialogTitle><DialogDescription>프로필, 개인 설정과 확장 프로그램 연결 기기를 관리합니다.</DialogDescription></DialogHeader>

        <div className="rounded-2xl bg-muted/45 p-4">
          <div className="flex items-center gap-4">
            <UserAvatar name={nickname} imageUrl={avatarUrl} className="size-16" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{nickname}</p>
              <p className="truncate text-xs text-muted-foreground">아이디 · @{user.handle}</p>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={selectAvatar}
                disabled={uploadingAvatar}
                aria-label="프로필 사진 파일 선택"
              />
              <Button type="button" variant="outline" size="xs" className="mt-2" onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar}>
                {uploadingAvatar ? <LoaderCircle className="animate-spin" /> : <Camera />}
                {uploadingAvatar ? "처리 중" : "사진 변경"}
              </Button>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">원본 최대 5MB</p>

          <form className="mt-4 space-y-4" onSubmit={saveProfile}>
            <div className="space-y-2">
              <Label htmlFor="account-nickname">표시 이름</Label>
              <Input
                id="account-nickname"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                minLength={2}
                maxLength={NICKNAME_MAX_LENGTH}
                disabled={savingProfile}
                required
              />
              <p className="text-[11px] text-muted-foreground">친구와 스터디룸에 표시되는 2~20자의 이름입니다.</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="account-bio">한 줄 소개</Label>
                <span className="text-[11px] tabular-nums text-muted-foreground">{Array.from(bio).length}/{PROFILE_BIO_MAX_LENGTH}</span>
              </div>
              <Input
                id="account-bio"
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                maxLength={PROFILE_BIO_MAX_LENGTH}
                placeholder="나를 한 줄로 소개해 주세요."
                disabled={savingProfile}
              />
              <p className="text-[11px] text-muted-foreground">작성한 소개는 전체 랭킹의 닉네임 아래에 표시됩니다.</p>
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                disabled={savingProfile || (nickname.trim() === user.name && bio.trim() === user.bio)}
              >
                {savingProfile ? <LoaderCircle className="animate-spin" /> : <Save />}
                {savingProfile ? "저장 중" : "저장"}
              </Button>
            </div>
          </form>
        </div>

        <div className="rounded-2xl bg-muted/45 p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <NotebookPen className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">풀이 성공 시 문제 메모 열기</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">프로그래머스 풀이가 온라인으로 저장되면 바로 메모 작성 창을 엽니다.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={problemMemoPromptEnabled}
              aria-label="풀이 성공 시 문제 메모 열기"
              onClick={toggleProblemMemoPrompt}
              disabled={savingPreferences}
              className={cn(
                "relative h-7 w-12 shrink-0 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-wait disabled:opacity-60",
                problemMemoPromptEnabled ? "bg-primary" : "bg-muted-foreground/30",
              )}
            >
              <span className={cn(
                "absolute top-1 left-1 size-5 rounded-full bg-white shadow-sm transition-transform",
                problemMemoPromptEnabled && "translate-x-5",
              )} />
            </button>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">오프라인 대기열에 저장된 풀이는 나중에 동기화되더라도 메모 창을 열지 않습니다.</p>
        </div>

        <div className="rounded-2xl bg-muted/45 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{registeredExtensionDevicesLabel(devices?.length ?? null)}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">다른 브라우저에서 연결한 기기도 포함됩니다. 계정당 최대 {MAX_EXTENSION_CONNECTIONS}개까지 등록할 수 있습니다.</p>
            </div>
            <MonitorSmartphone className="size-5 shrink-0 text-muted-foreground" />
          </div>

          <ExtensionBrowserStatusPanel className="mt-3" />

          {devices === null ? (
            <p className="mt-3 rounded-xl bg-card p-3 text-xs text-muted-foreground">등록된 기기를 불러오지 못했습니다. 다시 확인을 눌러 주세요.</p>
          ) : devices.length ? (
            <div className="mt-3 space-y-2">
              {devices.map((device) => (
                <div key={device.installationId} className="flex items-center gap-3 rounded-xl bg-card p-3 shadow-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{device.deviceName}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {device.lastSeenAt ? `마지막 동기화 ${formatDate(device.lastSeenAt)}` : `연결 ${formatDate(device.connectedAt)}`}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0 text-destructive hover:text-destructive"
                    aria-label={`${device.deviceName} 연결 해제`}
                    onClick={() => revokeDevice(device.installationId)}
                    disabled={revokingDevice === device.installationId}
                  >
                    <Unplug className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-xl bg-card p-3 text-center text-xs text-muted-foreground">계정에 등록된 기기가 없습니다.</p>
          )}
        </div>

        <Button type="button" variant="outline" className="w-full" onClick={logout}><LogOut className="size-4" />로그아웃</Button>
        <div className="rounded-2xl bg-destructive/5 p-4 ring-1 ring-destructive/20">
          {!confirmDelete ? <Button type="button" variant="destructive" className="w-full" onClick={() => setConfirmDelete(true)}><Trash2 className="size-4" />회원 탈퇴</Button> : <div className="space-y-3"><p className="text-sm text-destructive">계정과 모든 풀이·친구·스터디 데이터가 삭제되며 복구할 수 없습니다.</p><div className="flex gap-2"><Button type="button" variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)} disabled={deleting}>취소</Button><Button type="button" variant="destructive" className="flex-1" onClick={deleteAccount} disabled={deleting}>{deleting ? "삭제 중..." : "영구 삭제"}</Button></div></div>}
        </div>
        {avatarCropFile && <ProfileImageCropDialog file={avatarCropFile} onCancel={closeAvatarCrop} onApply={uploadAvatar} />}
      </DialogContent>
    </Dialog>
  )
}
