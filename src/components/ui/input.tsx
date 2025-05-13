
import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    // Apply input-pixel class unless the type is 'color'
    const inputClass = type === 'color'
      ? "h-10 w-10 p-1 border border-input rounded-lg cursor-pointer" // Style for color input with new radius
      : "input-pixel rounded-lg"; // Apply pixel style with new radius

    return (
      <input
        type={type}
        className={cn(
          // Common styles first
          "flex w-full ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          // Conditional pixel or specific styles
          inputClass,
           // Merge with incoming className
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
