export const ADMIN_HTML = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daikinpromo Chat - Admin</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans Thai', sans-serif; background: #f0f2f5; color: #111827; font-size: 14px; }

    .app { display: grid; grid-template-columns: 320px 1fr 300px; height: 100vh; background: #fff; }

    /* === User list === */
    .user-side { background: #fff; border-right: 1px solid #e5e7eb; display: flex; flex-direction: column; overflow: hidden; }
    .user-head { background: #06c755; padding: 14px 16px; color: #fff; }
    .user-head h2 { font-size: 16px; font-weight: 700; }
    .user-head p { font-size: 11px; opacity: 0.9; margin-top: 1px; }

    .search-wrap { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; }
    .search-input { width: 100%; padding: 8px 14px 8px 36px; background: #f3f4f6; border: none; border-radius: 20px; font-size: 13px; outline: none;
      background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='11' cy='11' r='8'/><line x1='21' y1='21' x2='16.65' y2='16.65'/></svg>");
      background-repeat: no-repeat; background-position: 12px center; }

    .tabs { display: flex; padding: 0 12px; gap: 0; border-bottom: 1px solid #e5e7eb; }
    .tab { flex: 1; text-align: center; padding: 10px 0; font-size: 12px; color: #6b7280; cursor: pointer; border-bottom: 2px solid transparent; user-select: none; }
    .tab.active { color: #06c755; border-bottom-color: #06c755; font-weight: 600; }
    .tab .cnt { display: inline-block; background: #e5e7eb; color: #374151; border-radius: 10px; padding: 0 6px; font-size: 10px; margin-left: 4px; font-weight: 700; min-width: 18px; }
    .tab.active .cnt { background: #06c755; color: #fff; }

    .user-list { flex: 1; overflow-y: auto; }
    .user-item { padding: 12px 14px; cursor: pointer; display: flex; gap: 10px; align-items: center; transition: background 0.12s; border-bottom: 1px solid #f3f4f6; }
    .user-item:hover { background: #f9fafb; }
    .user-item.active { background: #ecfdf5; }
    .user-item.unread .user-name { font-weight: 700; color: #000; }
    .user-item.unread .user-last { color: #374151; font-weight: 500; }

    .avatar-wrap { position: relative; flex-shrink: 0; }
    .avatar { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 16px; background: #9ca3af; object-fit: cover; overflow: hidden; }
    /* Badge moved: now inline pill on the right side under time (LINE-style) */
    .unread-badge { min-width: 20px; height: 20px; padding: 0 6px; border-radius: 10px; background: #06c755; color: #fff; font-size: 11px; font-weight: 700; line-height: 20px; text-align: center; flex-shrink: 0; box-sizing: border-box; }

    .user-meta { flex: 1; min-width: 0; }
    .user-top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
    .user-name { font-size: 14px; color: #111827; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .user-date { font-size: 11px; color: #9ca3af; flex-shrink: 0; }
    .user-bottom { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 2px; }
    .user-bottom .user-last { margin-top: 0; flex: 1; min-width: 0; }
    .user-last { font-size: 12px; color: #6b7280; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    /* === Chat area === */
    .chat-area { background: #f0f2f5; display: flex; flex-direction: column; overflow: hidden; position: relative; }
    .chat-head { background: #fff; padding: 12px 18px; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; gap: 12px; min-height: 60px; color: #6b7280; }
    .chat-head .avatar { width: 40px; height: 40px; font-size: 14px; }
    .chat-head .name { font-weight: 700; font-size: 15px; color: #111827; }
    .chat-head-actions { margin-left: auto; display: flex; gap: 4px; }
    .chat-head-icon { width: 38px; height: 38px; border-radius: 50%; border: none; background: transparent; color: #6b7280; cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center; transition: background 0.12s; }
    .chat-head-icon:hover { background: #f3f4f6; color: #111827; }

    /* Export popover — anchored to chat-area top-right */
    .export-menu { position: absolute; top: 56px; right: 16px; z-index: 50; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.12); padding: 14px 16px; width: 260px; }
    .export-menu h4 { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; font-weight: 700; }
    .export-menu label { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #374151; margin-bottom: 8px; }
    .export-menu label span { width: 36px; color: #6b7280; }
    .export-menu input[type=date] { flex: 1; padding: 7px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; outline: none; background: #fff; font-family: inherit; }
    .export-menu input[type=date]:focus { border-color: #06c755; }
    .export-menu .hint { font-size: 10px; color: #9ca3af; margin: 4px 0 10px 44px; }
    .export-menu .actions { display: flex; gap: 8px; }
    .export-menu .actions button { flex: 1; padding: 9px; background: #fff; border: 1px solid #06c755; color: #06c755; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 12px; transition: background 0.12s; }
    .export-menu .actions button:hover { background: #ecfdf5; }

    .chat-scroll { flex: 1; overflow-y: auto; padding: 20px 24px; display: flex; flex-direction: column; gap: 8px; }
    .day-divider { text-align: center; margin: 16px 0 10px; font-size: 11px; color: #6b7280; }
    .day-divider span { background: rgba(0,0,0,0.08); padding: 3px 10px; border-radius: 10px; }

    /* Simple bubble layout — flex column, each bubble self-aligns by direction (old Kongkwun style). */
    .msg { max-width: 70%; padding: 10px 14px; border-radius: 16px; font-size: 14px; line-height: 1.5; word-wrap: break-word; }
    .msg.inbound { align-self: flex-start; background: #fff; border: 1px solid #e5e7eb; color: #111827; }
    .msg.outbound_admin { align-self: flex-end; background: #06c755; color: #fff; }
    .msg.outbound_bot { align-self: flex-end; background: #b2dfdb; color: #1f2937; }
    .msg-label { font-size: 10px; margin-bottom: 2px; color: #888; }
    .msg.outbound_bot .msg-label { color: #555; }
    .msg.outbound_admin .msg-label, .msg.outbound_admin .msg-time { color: rgba(255,255,255,0.8); }
    .msg-time { font-size: 10px; color: #9ca3af; margin-top: 4px; }
    .msg-media { max-width: 260px; border-radius: 10px; display: block; }
    .msg-audio { width: 260px; height: 40px; max-width: 100%; display: block; }
    .msg-file { display: inline-block; padding: 8px 12px; background: rgba(0,0,0,0.05); border-radius: 8px; margin-top: 4px; text-decoration: none; color: inherit; word-break: break-all; }
    .msg.outbound_admin .msg-file, .msg.outbound_bot .msg-file { background: rgba(255,255,255,0.25); color: inherit; }

    .chat-input { background: #fff; border-top: 1px solid #e5e7eb; padding: 10px 14px; display: flex; gap: 8px; align-items: center; }
    .chat-input input[type=text] { flex: 1; padding: 10px 16px; background: #f3f4f6; border: none; border-radius: 22px; font-size: 14px; outline: none; }
    .chat-input input[type=text]:focus { background: #fff; outline: 2px solid #06c755; outline-offset: -2px; }
    .icon-btn { width: 38px; height: 38px; border: none; background: transparent; border-radius: 50%; cursor: pointer; font-size: 18px; color: #6b7280; }
    .icon-btn:hover { background: #f3f4f6; }
    .btn-send { width: 40px; height: 40px; background: #06c755; color: #fff; border: none; border-radius: 50%; cursor: pointer; font-size: 18px; }
    .btn-send:disabled { background: #9ca3af; cursor: not-allowed; }

    /* === Info side === */
    .info-side { background: #fafbfc; border-left: 1px solid #e5e7eb; overflow-y: auto; }
    .info-head { padding: 24px 18px 16px; text-align: center; border-bottom: 1px solid #e5e7eb; background: #fff; }
    .info-head .avatar { width: 84px; height: 84px; font-size: 30px; margin: 0 auto 10px; }
    .info-head h3 { font-size: 17px; font-weight: 700; color: #111827; word-break: break-word; }
    .info-head .sub { font-size: 11px; color: #6b7280; margin-top: 4px; font-family: ui-monospace, monospace; word-break: break-all; }

    .info-body { padding: 16px 18px; }
    .info-block { margin-bottom: 18px; }
    .info-block h4 { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; font-weight: 600; }
    .info-row { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #f3f4f6; font-size: 13px; gap: 8px; }
    .info-row:last-child { border: none; }

    .info-row .k { color: #6b7280; flex-shrink: 0; }
    .info-row .v { color: #111827; font-weight: 500; text-align: right; word-break: break-word; }

    /* === States === */
    .empty-state { flex: 1; display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 14px; padding: 20px; text-align: center; }
    .loading-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: #6b7280; font-size: 13px; }
    .spinner { width: 36px; height: 36px; border: 3px solid #e5e7eb; border-top-color: #06c755; border-radius: 50%; animation: spin 0.9s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="app">

    <!-- User list -->
    <aside class="user-side">
      <div class="user-head">
        <h2>Daikinpromo Chat</h2>
        <p>หน้าจัดการแชท LINE OA</p>
      </div>
      <div class="search-wrap">
        <input class="search-input" type="text" id="userSearch" placeholder="ค้นหาชื่อ user..." autocomplete="off" />
      </div>
      <div class="tabs" id="tabs">
        <div class="tab active" data-filter="all">ทั้งหมด <span class="cnt" id="countAll">0</span></div>
        <div class="tab" data-filter="unread">ยังไม่ตอบ <span class="cnt" id="countUnread">0</span></div>
      </div>
      <div class="user-list" id="userList">
        <div class="empty-state">Loading...</div>
      </div>
    </aside>

    <!-- Chat area -->
    <main class="chat-area">
      <div class="chat-head" id="chatHeader">
        <span>เลือก user ทางซ้ายเพื่อเริ่มแชท</span>
      </div>
      <div class="export-menu" id="exportMenu" style="display:none;" onclick="event.stopPropagation()">
        <h4>Export บทสนทนา</h4>
        <label><span>จาก</span><input type="date" id="exportFrom" /></label>
        <label><span>ถึง</span><input type="date" id="exportTo" /></label>
        <div class="hint">เว้นว่าง = ทั้งหมด</div>
        <div class="actions">
          <button type="button" onclick="doExport('pdf')">📄 PDF</button>
          <button type="button" onclick="doExport('word')">📝 Word</button>
        </div>
      </div>
      <div class="chat-scroll" id="chatMessages">
        <div class="empty-state">ยังไม่มี user ที่เลือก</div>
      </div>
      <div class="chat-input" id="chatInput" style="display:none;">
        <input type="file" id="fileInput" hidden onchange="uploadMedia()" />
        <button class="icon-btn" id="uploadBtn" onclick="document.getElementById('fileInput').click()" title="แนบไฟล์">📎</button>
        <input type="text" id="msgInput" placeholder="พิมพ์ข้อความ..." />
        <button class="btn-send" id="sendBtn" onclick="sendMessage()">➤</button>
      </div>
    </main>

    <!-- Info side -->
    <aside class="info-side" id="infoSide">
      <div class="empty-state">เลือก user เพื่อดูข้อมูล</div>
    </aside>

  </div>

  <script>
    let currentUserId = null;
    let pollInterval = null;
    let lastMessageCount = 0;
    let userProfiles = {};
    let allUsers = [];
    let searchTerm = '';
    let activeFilter = 'all';
    let loadSeq = 0;

    function escapeHtml(str) {
      return String(str ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      })[c]);
    }

    function avatarMarkup(pictureUrl, name, sizeClass) {
      const initial = escapeHtml((name || '?').trim().charAt(0).toUpperCase() || '?');
      const safe = escapeHtml(name || '');
      if (pictureUrl) {
        return \`<img class="avatar \${sizeClass || ''}" src="\${escapeHtml(pictureUrl)}" alt="\${safe}" onerror="this.replaceWith(document.createRange().createContextualFragment('<div class=\\'avatar \${sizeClass || ''}\\'>\${initial}</div>').firstChild)" />\`;
      }
      return \`<div class="avatar \${sizeClass || ''}">\${initial}</div>\`;
    }

    function fmtTime(ts) {
      const d = new Date(ts);
      const today = new Date();
      const sameDay = d.toDateString() === today.toDateString();
      if (sameDay) return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short' });
    }

    function renderUserList() {
      const list = document.getElementById('userList');
      const countAllEl = document.getElementById('countAll');
      const countUnreadEl = document.getElementById('countUnread');

      const unreadUsers = allUsers.filter(u => Number(u.unreadCount || 0) > 0);
      countAllEl.textContent = allUsers.length;
      countUnreadEl.textContent = unreadUsers.length;

      const term = searchTerm.trim().toLowerCase();
      let users = activeFilter === 'unread' ? unreadUsers : allUsers;
      if (term) {
        users = users.filter(u => {
          const name = (u.displayName || u.lineUserId || '').toLowerCase();
          return name.includes(term);
        });
      }

      if (allUsers.length === 0) {
        list.innerHTML = '<div class="empty-state">ยังไม่มีการสนทนา</div>';
        list.dataset.hash = '';
        return;
      }
      if (users.length === 0) {
        const msg = term ? 'ไม่พบ user ที่ตรงกับคำค้น' : 'ไม่มี user ในหมวดนี้';
        list.innerHTML = \`<div class="empty-state">\${msg}</div>\`;
        list.dataset.hash = '';
        return;
      }

      const newHtml = users.map(u => {
        const rawName = u.displayName || u.lineUserId.substring(0, 12) + '...';
        const name = escapeHtml(rawName);
        const lastMsg = escapeHtml(u.content?.text || u.messageType || '');
        const time = fmtTime(u.timestamp);
        const avatar = avatarMarkup(u.pictureUrl, rawName);
        const n = Number(u.unreadCount || 0);
        const badge = n > 0
          ? \`<span class="unread-badge" title="ยังไม่ได้ตอบ \${n} ข้อความ">\${n > 99 ? '99+' : n}</span>\`
          : '';
        const unreadCls = n > 0 ? 'unread' : '';
        const activeCls = u.lineUserId === currentUserId ? 'active' : '';
        return \`
          <div class="user-item \${activeCls} \${unreadCls}" onclick="selectUser('\${escapeHtml(u.lineUserId)}')">
            <div class="avatar-wrap">\${avatar}</div>
            <div class="user-meta">
              <div class="user-top">
                <div class="user-name">\${name}</div>
                <div class="user-date">\${time}</div>
              </div>
              <div class="user-bottom">
                <div class="user-last">\${lastMsg}</div>
                \${badge}
              </div>
            </div>
          </div>
        \`;
      }).join('');

      if (list.dataset.hash !== newHtml) {
        list.innerHTML = newHtml;
        list.dataset.hash = newHtml;
      }
    }

    async function loadConversations() {
      try {
        const res = await fetch('/api/admin/conversations');
        const users = await res.json();
        users.forEach(u => {
          userProfiles[u.lineUserId] = {
            displayName: u.displayName || u.lineUserId.substring(0, 12) + '...',
            pictureUrl: u.pictureUrl || null,
          };
        });
        allUsers = users;
        renderUserList();
      } catch (err) {
        console.warn('loadConversations failed:', err);
      }
    }

    function renderInfoPanel(userId, profile, messageCount) {
      const info = document.getElementById('infoSide');
      const name = (profile?.displayName || userProfiles[userId]?.displayName || userId).trim();
      const pic = profile?.pictureUrl || userProfiles[userId]?.pictureUrl || null;
      const safeUserId = escapeHtml(userId);
      info.innerHTML = \`
        <div class="info-head">
          \${avatarMarkup(pic, name)}
          <h3>\${escapeHtml(name)}</h3>
          <div class="sub">\${safeUserId}</div>
        </div>
        <div class="info-body">
          <div class="info-block">
            <h4>สรุปการสนทนา</h4>
            <div class="info-row"><span class="k">จำนวนข้อความ</span><span class="v">\${messageCount}</span></div>
            <div class="info-row"><span class="k">LINE User ID</span><span class="v" style="font-family:ui-monospace,monospace;font-size:11px;">\${escapeHtml(userId.slice(0, 10))}...</span></div>
          </div>

        </div>
      \`;
    }

    function exportIconMarkup() {
      return \`<div class="chat-head-actions">
        <button type="button" class="chat-head-icon" onclick="toggleExportMenu(event)" title="Export บทสนทนา">⬇</button>
      </div>\`;
    }

    function toggleExportMenu(ev) {
      if (ev) ev.stopPropagation();
      const menu = document.getElementById('exportMenu');
      if (!menu) return;
      const opening = menu.style.display === 'none' || !menu.style.display;
      menu.style.display = opening ? 'block' : 'none';
    }

    // Close the popover when clicking anywhere else in the page.
    document.addEventListener('click', (ev) => {
      const menu = document.getElementById('exportMenu');
      if (!menu || menu.style.display === 'none') return;
      // Ignore clicks inside the menu itself or on the toggle button.
      if (menu.contains(ev.target) || ev.target.closest?.('.chat-head-icon')) return;
      menu.style.display = 'none';
    });

    function doExport(kind) {
      if (!currentUserId) return;
      const from = document.getElementById('exportFrom')?.value || '';
      const to = document.getElementById('exportTo')?.value || '';
      const qs = new URLSearchParams();
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      const url = \`/api/admin/conversations/\${encodeURIComponent(currentUserId)}/export/\${kind}\${qs.toString() ? '?' + qs.toString() : ''}\`;
      window.open(url, '_blank');
      const menu = document.getElementById('exportMenu');
      if (menu) menu.style.display = 'none';
    }

    async function selectUser(userId) {
      currentUserId = userId;
      lastMessageCount = -1;
      document.getElementById('chatInput').style.display = 'flex';

      document.querySelectorAll('.user-item').forEach(el => {
        el.classList.toggle('active', el.getAttribute('onclick')?.includes(userId));
      });

      const header = document.getElementById('chatHeader');
      const container = document.getElementById('chatMessages');
      const cached = userProfiles[userId];
      const headAvatar = avatarMarkup(cached?.pictureUrl, cached?.displayName || userId);
      header.innerHTML = \`\${headAvatar}<span class="name">\${escapeHtml(cached?.displayName || userId.substring(0, 20) + '...')}</span>\${exportIconMarkup()}\`;
      container.innerHTML = '<div class="loading-wrap"><div class="spinner"></div><div>กำลังโหลดข้อความ...</div></div>';
      renderInfoPanel(userId, null, '...');

      await loadMessages(userId, true);

      markAsRead(userId).then(() => {
        if (userId === currentUserId) loadConversations();
      }).catch(err => console.warn('mark-as-read failed:', err));

      if (pollInterval) clearInterval(pollInterval);
      pollInterval = setInterval(() => loadMessages(userId, false), 3000);
    }

    async function markAsRead(userId) {
      const res = await fetch(\`/api/admin/conversations/\${encodeURIComponent(userId)}/read\`, {
        method: 'PATCH',
      });
      if (!res.ok) throw new Error('mark-as-read HTTP ' + res.status);
    }

    async function loadMessages(userId, isInitial) {
      const mySeq = ++loadSeq;

      let data;
      try {
        const res = await fetch(\`/api/admin/conversations/\${encodeURIComponent(userId)}\`);
        data = await res.json();
      } catch (err) {
        if (mySeq === loadSeq && isInitial) {
          document.getElementById('chatMessages').innerHTML =
            '<div class="empty-state">โหลดข้อความไม่สำเร็จ</div>';
        }
        return;
      }

      if (mySeq !== loadSeq || userId !== currentUserId) return;

      const container = document.getElementById('chatMessages');
      const header = document.getElementById('chatHeader');
      const profile = data.profile;
      const name = profile?.displayName || userProfiles[userId]?.displayName || userId;
      const pic = profile?.pictureUrl || userProfiles[userId]?.pictureUrl || null;
      header.innerHTML = \`\${avatarMarkup(pic, name)}<span class="name">\${escapeHtml(name)}</span>\${exportIconMarkup()}\`;
      renderInfoPanel(userId, profile, data.messages.length);

      if (data.messages.length === lastMessageCount) return;
      lastMessageCount = data.messages.length;

      let lastDay = '';
      const html = data.messages.map(m => {
        const d = new Date(m.timestamp);
        const dayKey = d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' });
        let dayHtml = '';
        if (dayKey !== lastDay) {
          dayHtml = \`<div class="day-divider"><span>\${dayKey}</span></div>\`;
          lastDay = dayKey;
        }

        const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        const dir = m.direction;
        const label = dir === 'outbound_admin' ? 'Admin' : dir === 'outbound_bot' ? 'Bot' : '';
        const hasText = !!(m.content && m.content.text);
        const text = hasText ? escapeHtml(m.content.text) : '';
        const filename = m.content?.filename || '';
        const media = m.mediaUrl
          ? (m.messageType === 'video'
              ? \`<video class="msg-media" src="\${escapeHtml(m.mediaUrl)}" controls></video>\`
              : m.messageType === 'audio'
                ? \`<audio class="msg-audio" src="\${escapeHtml(m.mediaUrl)}" controls preload="metadata"></audio>\`
                : m.messageType === 'file'
                  ? \`<a class="msg-file" href="\${escapeHtml(m.mediaUrl)}" target="_blank" rel="noopener">📎 \${escapeHtml(filename || 'ดาวน์โหลดไฟล์')}</a>\`
                  : \`<img class="msg-media" src="\${escapeHtml(m.mediaUrl)}" alt="media" />\`)
          : '';
        return \`\${dayHtml}
          <div class="msg \${dir}">
            \${label ? \`<div class="msg-label">\${label}</div>\` : ''}
            \${media}
            \${hasText ? \`<div>\${text}</div>\` : ''}
            <div class="msg-time">\${time}</div>
          </div>\`;
      }).join('');

      container.innerHTML = html;
      container.scrollTop = container.scrollHeight;

      if (!isInitial && data.messages.some(m => m.direction === 'inbound')) {
        markAsRead(userId).then(() => {
          if (userId === currentUserId) loadConversations();
        }).catch(err => console.warn('mark-as-read failed:', err));
      }
    }

    async function sendMessage() {
      const input = document.getElementById('msgInput');
      const btn = document.getElementById('sendBtn');
      const message = input.value.trim();
      if (!message || !currentUserId) return;

      btn.disabled = true;
      input.value = '';

      try {
        await fetch('/api/admin/reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lineUserId: currentUserId, message })
        });
        lastMessageCount = -1;
        await loadMessages(currentUserId, false);
        await loadConversations();
      } catch (err) {
        alert('ส่งไม่สำเร็จ: ' + err.message);
        input.value = message;
      } finally {
        btn.disabled = false;
        input.focus();
      }
    }

    function makePlaceholderThumbnail() {
      return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        canvas.width = 480;
        canvas.height = 270;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 48px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('▶ VIDEO', canvas.width / 2, canvas.height / 2);
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('placeholder toBlob failed')), 'image/jpeg', 0.8);
      });
    }

    function generateVideoThumbnail(videoFile) {
      return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'auto';
        video.muted = true;
        video.playsInline = true;
        video.crossOrigin = 'anonymous';
        video.src = URL.createObjectURL(videoFile);

        const cleanup = () => URL.revokeObjectURL(video.src);
        const timeout = setTimeout(() => { cleanup(); reject(new Error('video load timeout')); }, 15000);

        const capture = () => {
          const w = video.videoWidth, h = video.videoHeight;
          if (!w || !h) return;
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(video, 0, 0, w, h);
          canvas.toBlob(blob => {
            clearTimeout(timeout);
            cleanup();
            blob ? resolve(blob) : reject(new Error('toBlob failed'));
          }, 'image/jpeg', 0.8);
        };

        video.onloadeddata = () => {
          const target = Math.min(0.5, (video.duration || 1) / 2);
          if (Math.abs(video.currentTime - target) < 0.01) capture();
          else video.currentTime = target;
        };
        video.onseeked = capture;
        video.onerror = () => { clearTimeout(timeout); cleanup(); reject(new Error('video load failed')); };
      });
    }

    const SIZE_LIMITS = {
      image: 10 * 1024 * 1024,
      video: 200 * 1024 * 1024,
      file:  50 * 1024 * 1024,
    };

    function formatMB(bytes) { return (bytes / 1024 / 1024).toFixed(2) + ' MB'; }

    async function uploadMedia() {
      const fileInput = document.getElementById('fileInput');
      const file = fileInput.files[0];
      if (!file || !currentUserId) return;

      const kind = file.type.startsWith('image/') ? 'image'
                 : file.type.startsWith('video/') ? 'video'
                 : 'file';
      const limit = SIZE_LIMITS[kind];
      if (file.size > limit) {
        alert(\`ไฟล์ใหญ่เกินไป\\n\\nประเภท: \${kind}\\nขนาดไฟล์: \${formatMB(file.size)}\\nขีดจำกัด: \${formatMB(limit)}\`);
        fileInput.value = '';
        return;
      }

      const formData = new FormData();
      formData.append('lineUserId', currentUserId);
      formData.append('file', file);

      if (file.type.startsWith('video/')) {
        let thumb;
        try {
          thumb = await generateVideoThumbnail(file);
        } catch (err) {
          console.warn('video thumbnail gen failed, using placeholder:', err);
          thumb = await makePlaceholderThumbnail();
        }
        formData.append('thumbnail', thumb, 'thumb.jpg');
      }

      try {
        const res = await fetch('/api/admin/upload', { method: 'POST', body: formData });
        if (!res.ok) throw new Error('upload failed');
        lastMessageCount = -1;
        await loadMessages(currentUserId, false);
        await loadConversations();
      } catch (err) {
        alert('อัพโหลดไม่สำเร็จ: ' + err.message);
      } finally {
        fileInput.value = '';
      }
    }

    document.getElementById('msgInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') sendMessage();
    });

    document.getElementById('userSearch').addEventListener('input', e => {
      searchTerm = e.target.value;
      renderUserList();
    });

    document.getElementById('tabs').addEventListener('click', e => {
      const tab = e.target.closest('.tab');
      if (!tab) return;
      activeFilter = tab.dataset.filter;
      document.querySelectorAll('.tab').forEach(el => el.classList.toggle('active', el === tab));
      renderUserList();
    });

    loadConversations();
    setInterval(loadConversations, 5000);
  </script>
</body>
</html>`;
