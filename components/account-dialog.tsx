"use client"

import { Camera, LoaderCircle, LogOut, MonitorSmartphone, Save, Trash2, Unplug } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useRef, useState } from "react"
import { toast } from "sonner"
import { authenticatedFetch } from "@/lib/authenticated-fetch"
import { ProfileImageCropDialog } from "@/components/profile-image-crop-dialog"
import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { isSupportedProfileImage, NICKNAME_MAX_LENGTH, PROFILE_BIO_MAX_LENGTH, PROFILE_IMAGE_INPUT_MAX_BYTES } from "@/lib/profile"
import { createClient } from "@/utils/supabase/client"

export type ExtensionDevice = {
  installationId: string
  deviceName: string
  connectedAt: string
  lastSeenAt: string | null
}

export type AccountUser = {
  name: string
  handle: string
  bio: string
  avatarUrl: string | null
  extensionConnected?: boolean
  extensionDevices?: ExtensionDevice[]
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })
}

export function AccountDialog({ user }: { user: AccountUser }) {
  const router = useRouter()
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [devices, setDevices] = useState(user.extensionDevices || [])
  const [nickname, setNickname] = useState(user.name)
  const [bio, setBio] = useState(user.bio)
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl)
  const [avatarCropFile, setAvatarCropFile] = useState<File | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)
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
      setDevices((current) => current.filter((device) => device.installationId !== installationId))
      toast.success("선택한 기기의 연결을 해제했습니다.")
      router.refresh()
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
        <UserAvatar name={nickname} imageUrl={avatarUrl} className="size-9" />
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader><DialogTitle>마이페이지</DialogTitle><DialogDescription>프로필과 확장 프로그램 연결 기기를 관리합니다.</DialogDescription></DialogHeader>

        <div className="rounded-xl border p-4">
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

        <div className="rounded-xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">연결된 기기 {devices.length}대</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">각 PC의 SolveSync 확장 프로그램에서 ‘계정 연결’을 누르면 이 목록에 추가됩니다.</p>
            </div>
            <MonitorSmartphone className="size-5 shrink-0 text-muted-foreground" />
          </div>

          {devices.length ? (
            <div className="mt-3 space-y-2">
              {devices.map((device) => (
                <div key={device.installationId} className="flex items-center gap-3 rounded-lg border bg-muted/20 p-3">
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
            <p className="mt-3 rounded-lg bg-muted/40 p-3 text-center text-xs text-muted-foreground">연결된 기기가 없습니다.</p>
          )}
        </div>

        <Button type="button" variant="outline" className="w-full" onClick={logout}><LogOut className="size-4" />로그아웃</Button>
        <div className="rounded-xl border border-destructive/30 p-4">
          {!confirmDelete ? <Button type="button" variant="destructive" className="w-full" onClick={() => setConfirmDelete(true)}><Trash2 className="size-4" />회원 탈퇴</Button> : <div className="space-y-3"><p className="text-sm text-destructive">계정과 모든 풀이·친구·스터디 데이터가 삭제되며 복구할 수 없습니다.</p><div className="flex gap-2"><Button type="button" variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)} disabled={deleting}>취소</Button><Button type="button" variant="destructive" className="flex-1" onClick={deleteAccount} disabled={deleting}>{deleting ? "삭제 중..." : "영구 삭제"}</Button></div></div>}
        </div>
        {avatarCropFile && <ProfileImageCropDialog file={avatarCropFile} onCancel={closeAvatarCrop} onApply={uploadAvatar} />}
      </DialogContent>
    </Dialog>
  )
}
