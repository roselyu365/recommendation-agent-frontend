/**
 * Stream a chat message via SSE (POST with ReadableStream).
 *
 * @param {string} userId
 * @param {string} agentId
 * @param {string} message
 * @param {(chunk: string) => void} onText  - called with each text delta
 * @param {(data: object) => void} onEvent  - called for non-text events (recommendation, done)
 * @returns {Promise<string>} full response text
 */
/**
 * 与 Virginia Woolf agent 对话（reader-agent 后端，port 8001）。
 * 非 SSE，单次 POST 返回完整回复。
 *
 * @param {string} userId       - 作为 session_id 传给 reader-agent
 * @param {string} message
 * @param {(text: string) => void} onText - 收到完整回复时调用
 */
// Woolf session 每次打开页面重置（存在 sessionStorage，关闭标签页即清空）
function getWoolfSessionId() {
  let id = sessionStorage.getItem('woolf_session_id')
  if (!id) {
    id = 'woolf-' + Math.random().toString(36).slice(2, 10)
    sessionStorage.setItem('woolf_session_id', id)
  }
  return id
}

export async function woolfChat(userId, message, onText) {
  const response = await fetch('/mobile/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: getWoolfSessionId(), message }),
  })

  if (!response.ok) {
    throw new Error(`Woolf chat failed: ${response.status}`)
  }

  const data = await response.json()
  onText(data.response)
  return data.response
}

export async function streamChat(userId, agentId, message, onText, onEvent) {
  const response = await fetch(`/api/users/${userId}/chat/${agentId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })

  if (!response.ok) {
    throw new Error(`Chat failed: ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() // keep incomplete line

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const data = JSON.parse(line.slice(6))
        if (data.type === 'text') {
          fullText += data.content
          onText(data.content)
        } else {
          onEvent(data)
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  return fullText
}
