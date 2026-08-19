import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { User } from "lucide-react"
import { profileImageUrl } from "@/lib/profile"
import { cn } from "@/lib/utils"

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
      <AvatarImage src={profileImageUrl(imageUrl)} alt={`${name} 프로필 사진`} />
      <AvatarFallback className="bg-muted text-muted-foreground">
        <User className="size-1/2" aria-hidden="true" />
      </AvatarFallback>
    </Avatar>
  )
}
