import { useLocation, useNavigate } from 'react-router-dom'

const TABS = [
  {
    path: '/contacts',
    label: '联系人',
    icon: (active) => (
      <svg viewBox="0 0 24 24" className={`w-6 h-6 ${active ? 'fill-accent' : 'fill-text-secondary'}`}>
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
      </svg>
    ),
  },
  {
    path: '/feed',
    label: '朋友圈',
    icon: (active) => (
      <svg viewBox="0 0 24 24" className={`w-6 h-6 ${active ? 'fill-accent' : 'fill-text-secondary'}`}>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
      </svg>
    ),
  },
  {
    path: '/profile',
    label: '我的',
    icon: (active) => (
      <svg viewBox="0 0 24 24" className={`w-6 h-6 ${active ? 'fill-accent' : 'fill-text-secondary'}`}>
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
      </svg>
    ),
  },
]

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div className="flex-shrink-0 border-t border-border bg-surface pb-safe">
      <div className="flex">
        {TABS.map((tab) => {
          const active = location.pathname === tab.path
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="flex-1 flex flex-col items-center gap-0.5 py-2 active:opacity-60"
            >
              {tab.icon(active)}
              <span className={`text-[10px] ${active ? 'text-accent font-medium' : 'text-text-secondary'}`}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
