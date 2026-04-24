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
    .msg-file { display: inline-block; padding: 8px 12px; background: rgba(0,0,0,0.05); border-radius: 8px; margin-top: 4px; text-decoration: none; color: inherit; word-break: break-all; }
    .msg.outbound_admin .msg-file, .msg.outbound_bot .msg-file { background: rgba(255,255,255,0.25); color: inherit; }

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
        <input type="file" id="fileInput" style="display:none;" onchange="uploadMedia()" />
        <button id="uploadBtn" onclick="document.getElementById('fileInput').click()" title="แนบไฟล์">📎</button>
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
        const filename = m.content?.filename || '';
        const mediaHtml = m.mediaUrl
          ? m.messageType === 'video'
            ? \`<video class="msg-media" src="\${m.mediaUrl}" controls></video>\`
            : m.messageType === 'file'
              ? \`<a class="msg-file" href="\${m.mediaUrl}" target="_blank" rel="noopener">📎 \${filename || 'ดาวน์โหลดไฟล์'}</a>\`
              : \`<img class="msg-media" src="\${m.mediaUrl}" alt="media" />\`
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
          // Seek a bit into the video for a better frame
          const target = Math.min(0.5, (video.duration || 1) / 2);
          if (Math.abs(video.currentTime - target) < 0.01) capture();
          else video.currentTime = target;
        };
        video.onseeked = capture;
        video.onerror = () => { clearTimeout(timeout); cleanup(); reject(new Error('video load failed')); };
      });
    }

    const SIZE_LIMITS = {
      image: 10 * 1024 * 1024,    // 10 MB (LINE cap)
      video: 200 * 1024 * 1024,   // 200 MB (LINE cap)
      file:  50 * 1024 * 1024,    // 50 MB (document)
    };

    function formatMB(bytes) {
      return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    }

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
        const res = await fetch('/api/admin/upload', {
          method: 'POST',
          body: formData
        });
        if (!res.ok) throw new Error('upload failed');
        lastMessageCount = 0;
        await loadMessages(currentUserId);
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

    loadConversations();
    setInterval(loadConversations, 5000);
  </script>
</body>
</html>`;
