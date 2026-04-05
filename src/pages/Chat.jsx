import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Avatar from '../components/Avatar'
import api from '../api/client'
import { streamChat, woolfChat } from '../api/chat'
import { useUser } from '../store/user'

const AGENT_META = {
  recommendation: { name: '文学沙龙', initial: '沙', bio: '你的私人书单主理人' },
  woolf: { name: 'Virginia Woolf', initial: 'W', bio: '作家 · 布鲁姆斯伯里' },
}

const IS_WOOLF = (agentId) => agentId === 'woolf'

// 检测回复里是否出现书名（《》包裹 or 常见英文书名关键词）
const BOOK_TITLE_RE = /《[^》]+》|"[A-Z][^"]{3,40}"|'[A-Z][^']{3,40}'/

// 书名 → 阅读器 slug 映射（支持中英文）
function extractBookSlug(text) {
  const t = text.toLowerCase()
  if (t.includes('mrs dalloway') || t.includes('达洛维')) return 'daluo_weifuren'
  if (t.includes('three guineas') || t.includes('三枚金币') || t.includes('三基尼')) return 'a_room_of_ones_own' // fallback
  if (t.includes('common reader') || t.includes('普通读者')) return 'a_room_of_ones_own' // fallback
  if (t.includes('room of one') || t.includes('一间') || t.includes('自己的房间')) return 'yijian_fangjian'
  if (t.includes('写下来') || t.includes('痛苦就会过去')) return 'xie_xialai'
  if (t.includes('思考就是') || t.includes('抵抗')) return 'sikao_dikang'
  return 'daluo_weifuren' // 默认
}

function parseReadingTime(text) {
  const match = text.match(/\[READING_TIME:\s*([^\]]+)\]/)
  return match ? match[1].trim() : null
}

function stripReadingTimeTag(text) {
  return text.replace(/\n?\[READING_TIME:[^\]]*\]/g, '').trimEnd()
}

function Bubble({ role, content, isStreaming }) {
  const isUser = role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`
          max-w-[72%] px-3.5 py-2.5 rounded-2xl text-[14px] leading-relaxed
          ${isUser
            ? 'bg-accent text-white rounded-tr-sm'
            : 'bg-surface border border-border text-text-primary rounded-tl-sm'
          }
          ${isStreaming ? 'opacity-80' : ''}
        `}
      >
        {content}
        {isStreaming && <span className="inline-block w-1 h-3.5 bg-current ml-0.5 animate-pulse align-middle" />}
      </div>
    </div>
  )
}

