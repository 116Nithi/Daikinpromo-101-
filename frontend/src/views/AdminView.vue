<script setup lang="ts">
import { onMounted, computed } from 'vue'
import '@/styles/admin.css'
import { useConversationsStore } from '@/stores/conversations'
import { useChatStore, messagePreview, dayKey, dayLabel, type Message } from '@/stores/chat'

// Phase 1 ported the static HTML body verbatim. Phase 2 layers in interactive
// behavior — sidebar click opens a chat, messages render into the middle panel,
// unread badge clears once the row is opened. Inline handlers from the legacy
// admin are being re-implemented one feature at a time; modals/popovers without
// wired handlers stay hidden via the `display:none` defaults in admin.css.
const conv = useConversationsStore()
const chat = useChatStore()

onMounted(() => conv.load())

function openChat(lineUserId: string) {
  chat.open(lineUserId)
}

// Group messages by yyyy-mm-dd so we can interleave .day-divider bands between
// blocks. Keeps message order from the server (timestamp asc).
interface DayGroup { key: string; label: string; messages: Message[] }
const groupedMessages = computed<DayGroup[]>(() => {
  const groups: DayGroup[] = []
  for (const m of chat.messages) {
    const key = dayKey(m.timestamp)
    const last = groups[groups.length - 1]
    if (!last || last.key !== key) {
      groups.push({ key, label: dayLabel(m.timestamp), messages: [m] })
    } else {
      last.messages.push(m)
    }
  }
  return groups
})

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(ts: string): string {
  return new Date(ts).toLocaleString('th-TH', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function previewLast(c: { messageType: string; content: unknown }): string {
  return messagePreview({ messageType: c.messageType, content: c.content } as Message)
}
</script>

<template>
  <div class="app">

    <!-- User list -->
    <!-- Mobile drawer toggles + backdrop (visible < 768px) -->
    <button type="button" class="mobile-fab mobile-fab-left" id="mobileMenuBtn" title="รายการแชท">☰</button>
    <button type="button" class="mobile-fab mobile-fab-right" id="mobileInfoBtn" title="ข้อมูล">i</button>
    <div class="mobile-backdrop" id="mobileBackdrop"></div>

    <aside class="user-side">
      <div class="user-head">
        <div class="title">
          <h2>Daikinpromo Chat</h2>
          <p>หน้าจัดการแชท LINE OA</p>
        </div>
        <button type="button" class="settings-btn" title="จัดการแท็กสถานะ">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 20h9"/>
            <path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z"/>
          </svg>
        </button>
      </div>
      <div class="filter-wrap">
        <div class="filter-row dates">
          <input type="date" id="filterDateFrom" title="วันที่เริ่มต้น" />
          <span class="sep">ถึง</span>
          <input type="date" id="filterDateTo" title="วันที่สิ้นสุด" />
        </div>
        <div class="filter-row">
          <input type="text" class="filter-input icon-name" id="filterUserName" placeholder="ชื่อแชทผู้ใช้งาน" autocomplete="off" />
          <input type="text" class="filter-input icon-msg" id="filterMessage" placeholder="ค้นหาข้อความ" autocomplete="off" />
        </div>
        <div class="filter-row">
          <select class="filter-select" id="filterStatus">
            <option value="all">— กรุณาเลือก —</option>
            <option value="unread">ยังไม่ตอบ</option>
            <option value="needsAdmin">ติดต่อเจ้าหน้าที่</option>
            <option value="answered">ตอบแล้ว</option>
          </select>
          <button class="filter-btn search" id="filterSearchBtn" title="ค้นหา" type="button">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
          <button class="filter-btn refresh" id="filterResetBtn" title="ล้าง / รีเฟรช" type="button">
            <svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>
        </div>
      </div>
      <div class="tabs" id="tabs">
        <div class="tab active" data-filter="all">ทั้งหมด <span class="cnt" id="countAll">{{ conv.items.length }}</span></div>
        <div class="tab" data-filter="unread">ยังไม่ตอบ <span class="cnt" id="countUnread">0</span></div>
        <div class="tab" data-filter="spam">สแปม <span class="cnt" id="countSpam">0</span></div>
      </div>
      <div class="user-list" id="userList">
        <div v-if="conv.loading" class="empty-state">Loading...</div>
        <div v-else-if="conv.error" class="empty-state" style="color:#d93025;">{{ conv.error }}</div>
        <div v-else-if="conv.items.length === 0" class="empty-state">ยังไม่มีบทสนทนา</div>
        <div
          v-else
          v-for="c in conv.items"
          :key="c.lineUserId"
          class="user-item"
          :class="{ unread: c.unreadCount > 0, active: chat.currentUserId === c.lineUserId }"
          @click="openChat(c.lineUserId)"
        >
          <div class="avatar-wrap">
            <img v-if="c.pictureUrl" :src="c.pictureUrl" class="avatar" alt="" />
            <div v-else class="avatar">{{ (c.displayName || '?').slice(0, 1) }}</div>
          </div>
          <div class="user-meta">
            <div class="user-top">
              <span class="user-name">
                <span v-if="c.pinned" class="pin-mark">📌</span>{{ c.displayName }}
              </span>
              <span class="user-date">{{ formatDate(c.timestamp) }}</span>
            </div>
            <div class="user-bottom">
              <span class="user-last">{{ previewLast(c) }}</span>
              <span v-if="c.unreadCount > 0" class="unread-badge">{{ c.unreadCount }}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>

    <!-- Bulk export modal -->
    <div class="bulk-overlay" id="bulkOverlay">
      <div class="bulk-modal">
        <div class="bulk-head">
          <h3>Export บทสนทนา</h3>
          <button class="bulk-close" title="ปิด">×</button>
        </div>
        <div class="bulk-meta">
          <label class="bulk-field">
            <span>ชื่อผู้แก้ไข</span>
            <input type="text" id="bulkEditor" placeholder="เช่น Admin" maxlength="60" />
          </label>
          <div class="bulk-dates">
            <label><span>จาก</span><input type="date" id="bulkFrom" /></label>
            <label><span>ถึง</span><input type="date" id="bulkTo" /></label>
          </div>
        </div>
        <div class="bulk-toolbar">
          <span class="bulk-hint">เลือกผู้ใช้ที่ต้องการ export (สูงสุด 100 คน)</span>
          <button class="bulk-toggle-all" type="button">เลือก/ล้างทั้งหมด</button>
        </div>
        <div class="bulk-quick">
          <span class="bulk-quick-label">ตั้งหัวข้อให้ทุกคนที่เลือก:</span>
          <button type="button" class="topic-chip" id="quickTopicChip">
            <span class="dot" style="display:none;"></span>
            <span class="label">เลือกหัวข้อ</span>
            <span class="caret">▾</span>
          </button>
          <button type="button" class="quick-apply" id="quickApplyBtn" disabled>ใช้</button>
        </div>
        <div class="bulk-list" id="bulkList"></div>
        <div class="bulk-footer">
          <div class="bulk-count">เลือกไว้ <b id="bulkCount">0 / 100</b> คน</div>
          <div class="bulk-actions-row">
            <button type="button" class="bulk-action-btn">ยกเลิก</button>
            <button type="button" class="bulk-action-btn" id="bulkPdfBtn" disabled title="PDF รองรับเฉพาะแชทเดียว">📄 PDF</button>
            <button type="button" class="bulk-action-btn primary" id="bulkWordBtn" disabled>📝 Word</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Topic select popover (shared across rows + quick-apply) -->
    <div class="topic-popover" id="topicPopover"></div>

    <!-- User status popover (per user, opens from chip below name) -->
    <div class="status-popover" id="statusPopover"></div>

    <!-- Image lightbox (click any chat image to view full-size) -->
    <div class="lightbox" id="lightbox">
      <button type="button" class="lightbox-close" title="ปิด (Esc)">×</button>
      <img id="lightboxImg" src="" alt="" />
    </div>

    <!-- Generic confirm / alert modal -->
    <div class="confirm-overlay" id="confirmOverlay">
      <div class="confirm-modal">
        <div class="confirm-head"><h3 id="confirmTitle">ยืนยัน?</h3></div>
        <div class="confirm-body" id="confirmBody"></div>
        <div class="confirm-warn" id="confirmWarn" style="display:none;"></div>
        <div class="confirm-actions">
          <button type="button" id="confirmCancelBtn">ยกเลิก</button>
          <button type="button" class="danger" id="confirmOkBtn">ตกลง</button>
        </div>
      </div>
    </div>

    <!-- Chat-level context menu (kebab + right-click) -->
    <div class="chat-context-menu" id="chatCtxMenu"></div>

    <!-- Message-level context menu (long-press on bubble — mobile reply) -->
    <div class="chat-context-menu" id="msgCtxMenu"></div>

    <!-- Manage status tags modal -->
    <div class="tag-mgr-overlay" id="tagMgrOverlay">
      <div class="tag-mgr-modal">
        <div class="tag-mgr-head">
          <h3>จัดการแท็กสถานะ</h3>
          <button class="tag-mgr-close">×</button>
        </div>
        <div class="tag-mgr-body">
          <div class="tag-mgr-list" id="tagMgrList"></div>
          <div class="tag-form">
            <div class="tag-form-title" id="tagFormTitle">เพิ่มแท็กใหม่</div>
            <div class="tag-form-fields">
              <input type="color" id="tagFormColor" value="#2d6cdf" />
              <input type="text" id="tagFormLabel" placeholder="ชื่อแท็ก..." maxlength="60" />
              <button type="button" class="cancel-btn" id="tagFormCancel" style="display:none;">ยกเลิก</button>
              <button type="button" class="save-btn" id="tagFormSave">บันทึก</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Template add/edit modal — ordered list of text/image/video items. -->
    <div class="tpl-edit-overlay" id="tplEditOverlay">
      <div class="tpl-edit-modal">
        <div class="tpl-edit-head">
          <h3 id="tplEditTitle">เพิ่มเทมเพลต</h3>
          <button type="button" class="tag-mgr-close">×</button>
        </div>
        <div class="tpl-edit-body">
          <div class="tpl-edit-row">
            <span class="tpl-edit-label" style="margin: 0;">ลำดับการส่ง <span class="tpl-asset-count" id="tplItemCount">0/5</span></span>
          </div>
          <div class="tpl-items-list" id="tplItemsList"></div>
          <div class="tpl-edit-add-buttons">
            <button type="button" class="tpl-asset-add-btn">+ ข้อความ</button>
            <button type="button" class="tpl-asset-add-btn">+ รูป/วิดีโอ</button>
            <input type="file" id="tplAssetInput" accept="image/*,video/*" multiple style="display:none" />
          </div>
        </div>
        <div class="tpl-edit-actions">
          <button type="button" class="note-btn cancel">ยกเลิก</button>
          <button type="button" class="note-btn save" id="tplEditSaveBtn">บันทึก</button>
        </div>
      </div>
    </div>

    <!-- Send preview modal -->
    <div class="tpl-send-overlay" id="tplSendOverlay">
      <div class="tpl-send-modal">
        <div class="tpl-send-head">
          <h3>ตัวอย่างก่อนส่ง</h3>
          <button type="button" class="tag-mgr-close">×</button>
        </div>
        <div class="tpl-send-sub" id="tplSendSub"></div>
        <div class="tpl-send-body" id="tplSendBody"></div>
        <div class="tpl-send-actions">
          <button type="button" class="note-btn cancel">ยกเลิก</button>
          <button type="button" class="note-btn save" id="tplSendBtn">ส่งให้ลูกค้า</button>
        </div>
      </div>
    </div>

    <!-- Manage note categories modal -->
    <div class="tag-mgr-overlay" id="noteCatMgrOverlay">
      <div class="tag-mgr-modal">
        <div class="tag-mgr-head">
          <h3>จัดการหมวดหมู่บันทึก</h3>
          <button class="tag-mgr-close">×</button>
        </div>
        <div class="tag-mgr-body">
          <div class="tag-mgr-list" id="noteCatMgrList"></div>
          <div class="tag-form">
            <div class="tag-form-title" id="noteCatFormTitle">เพิ่มหมวดหมู่ใหม่</div>
            <div class="tag-form-fields">
              <input type="color" id="noteCatFormColor" value="#2d6cdf" />
              <input type="text" id="noteCatFormLabel" placeholder="ชื่อหมวดหมู่..." maxlength="60" />
              <button type="button" class="cancel-btn" id="noteCatFormCancel" style="display:none;">ยกเลิก</button>
              <button type="button" class="save-btn" id="noteCatFormSave">บันทึก</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Chat area -->
    <main class="chat-area">
      <div class="chat-head" id="chatHeader">
        <template v-if="chat.currentUserId && chat.profile">
          <img v-if="chat.profile.pictureUrl" :src="chat.profile.pictureUrl" class="avatar" alt="" />
          <div v-else class="avatar">{{ (chat.profile.displayName || '?').slice(0, 1) }}</div>
          <div class="name">{{ chat.profile.displayName }}</div>
          <div class="chat-head-actions">
            <button type="button" class="chat-head-icon" title="Export Word">
              <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </button>
          </div>
        </template>
        <span v-else>เลือก user ทางซ้ายเพื่อเริ่มแชท</span>
      </div>
      <div class="chat-scroll" id="chatMessages">
        <div v-if="!chat.currentUserId" class="empty-state">ยังไม่มี user ที่เลือก</div>
        <div v-else-if="chat.loading" class="empty-state">กำลังโหลดข้อความ...</div>
        <div v-else-if="chat.error" class="empty-state" style="color:#d93025;">{{ chat.error }}</div>
        <div v-else-if="chat.messages.length === 0" class="empty-state">ยังไม่มีข้อความ</div>
        <template v-else v-for="g in groupedMessages" :key="g.key">
          <div class="day-divider"><span>{{ g.label }}</span></div>
          <div
            v-for="m in g.messages"
            :key="m.id"
            class="msg"
            :class="m.direction"
          >
            <div class="msg-label">
              {{ m.direction === 'inbound' ? (chat.profile?.displayName || 'User') : (m.direction === 'outbound_admin' ? 'Admin' : 'Bot') }}
            </div>
            <template v-if="m.messageType === 'text'">
              {{ (m.content as any)?.text || '' }}
            </template>
            <template v-else-if="m.messageType === 'image' && m.mediaUrl">
              <img :src="m.mediaUrl" class="msg-media" alt="" />
            </template>
            <template v-else-if="m.messageType === 'video' && m.mediaUrl">
              <video :src="m.mediaUrl" class="msg-media" controls></video>
            </template>
            <template v-else-if="m.messageType === 'audio' && m.mediaUrl">
              <audio :src="m.mediaUrl" class="msg-audio" controls></audio>
            </template>
            <template v-else-if="m.messageType === 'file' && m.mediaUrl">
              <a :href="m.mediaUrl" target="_blank" class="msg-file">📎 ไฟล์แนบ</a>
            </template>
            <template v-else>
              <span style="opacity:0.6;font-style:italic;">[{{ m.messageType }}]</span>
            </template>
            <div class="msg-time">{{ formatTime(m.timestamp) }}</div>
          </div>
        </template>
      </div>
      <div class="tpl-bar" id="tplBar" style="display:none;">
        <div class="tpl-chips" id="tplChips"></div>
        <button type="button" class="tpl-toggle" id="tplToggle" title="ดูทั้งหมด">
          <svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>
        </button>
        <div class="tpl-panel" id="tplPanel">
          <div class="tpl-panel-head">
            <span class="tpl-panel-title">เทมเพลตข้อความ</span>
            <button type="button" class="tpl-panel-add" title="เพิ่ม">+ เพิ่ม</button>
          </div>
          <div class="tpl-panel-list" id="tplPanelList"></div>
        </div>
      </div>

      <div class="chat-input" id="chatInput" style="display:none;">
        <div class="quote-banner" id="quoteBanner">
          <div class="quote-content">
            <div class="quote-label" id="quoteLabel">↩ ตอบกลับ</div>
            <div class="quote-text" id="quoteText"></div>
          </div>
          <button type="button" class="quote-cancel" title="ยกเลิก">×</button>
        </div>
        <div class="attach-bar" id="attachBar"></div>
        <input type="file" id="fileInput" hidden multiple />
        <button class="icon-btn" id="uploadBtn" title="แนบไฟล์">📎</button>
        <textarea id="msgInput" placeholder="พิมพ์ข้อความ..." rows="1"></textarea>
        <button class="btn-send" id="sendBtn">➤</button>
      </div>
    </main>

    <!-- Info side -->
    <aside class="info-side" id="infoSide">
      <div class="info-side-empty">
        <button type="button" class="info-empty-manage" title="จัดการหมวดหมู่">⚙ จัดการหมวดหมู่</button>
        <div class="empty-state">เลือก user เพื่อดูข้อมูล</div>
      </div>
    </aside>

    <!-- Note add/edit modal -->
    <div class="note-overlay" id="noteOverlay">
      <div class="note-modal">
        <h3 id="noteModalTitle">เพิ่มบันทึก</h3>

        <div class="note-modal-body">
          <div class="note-section-row">
            <span class="note-section-label">หมวดหมู่</span>
            <button type="button" class="note-cat-manage-btn" title="จัดการหมวดหมู่">⚙ จัดการ</button>
          </div>
          <ul class="note-cat-list" id="noteCatList"></ul>

          <div class="note-section-label">รายละเอียด</div>
          <textarea class="note-textarea" id="noteBody" placeholder="พิมพ์รายละเอียดที่ลูกค้าแจ้ง..."></textarea>

          <div class="note-section-label" style="margin-top: 20px;">บันทึกโดย</div>
          <input type="text" class="note-author-input" id="noteAuthor" placeholder="เช่น Admin" maxlength="40" />
        </div>

        <div class="note-actions-row">
          <button type="button" class="note-btn cancel">ยกเลิก</button>
          <button type="button" class="note-btn save" id="noteSaveBtn">บันทึก</button>
        </div>
      </div>
    </div>

  </div>
</template>
