import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { User } from "lucide-react"
import { cn } from "@/lib/utils"

export function UserAvatar({
  name: _name,
  className,
}: {
  name: string
  className?: string
}) {
  return (
    <Avatar className={cn("size-9", className)}>
      <AvatarFallback className="bg-muted text-muted-foreground">
        <User className="size-1/2" aria-hidden="true" />
      </AvatarFallback>
    </Avatar>
  )
}
