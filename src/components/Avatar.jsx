/**
 * Avatar — shows initial letter on colored background.
 * size: 'sm' | 'md' | 'lg' | 'xl'
 */
const SIZE = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-14 h-14 text-xl',
  xl: 'w-20 h-20 text-3xl',
}

const COLORS = [
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-800',
  'bg-sky-100 text-sky-800',
  'bg-emerald-100 text-emerald-800',
  'bg-violet-100 text-violet-800',
]

function colorFor(initial) {
  const code = (initial || 'A').charCodeAt(0)
  return COLORS[code % COLORS.length]
}

export default function Avatar({ initial = '?', size = 'md', className = '', onClick }) {
  return (
    <div
      onClick={onClick}
      className={`
        ${SIZE[size]} ${colorFor(initial)}
        rounded-xl flex items-center justify-center font-semibold flex-shrink-0
        ${onClick ? 'cursor-pointer active:opacity-70' : ''}
        ${className}
      `}
    >
      {initial}
    </div>
  )
}
