
import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
         "animate-pulse rounded-none bg-muted pixel-border", // Use pixel border and muted background
          className
          )}
      {...props}
    />
  )
}

export { Skeleton }
