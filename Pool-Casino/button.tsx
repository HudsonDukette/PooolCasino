import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "neon" | "outline" | "ghost" | "destructive" | "success";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:scale-95",
          {
            "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 hover:shadow-primary/40": variant === "default",
            "bg-transparent border-2 border-primary text-primary hover:bg-primary/10 neon-box-primary": variant === "neon",
            "border border-border bg-transparent hover:bg-muted text-foreground": variant === "outline",
            "hover:bg-muted hover:text-foreground text-muted-foreground": variant === "ghost",
            "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg shadow-destructive/20": variant === "destructive",
            "bg-success text-success-foreground hover:bg-success/90 shadow-lg shadow-success/20": variant === "success",
            "h-10 px-4 py-2": size === "default",
            "h-9 rounded-lg px-3": size === "sm",
            "h-12 rounded-2xl px-8 text-base": size === "lg",
            "h-10 w-10": size === "icon",
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
