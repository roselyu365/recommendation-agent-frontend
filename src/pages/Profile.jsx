import { useEffect, useState } from 'react'
import api from '../api/client'
import { useUser } from '../store/user'

function SectionHeader({ title, onAdd }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-bg sticky top-0 z-10">
      <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-widest">{title}</h2>
      {onAdd && (
        <button onClick={onAdd} className="text-accent text-sm font-medium active:opacity-60">
          + 添加
        </button>
      )}
    </div>
  )
}

function AddNoteModal({ onClose, onSave }) {
  const [content, setContent] = useState('')
  const [source, setSource] = useState('')
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end" onClick={onClose}>
      <div
        className="bg-surface w-full max-w-[390px] mx-auto rounded-t-2xl p-5 pb-8"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-[16px] font-semibold text-text-primary mb-4">添加摘录/笔记</h3>
        <textarea
          className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary resize-none focus:outline-none focus:border-accent bg-bg"
          rows={4}
          placeholder="写下你的摘录或读后感…"
          value={content}
          onChange={e => setContent(e.target.value)}
          autoFocus
        />
        <input
          className="w-full border border-border rounded-xl px-3 py-2 text-sm text-text-primary mt-2 focus:outline-none focus:border-accent bg-bg"
          placeholder="来源（书名、作家）"
          value={source}
          onChange={e => setSource(e.target.value)}
        />
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-text-secondary text-sm active:opacity-60">
            取消
          </button>
          <button
            onClick={() => content.trim() && onSave(content.trim(), source.trim())}
            className="flex-1 py-2.5 rounded-xl bg-accent text-white text-sm font-medium active:opacity-80"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

function AddReminderModal({ writers, onClose, onSave }) {
  const [writerId, setWriterId] = useState(writers[0]?.writer_id || '')
  const [time, setTime] = useState('21:00')
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end" onClick={onClose}>
      <div
        className="bg-surface w-full max-w-[390px] mx-auto rounded-t-2xl p-5 pb-8"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-[16px] font-semibold text-text-primary mb-4">设置阅读提醒</h3>
        <label className="text-xs text-text-secondary block mb-1">选择作家</label>
        <select
          className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary mb-3 bg-bg focus:outline-none focus:border-accent"
          value={writerId}
          onChange={e => setWriterId(e.target.value)}
        >
          {writers.map(w => (
            <option key={w.writer_id} value={w.writer_id}>{w.name}</option>
          ))}
        </select>
        <label className="text-xs text-text-secondary block mb-1">每天提醒时间</label>
        <input
          type="time"
          className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary bg-bg focus:outline-none focus:border-accent"
          value={time}
          onChange={e => setTime(e.target.value)}
        />
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-text-secondary text-sm active:opacity-60">
            取消
          </button>
          <button
            onClick={() => writerId && onSave(writerId, time)}
            className="flex-1 py-2.5 rounded-xl bg-accent text-white text-sm font-medium active:opacity-80"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Profile() {
  const { userId } = useUser()
  const [notes, setNotes] = useState([])
  const [reminders, setReminders] = useState([])
  const [writers, setWriters] = useState([])
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [showReminderModal, setShowReminderModal] = useState(false)

  useEffect(() => {
    api.get(`/users/${userId}/notes`).then(r => setNotes(r.data)).catch(() => {})
    api.get(`/users/${userId}/reminders`).then(r => setReminders(r.data)).catch(() => {})
    api.get('/writers').then(r => setWriters(r.data)).catch(() => {})
  }, [userId])

  const saveNote = (content, source) => {
    api.post(`/users/${userId}/notes`, { content, source })
      .then(r => {
        setNotes(prev => [{ id: r.data.id, content, source, created_at: new Date().toISOString() }, ...prev])
        setShowNoteModal(false)
      })
  }

  const deleteNote = (id) => {
    api.delete(`/users/${userId}/notes/${id}`)
      .then(() => setNotes(prev => prev.filter(n => n.id !== id)))
  }

  const saveReminder = (writerId, time) => {
    api.post(`/users/${userId}/reminders`, { writer_id: writerId, remind_time: time })
      .then(r => {
        const writer = writers.find(w => w.writer_id === writerId)
        setReminders(prev => [...prev, {
          id: r.data.id,
          writer_id: writerId,
          writer_name: writer?.name || writerId,
          avatar_initial: writer?.avatar_initial || writerId[0],
          remind_time: time,
          enabled: 1,
        }])
        setShowReminderModal(false)
      })
  }

  const toggleReminder = (rem) => {
    const enabled = rem.enabled ? 0 : 1
    api.put(`/users/${userId}/reminders/${rem.id}`, { enabled })
      .then(() => setReminders(prev => prev.map(r => r.id === rem.id ? { ...r, enabled } : r)))
  }

  const deleteReminder = (id) => {
    api.delete(`/users/${userId}/reminders/${id}`)
      .then(() => setReminders(prev => prev.filter(r => r.id !== id)))
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-surface px-4 pt-12 pb-3 border-b border-border flex-shrink-0">
        <h1 className="text-[17px] font-semibold text-text-primary text-center">我的</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* User card */}
        <div className="bg-surface px-4 py-5 flex items-center gap-4 border-b border-border">
          <div className="w-16 h-16 rounded-2xl bg-accent-pale flex items-center justify-center text-2xl font-bold text-accent">
            读
          </div>
          <div>
            <p className="text-[17px] font-semibold text-text-primary">读者</p>
            <p className="text-sm text-text-secondary mt-0.5">探索文学的旅行者</p>
          </div>
        </div>

        {/* Notes section */}
        <SectionHeader title="摘录与笔记" onAdd={() => setShowNoteModal(true)} />
        {notes.length === 0 ? (
          <div className="px-4 py-6 text-center text-text-muted text-sm">
            还没有摘录，记下触动你的句子吧
          </div>
        ) : (
          notes.map(note => (
            <div key={note.id} className="mx-4 mb-3 bg-surface rounded-xl p-4 border border-border">
              <p className="text-[14px] text-text-primary leading-relaxed">{note.content}</p>
              {note.source && (
                <p className="text-xs text-text-muted mt-2">— {note.source}</p>
              )}
              <div className="flex justify-end mt-2">
                <button
                  onClick={() => deleteNote(note.id)}
                  className="text-xs text-text-muted active:opacity-60"
                >
                  删除
                </button>
              </div>
            </div>
          ))
        )}

        {/* Reminders section */}
        <SectionHeader title="阅读提醒" onAdd={() => setShowReminderModal(true)} />
        {reminders.length === 0 ? (
          <div className="px-4 py-6 text-center text-text-muted text-sm">
            和作家约好每天读书的时间吧
          </div>
        ) : (
          <div className="mx-4 mb-4 bg-surface rounded-xl border border-border overflow-hidden">
            {reminders.map((rem, i) => (
              <div
                key={rem.id}
                className={`flex items-center gap-3 px-4 py-3 ${i < reminders.length - 1 ? 'border-b border-border/50' : ''}`}
              >
                <div className="w-9 h-9 rounded-lg bg-accent-pale flex items-center justify-center text-sm font-semibold text-accent flex-shrink-0">
                  {rem.avatar_initial || rem.writer_name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] text-text-primary font-medium">{rem.writer_name}</p>
                  <p className="text-xs text-text-secondary">每天 {rem.remind_time}</p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Toggle */}
                  <button
                    onClick={() => toggleReminder(rem)}
                    className={`w-11 h-6 rounded-full transition-colors ${rem.enabled ? 'bg-accent' : 'bg-gray-200'} relative flex-shrink-0`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${rem.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                  <button onClick={() => deleteReminder(rem.id)} className="active:opacity-60">
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-text-muted">
                      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="h-6" />
      </div>

      {showNoteModal && (
        <AddNoteModal onClose={() => setShowNoteModal(false)} onSave={saveNote} />
      )}
      {showReminderModal && (
        <AddReminderModal
          writers={writers}
          onClose={() => setShowReminderModal(false)}
          onSave={saveReminder}
        />
      )}
    </div>
  )
}
