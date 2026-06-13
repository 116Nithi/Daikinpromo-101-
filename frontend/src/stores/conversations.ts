import { defineStore } from 'pinia'

// Matches the shape returned by GET /api/admin/conversations
// (see backend src/webhook/admin-api.ts listConversationsHandler).
export interface Conversation {
  lineUserId: string
  direction: string
  messageType: string
  content: unknown
  timestamp: string
  displayName: string
  pictureUrl: string | null
  unreadCount: number
  pinned: boolean
  pinnedAt: string | null
  isSpam: boolean
}

interface State {
  items: Conversation[]
  loading: boolean
  error: string | null
}

export const useConversationsStore = defineStore('conversations', {
  state: (): State => ({
    items: [],
    loading: false,
    error: null,
  }),

  actions: {
    async load() {
      this.loading = true
      this.error = null
      try {
        const res = await fetch('/api/admin/conversations')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        this.items = await res.json()
      } catch (err) {
        this.error = err instanceof Error ? err.message : String(err)
      } finally {
        this.loading = false
      }
    },
  },
})

// Derives a one-line preview from a conversation's last-message content + type.
// Handles the common LINE message types and falls back to "[type]" for unknowns
// so the sidebar stays readable instead of showing raw JSON.
export function previewText(c: Conversation): string {
  if (c.messageType === 'text') {
    const t = (c.content as { text?: string } | null)?.text
    return typeof t === 'string' ? t : ''
  }
  switch (c.messageType) {
    case 'image': return '[รูปภาพ]'
    case 'video': return '[วิดีโอ]'
    case 'audio': return '[เสียง]'
    case 'file': return '[ไฟล์]'
    case 'sticker': return '[สติกเกอร์]'
    case 'location': return '[ตำแหน่ง]'
    default: return `[${c.messageType}]`
  }
}
