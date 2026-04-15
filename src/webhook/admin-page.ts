export const ADMIN_HTML = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kongkwun Bot - Admin Chat</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f0f2f5; }
    .container { display: flex; height: 100vh; }

    /* Sidebar */
    .sidebar { width: 320px; background: #fff; border-right: 1px solid #e0e0e0; display: flex; flex-direction: column; }
    .sidebar-header { padding: 16px; background: #06c755; color: #fff; font-size: 18px; font-weight: bold; }
    .user-list { flex: 1; overflow-y: auto; }
    .user-item { padding: 14px 16px; border-bottom: 1px solid #f0f0f0; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: background 0.15s; }
    .user-item:hover, .user-item.active { background: #e8f5e9; }
    .user-avatar { width: 40px; height: 40px; border-radius: 50%; background: #ccc; object-fit: cover; flex-shrink: 0; }
    .user-info { flex: 1; min-width: 0; }
    .user-name { font-weight: 600; font-size: 14px; }
    .user-last-msg { font-size: 12px; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .user-time { font-size: 11px; color: #aaa; }

    /* Chat Area */
    .chat-area { flex: 1; display: flex; flex-direction: column; }
    .chat-header { padding: 14px 20px; background: #fff; border-bottom: 1px solid #e0e0e0; font-weight: 600; display: flex; align-items: center; gap: 10px; }
    .chat-header-avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; }
    .chat-messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 8px; }
    .msg { max-width: 70%; padding: 10px 14px; border-radius: 16px; font-size: 14px; line-height: 1.5; word-wrap: break-word; }
    .msg.inbound { align-self: flex-start; background: #fff; border: 1px solid #e0e0e0; }
    .msg.outbound_admin { align-self: flex-end; background: #06c755; color: #fff; }
    .msg.outbound_bot { align-self: flex-end; background: #b2dfdb; color: #333; }
    .msg-time { font-size: 10px; color: #aaa; margin-top: 4px; }
    .msg.outbound_admin .msg-time, .msg.outbound_bot .msg-time { color: rgba(255,255,255,0.7); }
    .msg-label { font-size: 10px; margin-bottom: 2px; color: #888; }
    .msg.outbound_bot .msg-label { color: #555; }
    .msg-media { max-width: 250px; border-radius: 8px; margin-top: 4px; }

    /* Input */
    .chat-input { padding: 14px 20px; background: #fff; border-top: 1px solid #e0e0e0; display: flex; gap: 10px; }
    .chat-input input { flex: 1; padding: 10px 16px; border: 1px solid #ddd; border-radius: 24px; font-size: 14px; outline: none; }
    .chat-input input:focus { border-color: #06c755; }
    .chat-input button { padding: 10px 24px; background: #06c755; color: #fff; border: none; border-radius: 24px; font-size: 14px; cursor: pointer; }
    .chat-input button:hover { background: #05b34a; }
    .chat-input button:disabled { background: #ccc; cursor: not-allowed; }

    .empty-state { flex: 1; display: flex; align-items: center; justify-content: center; color: #aaa; font-size: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="sidebar">
      <div class="sidebar-header">Kongkwun Admin Chat</div>
      <div class="user-list" id="userList">
        <div class="empty-state">Loading...</div>
      </div>
    </div>
    <div class="chat-area">
      <div class="chat-header" id="chatHeader">เลือก user เพื่อเริ่มแชท</div>
      <div class="chat-messages" id="chatMessages">
        <div class="empty-state">เลือก user ทางซ้ายมือ</div>
      </div>
      <div class="chat-input" id="chatInput" style="display:none;">
        <input type="text" id="msgInput" placeholder="พิมพ์ข้อความ..." />
        <button id="sendBtn" onclick="sendMessage()">ส่ง</button>
      </div>
    </div>
  </div>

  <script>
    let currentUserId = null;
    let pollInterval = null;
    let lastMessageCount = 0;
    let userProfiles = {};  // Cache profiles

    async function loadConversations() {
      const res = await fetch('/api/admin/conversations');
      const users = await res.json();
      const list = document.getElementById('userList');

      if (users.length === 0) {
        list.innerHTML = '<div class="empty-state">ยังไม่มีการสนทนา</div>';
        return;
      }

      // Cache profiles
      users.forEach(u => {
        userProfiles[u.lineUserId] = {
          displayName: u.displayName || u.lineUserId.substring(0, 12) + '...',
          pictureUrl: u.pictureUrl || null
        };
      });

      const newHtml = users.map(u => {
        const name = u.displayName || u.lineUserId.substring(0, 12) + '...';
        const lastMsg = u.content?.text || u.messageType || '';
        const time = new Date(u.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        const avatarHtml = u.pictureUrl
          ? \`<img class="user-avatar" src="\${u.pictureUrl}" alt="" />\`
          : \`<div class="user-avatar"></div>\`;
        return \`
          <div class="user-item \${u.lineUserId === currentUserId ? 'active' : ''}"
               onclick="selectUser('\${u.lineUserId}')">
            \${avatarHtml}
            <div class="user-info">
              <div class="user-name">\${name}</div>
              <div class="user-last-msg">\${lastMsg}</div>
            </div>
            <div class="user-time">\${time}</div>
          </div>
        \`;
      }).join('');

      // Only update DOM if content changed (prevent flicker)
      if (list.dataset.hash !== newHtml) {
        list.innerHTML = newHtml;
        list.dataset.hash = newHtml;
      }
    }

    async function selectUser(userId) {
      currentUserId = userId;
      lastMessageCount = 0;
      document.getElementById('chatInput').style.display = 'flex';

      // Update sidebar active state without full reload
      document.querySelectorAll('.user-item').forEach(el => {
        el.classList.toggle('active', el.getAttribute('onclick')?.includes(userId));
      });

      await loadMessages(userId);

      if (pollInterval) clearInterval(pollInterval);
      pollInterval = setInterval(() => loadMessages(userId), 3000);
    }

    async function loadMessages(userId) {
      const res = await fetch(\`/api/admin/conversations/\${userId}\`);
      const data = await res.json();
      const container = document.getElementById('chatMessages');
      const header = document.getElementById('chatHeader');

      // Update header with profile
      const profile = data.profile;
      if (profile) {
        const avatarHtml = profile.pictureUrl
          ? \`<img class="chat-header-avatar" src="\${profile.pictureUrl}" alt="" />\`
          : '';
        header.innerHTML = \`\${avatarHtml}<span>\${profile.displayName}</span>\`;
      } else {
        const cached = userProfiles[userId];
        header.innerHTML = \`<span>\${cached?.displayName || userId.substring(0, 20) + '...'}</span>\`;
      }

      // Only re-render messages if count changed (prevent flicker)
      if (data.messages.length === lastMessageCount) return;
      lastMessageCount = data.messages.length;

      container.innerHTML = data.messages.map(m => {
        const time = new Date(m.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        const dir = m.direction;
        const label = dir === 'outbound_admin' ? 'Admin' : dir === 'outbound_bot' ? 'Bot' : '';
        const text = m.content?.text || m.messageType;
        const mediaHtml = m.mediaUrl
          ? \`<img class="msg-media" src="\${m.mediaUrl}" alt="media" />\`
          : '';

        return \`
          <div class="msg \${dir}">
            \${label ? \`<div class="msg-label">\${label}</div>\` : ''}
            \${mediaHtml}
            <div>\${text}</div>
            <div class="msg-time">\${time}</div>
          </div>
        \`;
      }).join('');

      container.scrollTop = container.scrollHeight;
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
        lastMessageCount = 0;  // Force refresh
        await loadMessages(currentUserId);
        await loadConversations();  // Update sidebar last message
      } catch (err) {
        alert('ส่งไม่สำเร็จ: ' + err.message);
        input.value = message;
      } finally {
        btn.disabled = false;
        input.focus();
      }
    }

    document.getElementById('msgInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') sendMessage();
    });

    loadConversations();
    setInterval(loadConversations, 5000);
  </script>
</body>
</html>`;
