
import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
         "animate-pulse rounded-lg bg-muted pixel-border", // Use pixel border, muted background, and new radius
          className
          )}
      {...props}
    />
  )
}

export { Skeleton }
