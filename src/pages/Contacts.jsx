import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Avatar from '../components/Avatar'
import api from '../api/client'

const RECOMMENDATION_AGENT = {
  writer_id: 'recommendation',
  name: '文学沙龙',
  avatar_initial: '沙',
  bio: '你的私人书单主理人',
  isPinned: true,
}

export default function Contacts() {
  const [writers, setWriters] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/writers').then(r => setWriters(r.data)).catch(() => {})
  }, [])

  const contacts = [RECOMMENDATION_AGENT, ...writers]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-surface px-4 pt-12 pb-3 border-b border-border flex-shrink-0">
        <h1 className="text-[17px] font-semibold text-text-primary text-center">联系人</h1>
      </div>

      {/* Search bar */}
      <div className="px-4 py-2 bg-bg flex-shrink-0">
        <div className="bg-surface rounded-lg flex items-center gap-2 px-3 py-2 border border-border">
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-text-muted flex-shrink-0">
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <span className="text-text-muted text-sm">搜索</span>
        </div>
      </div>

      {/* Contact list */}
      <div className="flex-1 overflow-y-auto">
        {contacts.map((c, i) => (
          <button
            key={c.writer_id}
            onClick={() => navigate(`/chat/${c.writer_id}`)}
            className="w-full flex items-center gap-3 px-4 py-3 active:bg-gray-100 border-b border-border/50"
          >
            <div className="relative">
              <Avatar initial={c.avatar_initial || c.name?.[0]} size="md" />
              {c.isPinned && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-accent rounded-full border-2 border-bg" />
              )}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[15px] font-medium text-text-primary truncate">{c.name}</p>
              <p className="text-xs text-text-secondary truncate mt-0.5">
                {c.bio || c.suitable_life_state?.slice(0, 20) + '…'}
              </p>
            </div>
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-text-muted flex-shrink-0">
              <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
            </svg>
          </button>
        ))}
      </div>
    </div>
  )
}
