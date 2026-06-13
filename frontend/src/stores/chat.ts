import { defineStore } from 'pinia'
import { useConversationsStore } from './conversations'

// Matches the shape returned by GET /api/admin/conversations/:lineUserId
// (see backend src/webhook/admin-api.ts getConversationHandler).
export interface Message {
  id: string  // BigInt as string
  lineUserId: string
  direction: 'inbound' | 'outbound_admin' | 'outbound_bot'
  messageType: string
  content: unknown
  mediaUrl: string | null
  replyToken: string | null
  sourceType: string | null
  sourceId: string | null
  isRead: boolean
  timestamp: string
  createdAt: string
  quoteToken: string | null
  quotedMessageId: string | null
}

export interface Profile {
  userId: string
  displayName: string
  pictureUrl?: string
  statusMessage?: string
}

interface State {
  currentUserId: string | null
  profile: Profile | null
  messages: Message[]
  loading: boolean
  error: string | null
}

export const useChatStore = defineStore('chat', {
  state: (): State => ({
    currentUserId: null,
    profile: null,
    messages: [],
    loading: false,
    error: null,
  }),

  actions: {
    async open(lineUserId: string) {
      if (this.currentUserId === lineUserId && !this.error) return
      this.currentUserId = lineUserId
      this.loading = true
      this.error = null
      this.messages = []
      this.profile = null
      try {
        const res = await fetch(`/api/admin/conversations/${lineUserId}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        this.profile = data.profile
        this.messages = data.messages
        // Fire-and-forget — visual unread badge clears immediately, server
        // catches up asynchronously. Failures here aren't worth surfacing.
        this.markRead(lineUserId).catch(() => {})
      } catch (err) {
        this.error = err instanceof Error ? err.message : String(err)
      } finally {
        this.loading = false
      }
    },

    async markRead(lineUserId: string) {
      await fetch(`/api/admin/conversations/${lineUserId}/read`, { method: 'PATCH' })
      // Reflect in the sidebar without a full refetch.
      const conv = useConversationsStore()
      const row = conv.items.find((c) => c.lineUserId === lineUserId)
      if (row) row.unreadCount = 0
    },

    close() {
      this.currentUserId = null
      this.profile = null
      this.messages = []
      this.error = null
    },
  },
})

// Pulls a one-line preview text out of an arbitrary message content object.
// Mirrors the logic used in the sidebar list so visuals stay consistent.
export function messagePreview(m: Message): string {
  if (m.messageType === 'text') {
    const t = (m.content as { text?: string } | null)?.text
    return typeof t === 'string' ? t : ''
  }
  switch (m.messageType) {
    case 'image': return '[รูปภาพ]'
    case 'video': return '[วิดีโอ]'
    case 'audio': return '[เสียง]'
    case 'file': return '[ไฟล์]'
    case 'sticker': return '[สติกเกอร์]'
    case 'location': return '[ตำแหน่ง]'
    default: return `[${m.messageType}]`
  }
}

// Returns a yyyy-mm-dd key used to group messages under day-dividers.
export function dayKey(ts: string): string {
  return new Date(ts).toISOString().slice(0, 10)
}

// Thai-localized day label shown in the divider band.
export function dayLabel(ts: string): string {
  const d = new Date(ts)
  return d.toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
