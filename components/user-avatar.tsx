import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { User } from "lucide-react"
import { cn } from "@/lib/utils"

const DEFAULT_PROFILE_IMAGE = "/placeholder-user.jpg"

export function UserAvatar({
  name,
  imageUrl,
  className,
}: {
  name: string
  imageUrl?: string | null
  className?: string
}) {
  return (
    <Avatar className={cn("size-9", className)}>
      <AvatarImage src={imageUrl || DEFAULT_PROFILE_IMAGE} alt={`${name} 프로필 사진`} />
      <AvatarFallback className="bg-muted text-muted-foreground">
        <User className="size-1/2" aria-hidden="true" />
      </AvatarFallback>
    </Avatar>
  )
}