export default function Chat() {
  const { agentId } = useParams()
  const { userId } = useUser()
  const navigate = useNavigate()

  const [agent, setAgent] = useState(AGENT_META[agentId] || { name: agentId, initial: agentId?.[0]?.toUpperCase() })
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')

  // Woolf 调度状态
  const [showScheduleBtn, setShowScheduleBtn] = useState(false) // 检测到书名后显示
  const [scheduledTime, setScheduledTime] = useState(null)      // 已确认的时间
  const [reminderCreated, setReminderCreated] = useState(false) // 提醒已创建
  const [streaming, setStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  // Load agent info and history
  useEffect(() => {
    if (IS_WOOLF(agentId)) {
      // Woolf 的 meta 已在 AGENT_META 里，历史记录存在 reader-agent 内存里（不持久化）
      return
    }
    if (agentId !== 'recommendation') {
      api.get(`/writers/${agentId}`)
        .then(r => setAgent({ name: r.data.name, initial: r.data.avatar_initial || r.data.name?.[0] }))
        .catch(() => {})
    }
    api.get(`/users/${userId}/conversations/${agentId}`)
      .then(r => setMessages(r.data.map(m => ({ role: m.role, content: m.content }))))
      .catch(() => {})
  }, [agentId, userId])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  const send = async () => {
    const text = input.trim()
    if (!text || streaming) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setStreaming(true)
    setStreamingText('')

    try {
      if (IS_WOOLF(agentId)) {
        await woolfChat(userId, text, (full) => {
          const readingTime = parseReadingTime(full)
          const displayText = stripReadingTimeTag(full)

          setStreamingText(displayText)

          // 检测到书名 → 显示「安排阅读」按钮，同时通知后端记录书目
          if (BOOK_TITLE_RE.test(displayText) && !scheduledTime) {
            setShowScheduleBtn(true)
            const slug = extractBookSlug(displayText)
            fetch('/mobile/set_book', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ book: slug }),
            }).catch(() => {})
          }

          // Woolf 输出了时间约定标记
          if (readingTime && !scheduledTime) {
            setScheduledTime(readingTime)
            setShowScheduleBtn(false)
            // 创建提醒（best-effort，失败不报错）
            api.post(`/users/${userId}/reminders`, {
              writer_id: 'woolf',
              remind_time: new Date().toISOString(),
            }).catch(() => {})
          }
        })
      } else {
        await streamChat(
          userId,
          agentId,
          text,
          (chunk) => setStreamingText(prev => prev + chunk),
          (event) => {
            if (event.type === 'recommendation' && event.writer_id) {
              const isWoolfRec = event.writer_id === 'woolf'
              setMessages(prev => [...prev, {
                role: 'assistant',
                content: isWoolfRec ? '✦ 和伍尔夫聊聊' : `✦ 查看推荐：${event.writer_id}`,
                isRecommendation: true,
                writerId: event.writer_id,
              }])
            }
          }
        )
      }
    } catch (e) {
      setStreamingText('出了点问题，请稍后再试。')
    } finally {
      setStreaming(false)
      setStreamingText(prev => {
        if (prev) {
          setMessages(msgs => [...msgs, { role: 'assistant', content: prev }])
        }
        return ''
      })
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* Header */}
      <div className="bg-surface border-b border-border flex items-center gap-3 px-4 pt-12 pb-3 flex-shrink-0">
        <button onClick={() => navigate(-1)} className="active:opacity-60 -ml-1">
          <svg viewBox="0 0 24 24" className="w-6 h-6 fill-text-primary">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
          </svg>
        </button>
        <button
          onClick={() => agentId !== 'recommendation' && navigate(`/agent/${agentId}`)}
          className="flex items-center gap-2.5 flex-1 min-w-0 active:opacity-70"
        >
          <Avatar initial={agent.initial} size="sm" />
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-text-primary truncate">{agent.name}</p>
          </div>
        </button>
        {agentId !== 'recommendation' && (
          <button
            onClick={() => navigate(`/agent/${agentId}`)}
            className="active:opacity-60 text-text-secondary"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !streaming && (
          <div className="text-center text-text-muted text-sm py-8">
            开始和{agent.name}说话吧
          </div>
        )}
        {messages.map((msg, i) => {
          if (msg.isRecommendation) {
            // Woolf → 直接进对话；其他作家 → 先看简介再决定
            const dest = msg.writerId === 'woolf'
              ? `/chat/${msg.writerId}`
              : `/agent/${msg.writerId}`
            return (
              <div key={i} className="flex justify-center mb-3">
                <button
                  onClick={() => navigate(dest)}
                  className="bg-accent-pale text-accent text-xs px-4 py-1.5 rounded-full active:opacity-70"
                >
                  {msg.content}
                </button>
              </div>
            )
          }
          return <Bubble key={i} role={msg.role} content={msg.content} />
        })}
        {streaming && streamingText && (
          <Bubble role="assistant" content={streamingText} isStreaming />
        )}
        {streaming && !streamingText && (
          <div className="flex justify-start mb-3">
            <div className="bg-surface border border-border px-4 py-2.5 rounded-2xl rounded-tl-sm">
              <div className="flex gap-1.5 items-center h-4">
                <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
        {/* ── Woolf 调度 UI ── */}

        {/* 1. 检测到书名后出现的「安排阅读」按钮 */}
        {IS_WOOLF(agentId) && showScheduleBtn && !scheduledTime && (
          <div className="flex justify-center mb-3">
            <button
              onClick={() => {
                setShowScheduleBtn(false)
                // 直接调用而不经过 input state，避免 streaming 竞态
                const scheduleMsg = '我想安排一个时间读这本书，你觉得什么时候合适？'
                if (streaming) return  // 还在流式输出，忽略点击
                setMessages(prev => [...prev, { role: 'user', content: scheduleMsg }])
                setStreaming(true)
                setStreamingText('')
                woolfChat(userId, scheduleMsg, (full) => {
                  const readingTime = parseReadingTime(full)
                  const displayText = stripReadingTimeTag(full)
                  setStreamingText(displayText)
                  if (readingTime && !scheduledTime) {
                    setScheduledTime(readingTime)
                    api.post(`/users/${userId}/reminders`, {
                      writer_id: 'woolf',
                      remind_time: new Date().toISOString(),
                    }).catch(() => {})
                  }
                }).finally(() => {
                  setStreaming(false)
                  setStreamingText(prev => {
                    if (prev) setMessages(msgs => [...msgs, { role: 'assistant', content: prev }])
                    return ''
                  })
                })
              }}
              className="bg-accent-pale text-accent text-xs px-4 py-1.5 rounded-full active:opacity-70"
            >
              📅 和伍尔夫约一个阅读时间
            </button>
          </div>
        )}

        {/* 2. Woolf 确认时间后的提示卡 */}
        {IS_WOOLF(agentId) && scheduledTime && !reminderCreated && (
          <div className="mx-4 mb-3 bg-surface border border-border rounded-2xl p-3.5">
            <p className="text-xs text-text-muted mb-1">已约定阅读时间</p>
            <p className="text-[14px] text-text-primary font-medium mb-3">📖 {scheduledTime}</p>
            <button
              onClick={() => setReminderCreated(true)}
              className="w-full py-2 bg-accent text-white text-sm rounded-xl active:opacity-80"
            >
              确认，加入提醒
            </button>
          </div>
        )}

        {/* 3. 确认提醒后：提示打开阅读器 */}
        {IS_WOOLF(agentId) && reminderCreated && (
          <div className="mx-4 mb-3 bg-surface border border-border rounded-2xl p-3.5 text-center">
            <p className="text-xs text-text-muted mb-1">到时候</p>
            <p className="text-[13px] text-text-primary">打开你的圆筒阅读器</p>
            <p className="text-[11px] text-text-muted mt-1">伍尔夫会在那里等你</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="bg-surface border-t border-border px-3 py-2 pb-safe flex items-end gap-2 flex-shrink-0">
        <textarea
          ref={inputRef}
          className="flex-1 bg-bg border border-border rounded-2xl px-3.5 py-2.5 text-[14px] text-text-primary resize-none focus:outline-none focus:border-accent max-h-28 min-h-[40px]"
          placeholder="说点什么…"
          rows={1}
          value={input}
          onChange={e => {
            setInput(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = Math.min(e.target.scrollHeight, 112) + 'px'
          }}
          onKeyDown={onKeyDown}
        />
        <button
          onClick={send}
          disabled={!input.trim() || streaming}
          className="w-9 h-9 rounded-full bg-accent flex items-center justify-center flex-shrink-0 disabled:opacity-40 active:opacity-70 transition-opacity"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white rotate-90">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
