import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../api/client'

export default function AgentProfile() {
  const { agentId } = useParams()
  const navigate = useNavigate()
  const [writer, setWriter] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/writers/${agentId}`)
      .then(r => setWriter(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [agentId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!writer) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-text-muted">找不到这位作家</p>
        <button onClick={() => navigate(-1)} className="text-accent text-sm">返回</button>
      </div>
    )
  }

  const tags = writer.personality_tags || []

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* Header */}
      <div className="bg-surface border-b border-border px-4 pt-12 pb-3 flex items-center gap-3 flex-shrink-0">
        <button onClick={() => navigate(-1)} className="active:opacity-60 -ml-1">
          <svg viewBox="0 0 24 24" className="w-6 h-6 fill-text-primary">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
          </svg>
        </button>
        <h1 className="text-[15px] font-semibold text-text-primary">{writer.name}</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Hero section */}
        <div className="bg-surface px-6 py-8 flex flex-col items-center gap-4 border-b border-border">
          <div className="w-24 h-24 rounded-2xl bg-accent-pale flex items-center justify-center text-4xl font-bold text-accent">
            {writer.avatar_initial || writer.name?.[0]}
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-text-primary">{writer.name}</h2>
            <p className="text-sm text-text-secondary mt-1">{writer.name_en}</p>
            {writer.bio && (
              <p className="text-sm text-text-secondary mt-2 leading-relaxed max-w-xs">{writer.bio}</p>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {tags.map(tag => (
              <span key={tag} className="bg-accent-pale text-accent text-xs px-3 py-1 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Matching info */}
        {writer.suitable_timing && (
          <div className="mx-4 mt-4 bg-surface rounded-xl border border-border p-4">
            <p className="text-xs font-semibold text-text-secondary mb-2">适合你的时候</p>
            <p className="text-sm text-text-primary leading-relaxed">{writer.suitable_timing}</p>
          </div>
        )}

        {writer.emotional_tone && (
          <div className="mx-4 mt-3 bg-surface rounded-xl border border-border p-4">
            <p className="text-xs font-semibold text-text-secondary mb-2">读完的感受</p>
            <p className="text-sm text-text-primary leading-relaxed">{writer.emotional_tone}</p>
          </div>
        )}

        {/* Works */}
        {writer.works?.length > 0 && (
          <div className="mx-4 mt-3 mb-6">
            <p className="text-xs font-semibold text-text-secondary mb-2 px-1">代表作品</p>
            <div className="bg-surface rounded-xl border border-border overflow-hidden">
              {writer.works.map((work, i) => (
                <div
                  key={i}
                  className={`px-4 py-3.5 ${i < writer.works.length - 1 ? 'border-b border-border/50' : ''}`}
                >
                  <div className="flex items-baseline justify-between">
                    <p className="text-[14px] font-medium text-text-primary">{work.title}</p>
                    <span className="text-xs text-text-muted ml-2 flex-shrink-0">{work.year}</span>
                  </div>
                  <p className="text-xs text-text-secondary mt-1">{work.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="h-4" />
      </div>

      {/* CTA */}
      <div className="bg-surface border-t border-border px-4 py-3 pb-safe flex-shrink-0">
        <button
          onClick={() => navigate(`/chat/${agentId}`)}
          className="w-full bg-accent text-white py-3 rounded-xl font-medium text-[15px] active:opacity-80"
        >
          开始对话
        </button>
      </div>
    </div>
  )
}
