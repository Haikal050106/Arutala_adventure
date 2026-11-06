import React from 'react'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const InteractiveHoverButton = React.forwardRef(
({ text = 'Button', className, type = 'button', ...props }, ref) => {
    return (
    <button
        ref={ref}
        type={type}
        className={cn(
        'group relative w-32 cursor-pointer overflow-hidden rounded-full border border-primary/50 bg-white p-2 text-center text-xs font-semibold text-slate-900 transition-colors hover:bg-primary',
        className,
        )}
        {...props}
    >
        <span className="relative z-10 inline-block transition-all duration-300 group-hover:translate-x-12 group-hover:opacity-0">
        {text}
        </span>
        <div className="absolute inset-0 z-20 flex translate-x-12 items-center justify-center gap-2 text-white opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100">
        <span>{text}</span>
        <ArrowRight size={18} aria-hidden="true" />
        </div>
    </button>
    )
},
)

InteractiveHoverButton.displayName = 'InteractiveHoverButton'

export { InteractiveHoverButton }