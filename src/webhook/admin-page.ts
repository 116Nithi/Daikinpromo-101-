export const ADMIN_HTML = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daikinpromo Chat - Admin</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans Thai', sans-serif; background: #f0f2f5; color: #111827; font-size: 14px; }

    /* Responsive sidebars: bound by min px so they never get too cramped, and
       max % so they don't waste space on ultrawide monitors. Chat area takes
       whatever's left. Internal padding/fonts stay px for visual consistency. */
    .app { display: grid; grid-template-columns: minmax(280px, 22%) 1fr minmax(260px, 22%); height: 100vh; background: #fff; }

    /* === User list === */
    .user-side { background: #fff; border-right: 1px solid #e5e7eb; display: flex; flex-direction: column; overflow: hidden; }
    .user-head { background: #06c755; padding: 14px 16px; color: #fff; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .user-head .title { flex: 1; min-width: 0; }
    .user-head h2 { font-size: 16px; font-weight: 700; }
    .user-head p { font-size: 11px; opacity: 0.9; margin-top: 1px; }
    .user-head .settings-btn { width: 34px; height: 34px; border: none; background: rgba(255,255,255,0.18); color: #fff; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background 0.12s; }
    .user-head .settings-btn:hover { background: rgba(255,255,255,0.32); }
    .user-head .settings-btn svg { width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

    .search-wrap { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; }
    .search-input { width: 100%; padding: 8px 14px 8px 36px; background: #f3f4f6; border: none; border-radius: 20px; font-size: 13px; outline: none;
      background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='11' cy='11' r='8'/><line x1='21' y1='21' x2='16.65' y2='16.65'/></svg>");
      background-repeat: no-repeat; background-position: 12px center; }

    /* === Filter panel === */
    .filter-wrap { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; display: flex; flex-direction: column; gap: 8px; }
    .filter-row { display: flex; gap: 6px; align-items: center; }
    .filter-row.dates { gap: 4px; }
    .filter-row.dates input[type=date],
    .filter-row.dates input.date-pretty { flex: 1; min-width: 0; padding: 6px 8px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 11px; outline: none; background: #fff; font-family: inherit; color: #374151; }
    .filter-row.dates input[type=date]:focus,
    .filter-row.dates input.date-pretty:focus { border-color: #06c755; }

    /* Pretty date display: dd/mm/yyyy text overlay with the real <input type="date">
       sized to cover it (opacity 0). Clicking the field hits the native input,
       which opens its own picker — no fragile showPicker() call needed. */
    .date-wrap { position: relative; display: inline-flex; flex: 1; min-width: 0; }
    .date-wrap > .date-pretty { flex: 1; width: 100%; }
    .date-wrap > input[type=date] {
      position: absolute; inset: 0; width: 100%; height: 100%;
      opacity: 0; cursor: pointer; padding: 0; margin: 0; border: none;
    }
    input.date-pretty {
      cursor: pointer;
      background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><rect x='3' y='4' width='18' height='18' rx='2' ry='2'/><line x1='16' y1='2' x2='16' y2='6'/><line x1='8' y1='2' x2='8' y2='6'/><line x1='3' y1='10' x2='21' y2='10'/></svg>");
      background-repeat: no-repeat;
      background-position: right 8px center;
      background-size: 14px;
      padding-right: 28px !important;
    }
    .filter-row.dates .sep { font-size: 11px; color: #9ca3af; flex-shrink: 0; }
    .filter-section-label { font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; padding: 0 2px; }
    .filter-input { flex: 1; min-width: 0; padding: 7px 12px 7px 30px; background: #f3f4f6; border: none; border-radius: 16px; font-size: 12px; outline: none; font-family: inherit;
      background-repeat: no-repeat; background-position: 10px center; background-size: 14px; }
    .filter-input.icon-name { background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2'/><circle cx='12' cy='7' r='4'/></svg>"); }
    .filter-input.icon-msg { background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z'/></svg>"); }
    .filter-input:focus { background: #fff; outline: 2px solid #06c755; outline-offset: -2px; }
    .filter-select { flex: 1; min-width: 0; padding: 7px 24px 7px 12px; background: #f3f4f6; border: none; border-radius: 16px; font-size: 12px; outline: none; font-family: inherit; color: #374151; cursor: pointer; appearance: none;
      background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'><polyline points='6 9 12 15 18 9'/></svg>");
      background-repeat: no-repeat; background-position: right 8px center; background-size: 12px; }
    .filter-select:focus { background-color: #fff; outline: 2px solid #06c755; outline-offset: -2px; }
    .filter-btn { width: 32px; height: 32px; border: none; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: opacity 0.12s; }
    .filter-btn svg { width: 14px; height: 14px; stroke: #fff; fill: none; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
    .filter-btn:hover { opacity: 0.85; }
    .filter-btn.search { background: #f59e0b; }
    .filter-btn.refresh { background: #06c755; }

    .tabs { display: flex; padding: 0 12px; gap: 0; border-bottom: 1px solid #f3f4f6; }
    .tab { flex: 1; text-align: center; padding: 10px 0; font-size: 12px; color: #9ca3af; cursor: pointer; border-bottom: 2px solid transparent; user-select: none; transition: color 0.12s; }
    .tab:hover { color: #6b7280; }
    .tab.active { color: #06c755; border-bottom-color: #06c755; font-weight: 600; }
    .tab .cnt { display: inline-block; color: #9ca3af; padding: 0 4px; font-size: 11px; margin-left: 2px; font-weight: 500; }
    .tab.active .cnt { color: #06c755; font-weight: 600; }

    .user-list { flex: 1; overflow-y: auto; }
    .user-item { padding: 12px 14px; cursor: pointer; display: flex; gap: 10px; align-items: center; transition: background 0.12s; border-bottom: 1px solid #f3f4f6; }
    .user-item:hover { background: #f9fafb; }
    .user-item.active { background: #ecfdf5; }
    .user-item.unread .user-name { font-weight: 700; color: #000; }
    .user-item.unread .user-last { color: #374151; font-weight: 500; }

    .avatar-wrap { position: relative; flex-shrink: 0; }
    .avatar { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 16px; background: #9ca3af; object-fit: cover; overflow: hidden; }
    .unread-badge { min-width: 20px; height: 20px; padding: 0 6px; border-radius: 10px; background: #06c755; color: #fff; font-size: 11px; font-weight: 700; line-height: 20px; text-align: center; flex-shrink: 0; box-sizing: border-box; }
    .admin-flag { display: inline-flex; align-items: center; gap: 3px; padding: 2px 8px; border-radius: 10px; background: #fef3c7; color: #92400e; font-size: 10px; font-weight: 700; line-height: 1.4; flex-shrink: 0; white-space: nowrap; margin-left: 6px; border: 1px solid #fcd34d; }
    .admin-flag::before { content: "🔔"; font-size: 10px; }
    .user-tag { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; margin-top: 4px; border-radius: 11px; font-size: 10px; color: #374151; max-width: 100%; overflow: hidden; cursor: pointer; border: 1px solid transparent; background: #f3f4f6; font-family: inherit; transition: background 0.12s, border-color 0.12s; }
    .user-tag.has-status { background: #f3f4f6; }
    .user-tag.empty { background: transparent; border: 1px dashed #d1d5db; color: #9ca3af; }
    .user-tag:hover { background: #e5e7eb; border-color: #d1d5db; }
    .user-tag.empty:hover { color: #6b7280; border-color: #9ca3af; }
    .user-tag .dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
    .user-tag .label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .user-tag-row { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin-top: 4px; }
    .user-tag-row .user-tag { margin-top: 0; }
    /* Visual split between manual status chips and note-derived chips so it's
       obvious which group a tag belongs to. The thin vertical bar is only
       drawn when both groups are present. */
    .user-tag-group { display: inline-flex; flex-wrap: wrap; gap: 4px; }
    .user-tag-group + .user-tag-group { padding-left: 6px; border-left: 1px solid #e5e7eb; margin-left: 2px; }
    .user-tag.from-note { background: #fff7e6; border-color: #fde68a; }
    .user-tag.from-note:hover { background: #ffefcc; border-color: #f5d472; }
    .user-tag .src { font-size: 9px; opacity: 0.7; flex-shrink: 0; }

    /* Status popover (per-user assignment) */
    .status-popover { position: fixed; z-index: 200; width: 280px; background: #fff; box-shadow: 0 8px 30px rgba(0,0,0,0.15); border: 1px solid #e5e7eb; border-radius: 8px; padding: 4px 0; display: none; max-height: calc(100vh - 80px); overflow-y: auto; }
    .status-popover.show { display: block; }
    .status-popover .pop-head { display: flex; justify-content: space-between; align-items: center; padding: 8px 14px; border-bottom: 1px solid #f3f4f6; margin-bottom: 4px; }
    .status-popover .pop-head span { font-size: 11px; color: #9ca3af; font-weight: 600; letter-spacing: 0.4px; text-transform: uppercase; }
    .status-popover .pop-clear { background: transparent; border: none; color: #9ca3af; cursor: pointer; font-size: 11px; padding: 2px 0; font-family: inherit; }
    .status-popover .pop-clear:hover { color: #d93025; }
    .status-popover .pop-clear:disabled { opacity: 0.4; cursor: not-allowed; }
    .status-popover .status-opt { display: flex; align-items: center; gap: 10px; padding: 7px 14px; cursor: pointer; font-size: 13px; color: #1a1a1a; transition: background 0.1s; }
    .status-popover .status-opt:hover { background: #f5f5f5; }
    .status-popover .status-opt .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .status-popover .status-opt .check { margin-left: auto; color: #2d6cdf; font-weight: 600; visibility: hidden; }
    .status-popover .status-opt.selected { background: #f0f6ff; }
    .status-popover .status-opt.selected .check { visibility: visible; }
    .status-popover .pop-foot { display: flex; justify-content: flex-end; padding: 8px 14px; border-top: 1px solid #f3f4f6; margin-top: 4px; }
    .status-popover .status-group-head { padding: 6px 14px 2px; font-size: 10px; font-weight: 600; color: #9ca3af; letter-spacing: 0.4px; text-transform: uppercase; }
    .status-popover .status-group-head + .status-group-head { margin-top: 4px; }
    .status-popover .status-group-head:not(:first-child) { border-top: 1px solid #f3f4f6; margin-top: 4px; padding-top: 8px; }
    .status-popover .pop-manage { background: transparent; border: none; color: #2d6cdf; cursor: pointer; font-size: 12px; font-family: inherit; padding: 2px 0; }
    .status-popover .pop-manage:hover { text-decoration: underline; }

    /* Manage tags modal */
    .tag-mgr-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: none; align-items: center; justify-content: center; z-index: 105; }
    .tag-mgr-overlay.show { display: flex; }
    /* Note category manager opens FROM the note add/edit modal (z-index 110)
       so it needs to sit above the note overlay, not behind it. */
    #noteCatMgrOverlay { z-index: 130; }
    .tag-mgr-modal { background: #fff; width: 540px; max-width: 92vw; max-height: 86vh; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.25); display: flex; flex-direction: column; overflow: hidden; }
    .tag-mgr-head { padding: 18px 22px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
    .tag-mgr-head h3 { font-size: 16px; font-weight: 700; color: #111827; }
    .tag-mgr-close { border: none; background: transparent; font-size: 22px; color: #6b7280; cursor: pointer; width: 30px; height: 30px; border-radius: 50%; }
    .tag-mgr-close:hover { background: #f3f4f6; }
    .tag-mgr-body { padding: 14px 22px; overflow-y: auto; flex: 1; }
    .tag-mgr-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
    .tag-mgr-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; }
    .tag-mgr-row .dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
    .tag-mgr-row .name { flex: 1; min-width: 0; font-size: 13px; color: #111827; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tag-mgr-row .actions { display: flex; gap: 4px; flex-shrink: 0; }
    .tag-mgr-row .icon-btn { width: 30px; height: 30px; border: 1px solid #e5e7eb; background: #fff; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; padding: 0; color: #6b7280; }
    .tag-mgr-row .icon-btn:hover { background: #f3f4f6; color: #111827; }
    .tag-mgr-row .icon-btn.danger:hover { color: #d93025; }
    .tag-mgr-row .icon-btn svg { width: 14px; height: 14px; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

    .tag-form { border: 1px dashed #d1d5db; border-radius: 8px; padding: 14px 16px; background: #fafafa; }
    .tag-form-title { font-size: 12px; color: #6b7280; font-weight: 600; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.4px; }
    .tag-form-fields { display: flex; gap: 8px; align-items: center; }
    .tag-form-fields input[type=text] { flex: 1; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; outline: none; font-family: inherit; }
    .tag-form-fields input[type=text]:focus { border-color: #2d6cdf; }
    .tag-form-fields input[type=color] { width: 38px; height: 36px; border: 1px solid #d1d5db; border-radius: 6px; padding: 2px; cursor: pointer; background: #fff; }
    .tag-form-fields .save-btn { padding: 8px 16px; border: none; border-radius: 6px; background: #2d6cdf; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
    .tag-form-fields .save-btn:hover { background: #1e58c4; }
    .tag-form-fields .save-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .tag-form-fields .cancel-btn { padding: 8px 12px; border: 1px solid #d1d5db; background: #fff; border-radius: 6px; cursor: pointer; font-size: 13px; color: #6b7280; font-family: inherit; }
    .tag-form-fields .cancel-btn:hover { background: #f3f4f6; }

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
    .chat-head-icon {
      width: 38px; height: 38px; border-radius: 50%; border: none;
      background: #06c755; color: #fff; cursor: pointer; font-size: 18px;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.12s, transform 0.12s;
      box-shadow: 0 2px 6px rgba(6,199,85,0.3);
    }
    .chat-head-icon:hover { background: #05a847; transform: translateY(-1px); }
    .chat-head-icon:active { transform: translateY(0); }
    .chat-head-icon svg { width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }

    /* === Bulk export modal === */
    .bulk-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: none; align-items: center; justify-content: center; z-index: 100; }
    .bulk-overlay.show { display: flex; }
    .bulk-modal { background: #fff; width: 520px; max-width: 92vw; max-height: 86vh; border-radius: 14px; box-shadow: 0 20px 60px rgba(0,0,0,0.25); display: flex; flex-direction: column; overflow: hidden; }
    .bulk-head { padding: 16px 20px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
    .bulk-head h3 { font-size: 15px; font-weight: 700; color: #111827; }
    .bulk-close { border: none; background: transparent; font-size: 22px; color: #6b7280; cursor: pointer; width: 30px; height: 30px; border-radius: 50%; }
    .bulk-close:hover { background: #f3f4f6; color: #111827; }
    .bulk-meta { padding: 14px 20px 8px; border-bottom: 1px solid #f3f4f6; font-size: 12px; color: #374151; display: flex; flex-direction: column; gap: 10px; }
    .bulk-field { display: flex; align-items: center; gap: 10px; }
    .bulk-field > span { width: 80px; color: #6b7280; flex-shrink: 0; font-weight: 600; }
    .bulk-field input[type=text] { flex: 1; padding: 7px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; outline: none; font-family: inherit; }
    .bulk-field input[type=text]:focus { border-color: #06c755; }
    .bulk-dates { display: flex; gap: 12px; }
    .bulk-dates label { display: flex; align-items: center; gap: 6px; flex: 1; }
    .bulk-dates label > span { color: #6b7280; font-weight: 600; }
    /* Match the gray pill style of the sidebar's name-search input so the
       export modal's date fields don't look like a different design system */
    .bulk-dates input.date-pretty {
      flex: 1; min-width: 0;
      padding: 7px 28px 7px 12px;
      background-color: #f3f4f6;
      border: none;
      border-radius: 16px;
      font-size: 12px;
      outline: none;
      font-family: inherit;
      color: #374151;
    }
    .bulk-dates input.date-pretty:focus { background-color: #fff; outline: 2px solid #06c755; outline-offset: -2px; }
    .bulk-dates input.date-pretty::placeholder { color: #9ca3af; }
    .bulk-toolbar { padding: 8px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f3f4f6; gap: 8px; }
    .bulk-hint { font-size: 11px; color: #9ca3af; }
    .bulk-toggle-all { background: transparent; border: 1px solid #d1d5db; color: #374151; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 11px; flex-shrink: 0; }
    .bulk-toggle-all:hover { background: #f3f4f6; }
    .bulk-list { flex: 1; overflow-y: auto; padding: 4px 0; }
    .bulk-item { padding: 10px 20px; display: flex; align-items: center; gap: 10px; cursor: pointer; border-bottom: 1px solid #f9fafb; user-select: none; transition: opacity 0.12s; }
    .bulk-item:hover { background: #f9fafb; }
    .bulk-item.out-of-range { opacity: 0.35; pointer-events: none; }
    .bulk-item.out-of-range::after { content: 'ไม่มีข้อความในช่วงนี้'; font-size: 10px; color: #9ca3af; margin-left: auto; padding-left: 8px; flex-shrink: 0; }
    .bulk-item input[type=checkbox] { width: 16px; height: 16px; accent-color: #06c755; cursor: pointer; flex-shrink: 0; }
    .bulk-item .avatar { width: 32px; height: 32px; font-size: 12px; flex-shrink: 0; }
    .bulk-item .bulk-name { font-size: 13px; color: #111827; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1 1 auto; }
    .bulk-item .bulk-sub { font-size: 10px; color: #9ca3af; font-family: ui-monospace, monospace; }

    /* Quick-apply toolbar */
    .bulk-quick { padding: 10px 20px 12px; border-bottom: 1px solid #f3f4f6; display: flex; align-items: center; gap: 8px; font-size: 12px; }
    .bulk-quick-label { color: #6b7280; flex-shrink: 0; font-size: 11px; }
    .bulk-quick .topic-chip { flex: 1; min-width: 0; }
    .bulk-quick .quick-apply { padding: 5px 12px; border: 1px solid #d1d5db; background: #fff; color: #374151; border-radius: 6px; cursor: pointer; font-size: 11px; flex-shrink: 0; }
    .bulk-quick .quick-apply:hover { background: #f3f4f6; }
    .bulk-quick .quick-apply:disabled { opacity: 0.4; cursor: not-allowed; }

    /* Topic chip (in row + quick-apply) */
    .topic-chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 14px; border: 1px dashed #d1d5db; background: #fff; cursor: pointer; font-size: 11px; color: #6b7280; max-width: 200px; transition: border-color 0.12s, background 0.12s; flex-shrink: 0; font-family: inherit; }
    .topic-chip:hover { border-color: #9ca3af; background: #f9fafb; }
    .topic-chip.has-topic { border-style: solid; color: #1a1a1a; background: #fafafa; }
    .topic-chip .dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
    .topic-chip .label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px; }
    .topic-chip .caret { font-size: 9px; color: #9ca3af; flex-shrink: 0; }

    /* Topic popover */
    .topic-popover { position: fixed; z-index: 200; width: 240px; background: #fff; box-shadow: 0 8px 30px rgba(0,0,0,0.15); border: 1px solid #e5e7eb; border-radius: 8px; padding: 4px 0; display: none; max-height: calc(100vh - 80px); overflow-y: auto; }
    .topic-popover.show { display: block; }
    .topic-popover .pop-head { display: flex; justify-content: space-between; align-items: center; padding: 6px 12px 4px; border-bottom: 1px solid #f3f4f6; margin-bottom: 4px; }
    .topic-popover .pop-head span { font-size: 11px; color: #9ca3af; font-weight: 600; letter-spacing: 0.4px; text-transform: uppercase; }
    .topic-popover .pop-clear { background: transparent; border: none; color: #9ca3af; cursor: pointer; font-size: 11px; padding: 2px 0; font-family: inherit; }
    .topic-popover .pop-clear:hover { color: #d93025; }
    .topic-popover .pop-clear:disabled { opacity: 0.4; cursor: not-allowed; }
    .topic-popover .topic-opt { display: flex; align-items: center; gap: 10px; padding: 7px 12px; cursor: pointer; font-size: 13px; color: #1a1a1a; transition: background 0.1s; }
    .topic-popover .topic-opt:hover { background: #f5f5f5; }
    .topic-popover .topic-opt .dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
    .topic-popover .topic-opt .check { margin-left: auto; color: #2d6cdf; font-weight: 600; visibility: hidden; font-size: 13px; }
    .topic-popover .topic-opt.selected { background: #f0f6ff; }
    .topic-popover .topic-opt.selected .check { visibility: visible; }
    .topic-popover .topic-opt.other-opt { flex-wrap: wrap; }
    .topic-popover .topic-other-input { width: 100%; padding: 6px 0 0 17px; display: none; }
    .topic-popover .topic-other-input.show { display: block; }
    .topic-popover .topic-other-input input { width: 100%; border: none; border-bottom: 1px solid #d1d5db; padding: 4px 2px; font-size: 12px; outline: none; font-family: inherit; }
    .topic-popover .topic-other-input input:focus { border-color: #1a1a1a; }
    .bulk-footer { padding: 12px 20px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; gap: 8px; background: #fafbfc; }
    .bulk-count { font-size: 12px; color: #6b7280; }
    .bulk-count b { color: #06c755; }
    .bulk-actions-row { display: flex; gap: 8px; }
    .bulk-action-btn { padding: 8px 16px; border-radius: 8px; border: 1px solid #06c755; background: #fff; color: #06c755; font-weight: 600; font-size: 12px; cursor: pointer; }
    .bulk-action-btn.primary { background: #06c755; color: #fff; }
    .bulk-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .bulk-action-btn:not(:disabled):hover { background: #ecfdf5; }
    .bulk-action-btn.primary:not(:disabled):hover { background: #05a847; }

    .chat-scroll { flex: 1; overflow-y: auto; padding: 20px 24px; display: flex; flex-direction: column; gap: 8px; }
    .day-divider { text-align: center; margin: 16px 0 10px; font-size: 11px; color: #6b7280; }
    .day-divider span { background: rgba(0,0,0,0.08); padding: 3px 10px; border-radius: 10px; }

    .msg { max-width: 70%; padding: 10px 14px; border-radius: 16px; font-size: 14px; line-height: 1.5; word-wrap: break-word; }
    .msg.inbound { align-self: flex-start; background: #fff; border: 1px solid #e5e7eb; color: #111827; }
    .msg.outbound_admin { align-self: flex-end; background: #06c755; color: #fff; }
    .msg.outbound_bot { align-self: flex-end; background: #b2dfdb; color: #1f2937; }
    /* Bubbles whose content is just a media element — shrink to image size, drop padding */
    .msg:has(.msg-media) { width: fit-content; max-width: 340px; padding: 4px; }
    .msg-label { font-size: 10px; margin-bottom: 2px; color: #888; }
    .msg.outbound_bot .msg-label { color: #555; }
    .msg.outbound_admin .msg-label, .msg.outbound_admin .msg-time { color: rgba(255,255,255,0.8); }
    .msg-time { font-size: 10px; color: #9ca3af; margin-top: 4px; }
    .msg-media { max-width: min(320px, 100%); max-height: 400px; object-fit: contain; border-radius: 10px; display: block; height: auto; }
    img.msg-media { cursor: zoom-in; transition: opacity 0.12s; }
    img.msg-media:hover { opacity: 0.92; }

    /* Image lightbox */
    .lightbox { position: fixed; inset: 0; background: rgba(0,0,0,0.88); display: none; align-items: center; justify-content: center; z-index: 300; cursor: zoom-out; }
    .lightbox.show { display: flex; }
    .lightbox img { max-width: 95vw; max-height: 95vh; object-fit: contain; box-shadow: 0 4px 32px rgba(0,0,0,0.5); }
    .lightbox-close { position: absolute; top: 18px; right: 18px; width: 40px; height: 40px; border: none; background: rgba(255,255,255,0.18); color: #fff; border-radius: 50%; cursor: pointer; font-size: 22px; display: flex; align-items: center; justify-content: center; }
    .lightbox-close:hover { background: rgba(255,255,255,0.32); }
    .msg-audio { width: 260px; height: 40px; max-width: 100%; display: block; }
    .msg-file { display: inline-block; padding: 8px 12px; background: rgba(0,0,0,0.05); border-radius: 8px; margin-top: 4px; text-decoration: none; color: inherit; word-break: break-all; }
    .msg.outbound_admin .msg-file, .msg.outbound_bot .msg-file { background: rgba(255,255,255,0.25); color: inherit; }

    /* Reply / Quote feature */
    .msg { position: relative; }
    .msg-reply-btn { position: absolute; top: 4px; opacity: 0; visibility: hidden; transition: opacity 0.12s; width: 24px; height: 24px; border: none; background: rgba(255,255,255,0.96); border-radius: 50%; cursor: pointer; color: #6b7280; display: inline-flex; align-items: center; justify-content: center; padding: 0; box-shadow: 0 1px 4px rgba(0,0,0,0.15); z-index: 2; font-size: 13px; }
    .msg.inbound .msg-reply-btn { right: -12px; }
    .msg.outbound_admin .msg-reply-btn, .msg.outbound_bot .msg-reply-btn { left: -12px; }
    .msg:hover .msg-reply-btn { opacity: 1; visibility: visible; }
    .msg-reply-btn:hover { color: #1a1a1a; background: #fff; }

    .msg-quote-box { background: rgba(0,0,0,0.06); border-left: 3px solid rgba(0,0,0,0.18); padding: 6px 10px; border-radius: 6px; margin-bottom: 6px; font-size: 12px; line-height: 1.4; cursor: pointer; max-width: 100%; }
    .msg.outbound_admin .msg-quote-box, .msg.outbound_bot .msg-quote-box { background: rgba(255,255,255,0.18); border-left-color: rgba(255,255,255,0.5); }
    .msg-quote-author { font-weight: 700; opacity: 0.85; margin-bottom: 2px; }
    .msg-quote-body { opacity: 0.85; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-break: break-word; }

    /* Quote banner above message input */
    .quote-banner { width: 100%; display: none; align-items: stretch; gap: 0; background: #f3f4f6; border-left: 3px solid #06c755; border-radius: 6px; padding: 8px 10px; margin-bottom: 6px; font-size: 12px; }
    .quote-banner.show { display: flex; }
    .quote-banner .quote-content { flex: 1; min-width: 0; }
    .quote-banner .quote-content .quote-label { font-size: 10px; color: #06c755; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 2px; }
    .quote-banner .quote-content .quote-text { color: #374151; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-break: break-word; }
    .quote-banner .quote-cancel { width: 24px; height: 24px; border: none; background: transparent; color: #6b7280; cursor: pointer; border-radius: 50%; flex-shrink: 0; align-self: flex-start; }
    .quote-banner .quote-cancel:hover { background: rgba(0,0,0,0.06); color: #d93025; }

    /* Confirm modal (delete chat etc.) */
    .confirm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: none; align-items: center; justify-content: center; z-index: 250; }
    .confirm-overlay.show { display: flex; }
    .confirm-modal { background: #fff; width: 380px; max-width: 92vw; border-radius: 12px; box-shadow: 0 12px 48px rgba(0,0,0,0.25); overflow: hidden; }
    .confirm-head { padding: 18px 22px 4px; }
    .confirm-head h3 { font-size: 16px; font-weight: 700; color: #111827; }
    .confirm-body { padding: 8px 22px 18px; font-size: 13px; color: #4b5563; line-height: 1.55; white-space: pre-wrap; }
    .confirm-warn { padding: 10px 22px; background: #fef3c7; color: #92400e; font-size: 12px; line-height: 1.5; border-top: 1px solid #fcd34d; border-bottom: 1px solid #fcd34d; }
    .confirm-actions { display: flex; justify-content: flex-end; gap: 8px; padding: 14px 22px; background: #fafbfc; }
    .confirm-actions button { padding: 8px 18px; border-radius: 8px; border: 1px solid #d1d5db; background: #fff; cursor: pointer; font-size: 13px; font-weight: 600; font-family: inherit; }
    .confirm-actions button:hover { background: #f3f4f6; }
    .confirm-actions button.danger { background: #d93025; color: #fff; border-color: #d93025; }
    .confirm-actions button.danger:hover { background: #b62519; border-color: #b62519; }

    /* Kebab menu on user-item + context dropdown */
    .user-kebab { position: absolute; top: 8px; right: 12px; width: 26px; height: 26px; border: none; background: rgba(255,255,255,0.85); color: #6b7280; border-radius: 50%; cursor: pointer; display: none; align-items: center; justify-content: center; font-size: 16px; line-height: 1; padding: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .user-item { position: relative; }
    .user-item:hover .user-kebab { display: inline-flex; }
    .user-kebab:hover { background: #f3f4f6; color: #111827; }
    .pin-mark { display: inline-flex; align-items: center; margin-right: 4px; }

    .chat-context-menu { position: fixed; z-index: 220; min-width: 180px; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 8px 28px rgba(0,0,0,0.15); padding: 6px 0; display: none; }
    .chat-context-menu.show { display: block; }
    .chat-context-menu .ctx-item { display: flex; align-items: center; gap: 10px; padding: 8px 14px; font-size: 13px; color: #1a1a1a; cursor: pointer; }
    .chat-context-menu .ctx-item:hover { background: #f5f5f5; }
    .chat-context-menu .ctx-item.danger { color: #d93025; }
    .chat-context-menu .ctx-item.danger:hover { background: #fef2f2; }
    .chat-context-menu .ctx-divider { height: 1px; background: #e5e7eb; margin: 4px 0; }

    .chat-context-menu .ctx-icon { width: 16px; height: 16px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; }
    .chat-context-menu .ctx-icon svg { width: 16px; height: 16px; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; display: block; }
    .pin-mark svg { width: 11px; height: 11px; stroke: #f59e0b; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; vertical-align: middle; }

    .pin-badge { display: inline-block; margin-right: 4px; color: #f59e0b; font-size: 11px; }
    .user-item.is-spam { opacity: 0.6; }

    /* === Quick reply templates ====================================== */
    .tpl-bar { position: relative; display: flex; align-items: center; gap: 8px; padding: 6px 14px; background: rgba(255,255,255,0.7); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border-top: 1px solid #e5e7eb; }
    .tpl-chips { flex: 1; display: flex; gap: 6px; overflow-x: auto; scrollbar-width: thin; scroll-behavior: smooth; }
    .tpl-chips::-webkit-scrollbar { height: 4px; }
    .tpl-chips::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 2px; }
    .tpl-chip { flex-shrink: 0; padding: 5px 12px; background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; font-size: 12px; color: #374151; cursor: pointer; white-space: nowrap; max-width: 240px; overflow: hidden; text-overflow: ellipsis; transition: background 0.12s, border-color 0.12s; font-family: inherit; }
    .tpl-chip:hover { background: #f3f4f6; border-color: #06c755; color: #1a1a1a; }
    .tpl-chips-empty { font-size: 11px; color: #9ca3af; padding: 4px 0; }
    .tpl-toggle { width: 28px; height: 28px; border: none; background: rgba(255,255,255,0.6); color: #6b7280; cursor: pointer; border-radius: 50%; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; transition: background 0.12s, transform 0.18s; }
    .tpl-toggle:hover { background: #f3f4f6; color: #1a1a1a; }
    .tpl-toggle svg { width: 14px; height: 14px; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .tpl-bar.expanded .tpl-toggle svg { transform: rotate(180deg); transition: transform 0.18s; }
    /* Slide-up panel — anchored above the bar, max 5 rows visible */
    .tpl-panel { position: absolute; bottom: 100%; left: 14px; right: 14px; background: rgba(255,255,255,0.95); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid #e5e7eb; border-radius: 10px 10px 0 0; box-shadow: 0 -8px 24px rgba(0,0,0,0.08); max-height: 320px; display: flex; flex-direction: column; opacity: 0; transform: translateY(8px); pointer-events: none; transition: opacity 0.18s, transform 0.18s; }
    .tpl-panel.show { opacity: 1; transform: translateY(0); pointer-events: auto; }
    .tpl-panel-head { display: flex; align-items: center; padding: 10px 14px; border-bottom: 1px solid #f3f4f6; }
    .tpl-panel-title { flex: 1; font-size: 12px; font-weight: 600; color: #1a1a1a; }
    .tpl-panel-add { background: #06c755; color: #fff; border: none; padding: 5px 12px; border-radius: 14px; font-size: 11px; font-weight: 600; cursor: pointer; font-family: inherit; }
    .tpl-panel-add:hover { background: #05a847; }
    .tpl-panel-add:disabled { background: #d1d5db; cursor: not-allowed; }
    .tpl-panel-list { overflow-y: auto; padding: 4px 0; }
    .tpl-row { display: flex; align-items: center; gap: 10px; padding: 8px 14px; cursor: pointer; transition: background 0.1s; }
    .tpl-row:hover { background: #f3f4f6; }
    .tpl-row .tpl-text { flex: 1; min-width: 0; font-size: 13px; color: #374151; line-height: 1.35; max-height: 36px; overflow: hidden; }
    .tpl-row .tpl-row-actions { display: flex; gap: 2px; flex-shrink: 0; }
    .tpl-row .icon-btn { width: 26px; height: 26px; border: none; background: transparent; color: #6b7280; cursor: pointer; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; }
    .tpl-row .icon-btn:hover { background: #e5e7eb; color: #1a1a1a; }
    .tpl-row .icon-btn.danger:hover { background: #fef2f2; color: #d93025; }
    .tpl-row .icon-btn svg { width: 14px; height: 14px; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .tpl-empty-state { text-align: center; color: #9ca3af; font-size: 12px; padding: 20px; }

    /* Template edit modal */
    .tpl-edit-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: none; align-items: center; justify-content: center; z-index: 140; }
    .tpl-edit-overlay.show { display: flex; }
    .tpl-edit-modal { background: #fff; width: 440px; max-width: 92vw; border-radius: 10px; box-shadow: 0 8px 40px rgba(0,0,0,0.18); overflow: hidden; display: flex; flex-direction: column; }
    .tpl-edit-head { display: flex; align-items: center; padding: 16px 20px; border-bottom: 1px solid #f3f4f6; }
    .tpl-edit-head h3 { flex: 1; font-size: 15px; font-weight: 600; color: #1a1a1a; }
    .tpl-edit-body { padding: 16px 20px; }
    .tpl-edit-label { display: block; font-size: 11px; color: #6b7280; font-weight: 600; letter-spacing: 0.4px; text-transform: uppercase; margin: 8px 0 6px; }
    .tpl-edit-body input, .tpl-edit-body textarea { width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; outline: none; font-family: inherit; box-sizing: border-box; resize: vertical; }
    .tpl-edit-body input:focus, .tpl-edit-body textarea:focus { border-color: #06c755; }
    .tpl-edit-actions { display: flex; justify-content: flex-end; gap: 12px; padding: 12px 20px; border-top: 1px solid #f3f4f6; background: #fafafa; }
    .tpl-edit-row { display: flex; align-items: center; justify-content: space-between; margin: 14px 0 8px; gap: 10px; }
    .tpl-asset-count { font-size: 11px; color: #9ca3af; font-weight: 400; text-transform: none; letter-spacing: 0; margin-left: 4px; }
    .tpl-asset-add-btn { background: #f3f4f6; border: 1px dashed #d1d5db; color: #6b7280; padding: 5px 14px; border-radius: 14px; font-size: 11px; cursor: pointer; font-family: inherit; transition: background 0.12s, border-color 0.12s, color 0.12s; }
    .tpl-asset-add-btn:hover { background: #e5e7eb; border-color: #06c755; color: #06c755; }
    .tpl-asset-add-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .tpl-edit-assets { display: flex; flex-wrap: wrap; gap: 8px; min-height: 70px; padding: 8px; background: #fafafa; border-radius: 8px; }
    .tpl-asset-empty { color: #9ca3af; font-size: 11px; padding: 16px; width: 100%; text-align: center; }
    .tpl-asset { position: relative; width: 70px; height: 70px; border-radius: 6px; overflow: hidden; background: #e5e7eb; flex-shrink: 0; }
    .tpl-asset img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .tpl-asset.uploading { opacity: 0.5; }
    .tpl-asset .tpl-asset-spinner { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 11px; background: rgba(0,0,0,0.4); }
    .tpl-asset .tpl-asset-badge { position: absolute; top: 4px; left: 4px; background: rgba(0,0,0,0.6); color: #fff; padding: 1px 5px; border-radius: 3px; font-size: 9px; font-weight: 600; }
    .tpl-asset .tpl-asset-remove { position: absolute; top: 2px; right: 2px; width: 18px; height: 18px; border: none; background: rgba(0,0,0,0.6); color: #fff; border-radius: 50%; cursor: pointer; font-size: 12px; line-height: 1; padding: 0; display: flex; align-items: center; justify-content: center; }
    .tpl-asset .tpl-asset-remove:hover { background: #d93025; }

    /* Chip indicator when template has attachments */
    .tpl-chip.has-assets { padding-left: 8px; }
    .tpl-chip.has-assets::before { content: "📎"; margin-right: 4px; font-size: 11px; opacity: 0.7; }

    /* Editor — ordered items list */
    .tpl-items-list { display: flex; flex-direction: column; gap: 6px; padding: 8px; background: #fafafa; border-radius: 8px; min-height: 60px; }
    .tpl-items-empty { color: #9ca3af; font-size: 12px; padding: 16px; text-align: center; }
    .tpl-item { display: flex; align-items: stretch; gap: 6px; background: #fff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 6px; }
    .tpl-item.uploading { opacity: 0.5; }
    .tpl-item-handle { display: flex; flex-direction: column; gap: 2px; flex-shrink: 0; }
    .tpl-item-handle button { width: 22px; height: 18px; border: none; background: #f3f4f6; color: #6b7280; cursor: pointer; border-radius: 3px; display: flex; align-items: center; justify-content: center; padding: 0; }
    .tpl-item-handle button:hover:not(:disabled) { background: #e5e7eb; color: #1a1a1a; }
    .tpl-item-handle button:disabled { opacity: 0.3; cursor: not-allowed; }
    .tpl-item-handle button svg { width: 10px; height: 10px; stroke: currentColor; fill: none; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
    .tpl-item-content { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; }
    .tpl-item-content textarea { flex: 1; border: none; padding: 6px 8px; background: #f9fafb; border-radius: 4px; font-size: 13px; outline: none; font-family: inherit; resize: vertical; min-height: 32px; max-height: 120px; }
    .tpl-item-content textarea:focus { background: #fff; outline: 1px solid #06c755; }
    .tpl-item-thumb { width: 56px; height: 56px; border-radius: 4px; overflow: hidden; background: #e5e7eb; flex-shrink: 0; position: relative; }
    .tpl-item-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .tpl-item-thumb .tpl-thumb-badge { position: absolute; bottom: 2px; left: 2px; background: rgba(0,0,0,0.6); color: #fff; padding: 0 4px; border-radius: 2px; font-size: 8px; font-weight: 600; letter-spacing: 0.4px; }
    .tpl-item-meta { flex: 1; font-size: 12px; color: #6b7280; }
    .tpl-item-remove { width: 26px; height: 26px; border: none; background: transparent; color: #9ca3af; cursor: pointer; border-radius: 50%; flex-shrink: 0; align-self: center; font-size: 16px; line-height: 1; }
    .tpl-item-remove:hover { background: #fef2f2; color: #d93025; }
    .tpl-edit-add-buttons { display: flex; gap: 8px; margin-top: 12px; }

    /* Send preview modal */
    .tpl-send-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: none; align-items: center; justify-content: center; z-index: 250; }
    .tpl-send-overlay.show { display: flex; }
    .tpl-send-modal { background: #fff; width: 420px; max-width: 92vw; max-height: 85vh; border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,0.25); display: flex; flex-direction: column; overflow: hidden; }
    .tpl-send-head { display: flex; align-items: center; padding: 14px 18px; border-bottom: 1px solid #f3f4f6; }
    .tpl-send-head h3 { flex: 1; font-size: 15px; font-weight: 600; color: #1a1a1a; }
    .tpl-send-sub { padding: 10px 18px; font-size: 12px; color: #6b7280; background: #fafafa; border-bottom: 1px solid #f3f4f6; }
    .tpl-send-body { flex: 1; overflow-y: auto; padding: 14px 18px; display: flex; flex-direction: column; gap: 8px; background: #f0f2f5; }
    .tpl-send-bubble { background: #06c755; color: #fff; padding: 8px 12px; border-radius: 14px 14px 4px 14px; max-width: 80%; align-self: flex-end; font-size: 13px; line-height: 1.4; word-break: break-word; white-space: pre-wrap; }
    .tpl-send-media { align-self: flex-end; max-width: 60%; border-radius: 8px; overflow: hidden; background: #1a1a1a; position: relative; }
    .tpl-send-media img { width: 100%; height: auto; max-height: 200px; object-fit: cover; display: block; }
    .tpl-send-media .tpl-send-media-badge { position: absolute; top: 6px; left: 6px; background: rgba(0,0,0,0.6); color: #fff; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: 600; }
    .tpl-send-actions { display: flex; justify-content: flex-end; gap: 12px; padding: 12px 18px; border-top: 1px solid #f3f4f6; background: #fafafa; }
    /* === end templates ============================================== */

    .chat-input { background: #fff; border-top: 1px solid #e5e7eb; padding: 10px 14px; display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap; }
    .chat-input textarea#msgInput { flex: 1; padding: 10px 16px; background: #f3f4f6; border: none; border-radius: 22px; font-size: 14px; outline: none; font-family: inherit; resize: none; min-height: 40px; max-height: 150px; line-height: 1.4; overflow-y: auto; box-sizing: border-box; }
    .chat-input textarea#msgInput:focus { background: #fff; outline: 2px solid #06c755; outline-offset: -2px; }
    .icon-btn { width: 38px; height: 38px; border: none; background: transparent; border-radius: 50%; cursor: pointer; font-size: 18px; color: #6b7280; }
    .icon-btn:hover { background: #f3f4f6; }
    .btn-send { width: 40px; height: 40px; background: #06c755; color: #fff; border: none; border-radius: 50%; cursor: pointer; font-size: 18px; }
    .btn-send:disabled { background: #9ca3af; cursor: not-allowed; }

    /* Pending attachments bar (above input) */
    .attach-bar { width: 100%; display: none; flex-wrap: wrap; gap: 8px; padding: 8px 4px 4px; }
    .attach-bar.show { display: flex; }
    .attach-item { position: relative; width: 64px; height: 64px; border-radius: 8px; overflow: hidden; background: #f3f4f6; border: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .attach-item img, .attach-item video { width: 100%; height: 100%; object-fit: cover; display: block; }
    .attach-item .placeholder { font-size: 11px; color: #6b7280; padding: 4px; text-align: center; word-break: break-all; line-height: 1.2; }
    .attach-item .remove { position: absolute; top: 2px; right: 2px; width: 20px; height: 20px; border: none; border-radius: 50%; background: rgba(0,0,0,0.6); color: #fff; cursor: pointer; font-size: 12px; line-height: 1; display: flex; align-items: center; justify-content: center; padding: 0; }
    .attach-item .remove:hover { background: rgba(0,0,0,0.85); }
    .attach-item .meta { position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(transparent, rgba(0,0,0,0.6)); color: #fff; font-size: 9px; padding: 2px 4px; text-align: right; }

    /* === Info side (minimal redesign) === */
    .info-side { background: #fff; border-left: 1px solid #e5e7eb; overflow-y: auto; }
    .info-head { padding: 32px 20px 22px; text-align: center; border-bottom: 1px solid #f3f4f6; background: #fff; }
    .info-head .avatar { display: block; width: 88px; height: 88px; font-size: 32px; margin: 0 auto 14px; box-shadow: 0 0 0 1px #e5e7eb; }
    .info-name-row { display: flex; align-items: center; gap: 6px; justify-content: center; }
    .info-name { font-size: 19px; font-weight: 700; color: #111827; line-height: 1.2; word-break: break-word; }
    .info-edit-btn { background: #f3f4f6; border: none; color: #6b7280; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; font-size: 11px; display: inline-flex; align-items: center; justify-content: center; transition: background 0.12s, color 0.12s; }
    .info-edit-btn:hover { background: #e6f9ee; color: #04a045; }
    .info-presence { margin-top: 10px; display: inline-flex; align-items: center; gap: 6px; background: #e6f9ee; color: #04a045; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 500; }
    .info-presence .presence-dot { width: 7px; height: 7px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 0 2px rgba(34,197,94,0.18); flex-shrink: 0; }
    .info-presence.idle { background: #f3f4f6; color: #6b7280; }
    .info-presence.idle .presence-dot { background: #9ca3af; box-shadow: 0 0 0 2px rgba(156,163,175,0.18); }

    /* Phone / contact row — number aligned right, no icon */
    .info-contact { display: flex; align-items: center; justify-content: flex-end; gap: 8px; padding: 12px 18px; border-bottom: 1px solid #f3f4f6; }
    .info-contact-link { color: #111827; text-decoration: none; font-weight: 600; font-size: 14px; letter-spacing: 0.4px; font-variant-numeric: tabular-nums; font-feature-settings: "tnum", "cv11"; font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; }
    .info-contact-link:hover { color: #04a045; }
    .info-contact-empty { color: #9ca3af; font-size: 12px; cursor: pointer; padding: 2px 8px; border-radius: 6px; transition: background 0.12s; }
    .info-contact-empty:hover { background: #f3f4f6; color: #6b7280; }
    .info-copy-btn { background: transparent; border: 1px solid #e5e7eb; width: 28px; height: 28px; border-radius: 6px; cursor: pointer; color: #9ca3af; font-size: 12px; display: inline-flex; align-items: center; justify-content: center; transition: all 0.12s; }
    .info-copy-btn:hover { background: #e6f9ee; color: #04a045; border-color: #b3ecd0; }

    /* Stats / Notes blocks */
    .info-body { padding: 0; }
    .info-block { padding: 14px 18px; border-bottom: 1px solid #f3f4f6; margin: 0; }
    .info-block:last-child { border-bottom: none; }
    .info-block h4 { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; font-weight: 700; }
    .info-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; gap: 8px; border: none; }
    .info-row .k { color: #6b7280; flex-shrink: 0; }
    .info-row .v { color: #111827; font-weight: 600; text-align: right; word-break: break-word; font-variant-numeric: tabular-nums; }

    /* Technical info collapse */
    .info-tech { padding: 10px 18px; cursor: pointer; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #9ca3af; letter-spacing: 0.5px; display: flex; align-items: center; justify-content: space-between; user-select: none; transition: color 0.12s; }
    .info-tech:hover { color: #6b7280; }
    .info-tech-body { padding: 0 18px 14px; font-size: 11px; color: #6b7280; display: none; }
    .info-tech-body.open { display: block; }
    .info-tech-row { display: flex; justify-content: space-between; padding: 4px 0; gap: 8px; }
    .info-tech-row .k { color: #9ca3af; flex-shrink: 0; }
    .info-tech-row .v { font-family: ui-monospace, "SF Mono", Consolas, monospace; font-size: 10px; color: #6b7280; text-align: right; word-break: break-all; }

    /* === Notes (minimalist) === */
    .notes-block { margin-top: 4px; }
    .notes-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; padding: 0 2px; }
    .notes-head h4 { font-size: 12px; color: #1a1a1a; font-weight: 600; letter-spacing: 0.4px; text-transform: none; }
    .notes-add-btn { width: 26px; height: 26px; border: none; background: transparent; color: #1a1a1a; cursor: pointer; font-size: 18px; line-height: 1; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: background 0.12s; }
    .notes-add-btn:hover { background: #ececec; }
    .notes-head-actions { display: flex; gap: 4px; }
    .info-side-empty { display: flex; flex-direction: column; height: 100%; }
    .info-empty-manage { align-self: flex-end; margin: 12px 14px 0; background: transparent; border: 1px solid #e5e7eb; color: #6b7280; padding: 6px 12px; border-radius: 16px; font-size: 11px; cursor: pointer; font-family: inherit; transition: background 0.12s, color 0.12s, border-color 0.12s; }
    .info-empty-manage:hover { background: #f3f4f6; color: #1a1a1a; border-color: #d1d5db; }
    .notes-list { display: flex; flex-direction: column; }
    .note-empty { font-size: 12px; color: #999; padding: 16px 2px 6px; font-style: italic; }
    .note-item { padding: 16px 2px 16px; border-top: 1px solid #e5e5e5; position: relative; }
    .note-item:first-child { border-top: none; padding-top: 4px; }
    .note-cat { display: flex; align-items: center; gap: 7px; font-size: 11px; color: #1a1a1a; font-weight: 600; margin-bottom: 6px; }
    .note-cat .dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
    .note-body { font-size: 13px; color: #1a1a1a; line-height: 1.55; word-break: break-word; white-space: pre-wrap; }
    .note-meta { font-size: 11px; color: #999; margin-top: 10px; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .note-actions { display: none; gap: 14px; }
    .note-item:hover .note-actions { display: inline-flex; }
    .note-action { background: transparent; border: none; padding: 0; font-size: 11px; color: #999; cursor: pointer; font-family: inherit; }
    .note-action:hover { color: #1a1a1a; }
    .note-action.danger:hover { color: #d93025; }

    /* === Note modal (minimalist) === */
    .note-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.35); display: none; align-items: center; justify-content: center; z-index: 110; }
    .note-overlay.show { display: flex; }
    /* Cap modal height so the "บันทึก" button at the bottom is always visible
       even on short screens / tall category lists. Inner body scrolls; header
       and footer stay sticky. */
    .note-modal { background: #fff; width: 460px; max-width: 92vw; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 8px 40px rgba(0,0,0,0.12); border-radius: 10px; overflow: hidden; }
    .note-modal h3 { font-size: 18px; font-weight: 600; color: #1a1a1a; padding: 24px 32px 16px; letter-spacing: 0.3px; margin: 0; flex-shrink: 0; }
    .note-modal-body { padding: 0 32px 16px; overflow-y: auto; flex: 1; }
    .note-section-label { font-size: 11px; color: #999; font-weight: 600; letter-spacing: 0.6px; text-transform: uppercase; margin-bottom: 14px; display: inline-block; }
    .note-section-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    .note-section-row .note-section-label { margin-bottom: 0; }
    .note-cat-manage-btn { background: transparent; border: none; color: #6b7280; font-size: 11px; cursor: pointer; padding: 4px 8px; border-radius: 4px; font-family: inherit; }
    .note-cat-manage-btn:hover { background: #f3f4f6; color: #1a1a1a; }
    .note-cat-list { list-style: none; margin-bottom: 28px; display: flex; flex-direction: column; gap: 4px; }
    .note-cat-list label { display: flex; align-items: center; gap: 12px; cursor: pointer; padding: 8px 4px; font-size: 14px; color: #1a1a1a; border-radius: 4px; transition: background 0.1s; }
    .note-cat-list label:hover { background: #f7f7f7; }
    .note-cat-list input[type=radio] { appearance: none; -webkit-appearance: none; width: 16px; height: 16px; border: 1.5px solid #ccc; border-radius: 50%; cursor: pointer; flex-shrink: 0; position: relative; transition: border-color 0.12s; margin: 0; }
    .note-cat-list input[type=radio]:checked { border-color: #1a1a1a; }
    .note-cat-list input[type=radio]:checked::after { content: ''; width: 8px; height: 8px; border-radius: 50%; background: #1a1a1a; position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); }
    .note-cat-list .cat-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
    .note-cat-list .note-other-input { display: none; padding: 6px 0 4px 28px; }
    .note-cat-list .note-other-input.show { display: block; }
    .note-cat-list .note-other-input input { width: 100%; border: none; border-bottom: 1px solid #d1d5db; padding: 4px 2px; font-size: 13px; outline: none; font-family: inherit; }
    .note-cat-list .note-other-input input:focus { border-color: #1a1a1a; }
    .note-textarea { width: 100%; min-height: 96px; border: none; border-bottom: 1px solid #e5e5e5; border-top: 1px solid #e5e5e5; padding: 14px 2px; font-family: inherit; font-size: 14px; color: #1a1a1a; resize: vertical; outline: none; background: transparent; line-height: 1.55; }
    .note-textarea:focus { border-color: #1a1a1a; }
    .note-author-input { width: 100%; border: none; border-bottom: 1px solid #e5e5e5; padding: 8px 2px; font-family: inherit; font-size: 14px; color: #1a1a1a; outline: none; background: transparent; margin-bottom: 28px; }
    .note-author-input:focus { border-color: #1a1a1a; }
    .note-actions-row { display: flex; justify-content: flex-end; gap: 12px; padding: 14px 32px; border-top: 1px solid #f3f4f6; background: #fafafa; flex-shrink: 0; }
    .note-btn { border: none; padding: 8px 20px; font-size: 14px; cursor: pointer; font-family: inherit; border-radius: 6px; transition: background 0.12s, color 0.12s; }
    .note-btn.cancel { background: transparent; color: #6b7280; }
    .note-btn.cancel:hover { background: #f3f4f6; color: #1a1a1a; }
    .note-btn.save { background: #06c755; color: #fff; font-weight: 600; padding: 8px 28px; }
    .note-btn.save:hover { background: #05a847; }
    .note-btn.save:disabled { background: #e5e7eb; color: #9ca3af; cursor: not-allowed; }

    /* === States === */
    .empty-state { flex: 1; display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 14px; padding: 20px; text-align: center; }
    .loading-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: #6b7280; font-size: 13px; }
    .spinner { width: 36px; height: 36px; border: 3px solid #e5e7eb; border-top-color: #06c755; border-radius: 50%; animation: spin 0.9s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    /* === Mobile responsive (< 768px) ================================
       Below 768px the layout collapses to a single column. The user-side
       and info-side become fixed off-canvas drawers — admins toggle them
       via the floating ☰ / ⓘ buttons. Modals also break free of their
       desktop max-widths so they fit a phone screen. */
    .mobile-fab { display: none; }
    .mobile-backdrop { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 60; }
    .mobile-backdrop.show { display: block; }

    @media (max-width: 768px) {
      .app { grid-template-columns: 1fr; }
      .user-side, .info-side {
        position: fixed; top: 0; bottom: 0;
        width: min(85vw, 380px);
        z-index: 70; transition: transform 0.22s ease;
        box-shadow: 0 0 24px rgba(0,0,0,0.18);
      }
      .user-side { left: 0; transform: translateX(-100%); border-right: none; }
      .user-side.mobile-show { transform: translateX(0); }
      .info-side { right: 0; transform: translateX(100%); border-left: none; }
      .info-side.mobile-show { transform: translateX(0); }

      .mobile-fab {
        display: flex; position: fixed; top: 10px;
        width: 38px; height: 38px; border-radius: 50%;
        background: #fff; border: 1px solid #e5e7eb;
        align-items: center; justify-content: center;
        font-size: 16px; color: #1a1a1a; cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.12); z-index: 65;
      }
      .mobile-fab-left  { left: 10px; }
      .mobile-fab-right { right: 10px; }
      /* Make room for the FABs in the chat header */
      .chat-head { padding-left: 56px; padding-right: 56px; }

      /* Mobile modals: width 92vw, height auto-fits content (cap at 90vh).
         Don't force height:100vh — that left huge empty space under small
         confirm dialogs. Big editing modals still get plenty of room because
         their content drives natural height up to the 90vh cap. */
      .note-modal, .tag-mgr-modal, .tpl-edit-modal, .tpl-send-modal, .bulk-modal, .confirm-modal {
        width: 92vw !important; max-width: 92vw !important;
        max-height: 90vh !important; border-radius: 12px !important;
      }

      /* Larger tap targets for finger interaction */
      .user-item { padding: 14px; }
      .tab { padding: 13px 0; }

      /* iOS Safari auto-zooms when an input has font-size < 16px and
         never zooms back out after blur. Force all inputs to 16px on
         mobile to prevent the zoom from kicking in to begin with. */
      input, textarea, select { font-size: 16px !important; }

      /* Touch devices have no hover. Reply on mobile uses long-press (see
         message-context-menu logic below) — hide the always-visible ↩
         button so it doesn't clutter every bubble. The ⋮ kebab on user
         items stays visible since long-press there would conflict with
         the click-to-select behaviour. */
      .msg-reply-btn { display: none !important; }
      .user-kebab { display: inline-flex !important; }

      /* Close buttons big enough to thumb-tap */
      .tag-mgr-close, .bulk-close, .msg-preview-close, .lightbox-close { width: 36px; height: 36px; font-size: 22px; }

      /* Forms inside modals — let fields wrap so they don't overflow
         the 100vw modal at narrow widths */
      .tag-form-fields { flex-wrap: wrap; gap: 8px; }
      .tag-form-fields > input[type="text"] { flex: 1 1 100%; min-width: 0; }
      .bulk-dates { flex-direction: column; align-items: stretch; gap: 8px; }
      .bulk-dates label { width: 100%; }

      /* Tighter modal padding so content doesn't run off-screen */
      .note-modal h3 { padding: 16px 20px 12px; font-size: 17px; }
      .note-modal-body { padding: 0 20px 16px; }
      .note-actions-row { padding: 12px 20px; }
      .tpl-edit-head, .tpl-send-head { padding: 14px 18px; }
      .tpl-edit-body { padding: 14px 18px; }
      .tpl-edit-actions, .tpl-send-actions { padding: 12px 18px; }

      /* Context menu wider for tap-friendly items */
      .chat-context-menu { min-width: 220px; }
      .chat-context-menu .ctx-item { padding: 12px 16px; font-size: 14px; }

      /* Status / topic popovers fit phone width */
      .status-popover, .topic-popover { width: calc(100vw - 24px) !important; max-width: 360px !important; }

      /* Send button bigger so it's easy to tap with thumb */
      .btn-send { width: 44px; height: 44px; }
      .icon-btn { width: 40px; height: 40px; }

      /* Quick template chips — slightly bigger tap area */
      .tpl-chip { padding: 8px 14px; font-size: 13px; }
      .tpl-toggle { width: 34px; height: 34px; }

      /* Template editor item handle — larger touch zone for ↑↓ reorder */
      .tpl-item-handle button { width: 28px; height: 24px; }

      /* Filter dates: stack vertically on tiny screens to avoid cramped row */
      .filter-row.dates { flex-direction: column; align-items: stretch; }
      .filter-row.dates .sep { text-align: center; padding: 2px 0; }

      /* Compact bubbles on mobile — no need to dominate the screen */
      .msg { max-width: 65%; }
      /* Image hard-capped at a phone-friendly 140px, with internal margin */
      .msg-media { max-width: 140px; margin: 2px auto; }
      /* Less horizontal padding inside the chat scroll */
      .chat-scroll { padding: 12px 14px; }
    }

    /* Even smaller phones: tighten further */
    @media (max-width: 380px) {
      .user-side, .info-side { width: 92vw; }
      .chat-head { padding-left: 52px; padding-right: 52px; }
      .mobile-fab { width: 36px; height: 36px; }
    }
    /* === end mobile responsive ===================================== */
  </style>
</head>
<body>
  <div class="app">

    <!-- User list -->
    <!-- Mobile drawer toggles + backdrop (visible < 768px) -->
    <button type="button" class="mobile-fab mobile-fab-left" id="mobileMenuBtn"
            onclick="toggleMobilePanel('user')" title="รายการแชท">☰</button>
    <button type="button" class="mobile-fab mobile-fab-right" id="mobileInfoBtn"
            onclick="toggleMobilePanel('info')" title="ข้อมูล">i</button>
    <div class="mobile-backdrop" id="mobileBackdrop" onclick="closeMobilePanels()"></div>

    <aside class="user-side">
      <div class="user-head">
        <div class="title">
          <h2>Daikinpromo Chat</h2>
          <p>หน้าจัดการแชท LINE OA</p>
        </div>
        <button type="button" class="settings-btn" onclick="openTagManager()" title="จัดการแท็กสถานะ">
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
        <div class="tab active" data-filter="all">ทั้งหมด <span class="cnt" id="countAll">0</span></div>
        <div class="tab" data-filter="unread">ยังไม่ตอบ <span class="cnt" id="countUnread">0</span></div>
        <div class="tab" data-filter="spam">สแปม <span class="cnt" id="countSpam">0</span></div>
      </div>
      <div class="user-list" id="userList">
        <div class="empty-state">Loading...</div>
      </div>
    </aside>

    <!-- Bulk export modal -->
    <div class="bulk-overlay" id="bulkOverlay" onclick="if(event.target===this)closeBulkModal()">
      <div class="bulk-modal">
        <div class="bulk-head">
          <h3>Export บทสนทนา</h3>
          <button class="bulk-close" onclick="closeBulkModal()" title="ปิด">×</button>
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
          <button class="bulk-toggle-all" type="button" onclick="toggleAllBulk()">เลือก/ล้างทั้งหมด</button>
        </div>
        <div class="bulk-quick">
          <span class="bulk-quick-label">ตั้งหัวข้อให้ทุกคนที่เลือก:</span>
          <button type="button" class="topic-chip" id="quickTopicChip" onclick="openTopicPopover(this, '__quick__')">
            <span class="dot" style="display:none;"></span>
            <span class="label">เลือกหัวข้อ</span>
            <span class="caret">▾</span>
          </button>
          <button type="button" class="quick-apply" id="quickApplyBtn" onclick="applyQuickTopic()" disabled>ใช้</button>
        </div>
        <div class="bulk-list" id="bulkList"></div>
        <div class="bulk-footer">
          <div class="bulk-count">เลือกไว้ <b id="bulkCount">0 / 100</b> คน</div>
          <div class="bulk-actions-row">
            <button type="button" class="bulk-action-btn" onclick="closeBulkModal()">ยกเลิก</button>
            <button type="button" class="bulk-action-btn" id="bulkPdfBtn" onclick="doBulkExport('pdf')" disabled title="PDF รองรับเฉพาะแชทเดียว">📄 PDF</button>
            <button type="button" class="bulk-action-btn primary" id="bulkWordBtn" onclick="doBulkExport('word')" disabled>📝 Word</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Topic select popover (shared across rows + quick-apply) -->
    <div class="topic-popover" id="topicPopover"></div>

    <!-- User status popover (per user, opens from chip below name) -->
    <div class="status-popover" id="statusPopover"></div>

    <!-- Image lightbox (click any chat image to view full-size) -->
    <div class="lightbox" id="lightbox" onclick="if(event.target===this)closeLightbox()">
      <button type="button" class="lightbox-close" onclick="closeLightbox()" title="ปิด (Esc)">×</button>
      <img id="lightboxImg" src="" alt="" />
    </div>

    <!-- Generic confirm / alert modal -->
    <div class="confirm-overlay" id="confirmOverlay" onclick="if(event.target===this)closeConfirm(false)">
      <div class="confirm-modal">
        <div class="confirm-head"><h3 id="confirmTitle">ยืนยัน?</h3></div>
        <div class="confirm-body" id="confirmBody"></div>
        <div class="confirm-warn" id="confirmWarn" style="display:none;"></div>
        <div class="confirm-actions">
          <button type="button" id="confirmCancelBtn" onclick="closeConfirm(false)">ยกเลิก</button>
          <button type="button" class="danger" id="confirmOkBtn" onclick="closeConfirm(true)">ตกลง</button>
        </div>
      </div>
    </div>

    <!-- Chat-level context menu (kebab + right-click) -->
    <div class="chat-context-menu" id="chatCtxMenu"></div>

    <!-- Message-level context menu (long-press on bubble — mobile reply) -->
    <div class="chat-context-menu" id="msgCtxMenu"></div>


    <!-- Manage status tags modal -->
    <div class="tag-mgr-overlay" id="tagMgrOverlay" onclick="if(event.target===this)closeTagManager()">
      <div class="tag-mgr-modal">
        <div class="tag-mgr-head">
          <h3>จัดการแท็กสถานะ</h3>
          <button class="tag-mgr-close" onclick="closeTagManager()">×</button>
        </div>
        <div class="tag-mgr-body">
          <div class="tag-mgr-list" id="tagMgrList"></div>
          <div class="tag-form">
            <div class="tag-form-title" id="tagFormTitle">เพิ่มแท็กใหม่</div>
            <div class="tag-form-fields">
              <input type="color" id="tagFormColor" value="#2d6cdf" />
              <input type="text" id="tagFormLabel" placeholder="ชื่อแท็ก..." maxlength="60" />
              <button type="button" class="cancel-btn" id="tagFormCancel" onclick="cancelTagEdit()" style="display:none;">ยกเลิก</button>
              <button type="button" class="save-btn" id="tagFormSave" onclick="commitTagForm()">บันทึก</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Template add/edit modal — ordered list of text/image/video items.
         Admin can add, remove, and reorder items to control send sequence. -->
    <div class="tpl-edit-overlay" id="tplEditOverlay" onclick="if(event.target===this)closeTplEditor()">
      <div class="tpl-edit-modal">
        <div class="tpl-edit-head">
          <h3 id="tplEditTitle">เพิ่มเทมเพลต</h3>
          <button type="button" class="tag-mgr-close" onclick="closeTplEditor()">×</button>
        </div>
        <div class="tpl-edit-body">
          <div class="tpl-edit-row">
            <span class="tpl-edit-label" style="margin: 0;">ลำดับการส่ง <span class="tpl-asset-count" id="tplItemCount">0/5</span></span>
          </div>
          <div class="tpl-items-list" id="tplItemsList"></div>
          <div class="tpl-edit-add-buttons">
            <button type="button" class="tpl-asset-add-btn" onclick="addTplTextItem()">+ ข้อความ</button>
            <button type="button" class="tpl-asset-add-btn" onclick="document.getElementById('tplAssetInput').click()">+ รูป/วิดีโอ</button>
            <input type="file" id="tplAssetInput" accept="image/*,video/*" multiple style="display:none" onchange="_onTplFileSelected(this)" />
          </div>
        </div>
        <div class="tpl-edit-actions">
          <button type="button" class="note-btn cancel" onclick="closeTplEditor()">ยกเลิก</button>
          <button type="button" class="note-btn save" id="tplEditSaveBtn" onclick="commitTplEditor()">บันทึก</button>
        </div>
      </div>
    </div>

    <!-- Send preview modal — shown before actually pushing template to LINE.
         Replaces the ugly native confirm() with an actual list of items in
         the order they'll arrive in the customer's chat. -->
    <div class="tpl-send-overlay" id="tplSendOverlay" onclick="if(event.target===this)closeTplSendPreview()">
      <div class="tpl-send-modal">
        <div class="tpl-send-head">
          <h3>ตัวอย่างก่อนส่ง</h3>
          <button type="button" class="tag-mgr-close" onclick="closeTplSendPreview()">×</button>
        </div>
        <div class="tpl-send-sub" id="tplSendSub"></div>
        <div class="tpl-send-body" id="tplSendBody"></div>
        <div class="tpl-send-actions">
          <button type="button" class="note-btn cancel" onclick="closeTplSendPreview()">ยกเลิก</button>
          <button type="button" class="note-btn save" id="tplSendBtn" onclick="confirmTplSend()">ส่งให้ลูกค้า</button>
        </div>
      </div>
    </div>

    <!-- Manage note categories modal — same UX as tag manager, separate list -->
    <div class="tag-mgr-overlay" id="noteCatMgrOverlay" onclick="if(event.target===this)closeNoteCatManager()">
      <div class="tag-mgr-modal">
        <div class="tag-mgr-head">
          <h3>จัดการหมวดหมู่บันทึก</h3>
          <button class="tag-mgr-close" onclick="closeNoteCatManager()">×</button>
        </div>
        <div class="tag-mgr-body">
          <div class="tag-mgr-list" id="noteCatMgrList"></div>
          <div class="tag-form">
            <div class="tag-form-title" id="noteCatFormTitle">เพิ่มหมวดหมู่ใหม่</div>
            <div class="tag-form-fields">
              <input type="color" id="noteCatFormColor" value="#2d6cdf" />
              <input type="text" id="noteCatFormLabel" placeholder="ชื่อหมวดหมู่..." maxlength="60" />
              <button type="button" class="cancel-btn" id="noteCatFormCancel" onclick="cancelNoteCatEdit()" style="display:none;">ยกเลิก</button>
              <button type="button" class="save-btn" id="noteCatFormSave" onclick="commitNoteCatForm()">บันทึก</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Chat area -->
    <main class="chat-area">
      <div class="chat-head" id="chatHeader">
        <span>เลือก user ทางซ้ายเพื่อเริ่มแชท</span>
      </div>
      <div class="chat-scroll" id="chatMessages">
        <div class="empty-state">ยังไม่มี user ที่เลือก</div>
      </div>
      <!-- Quick templates bar — sits above the input. Compact mode shows the
           first ~2 chips with horizontal scroll; arrow button slides up a
           panel listing all templates with edit / delete / add actions. -->
      <div class="tpl-bar" id="tplBar" style="display:none;">
        <div class="tpl-chips" id="tplChips"></div>
        <button type="button" class="tpl-toggle" id="tplToggle" onclick="toggleTplPanel()" title="ดูทั้งหมด">
          <svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>
        </button>
        <div class="tpl-panel" id="tplPanel">
          <div class="tpl-panel-head">
            <span class="tpl-panel-title">เทมเพลตข้อความ</span>
            <button type="button" class="tpl-panel-add" onclick="openTplEditor()" title="เพิ่ม">+ เพิ่ม</button>
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
          <button type="button" class="quote-cancel" onclick="cancelReplyQuote()" title="ยกเลิก">×</button>
        </div>
        <div class="attach-bar" id="attachBar"></div>
        <input type="file" id="fileInput" hidden multiple onchange="uploadMedia()" />
        <button class="icon-btn" id="uploadBtn" onclick="document.getElementById('fileInput').click()" title="แนบไฟล์">📎</button>
        <textarea id="msgInput" placeholder="พิมพ์ข้อความ..." rows="1"></textarea>
        <button class="btn-send" id="sendBtn" onclick="sendMessage()">➤</button>
      </div>
    </main>

    <!-- Info side -->
    <aside class="info-side" id="infoSide">
      <div class="info-side-empty">
        <button type="button" class="info-empty-manage" onclick="openNoteCatManager()" title="จัดการหมวดหมู่">⚙ จัดการหมวดหมู่</button>
        <div class="empty-state">เลือก user เพื่อดูข้อมูล</div>
      </div>
    </aside>

    <!-- Note add/edit modal -->
    <div class="note-overlay" id="noteOverlay" onclick="if(event.target===this)closeNoteModal()">
      <div class="note-modal">
        <h3 id="noteModalTitle">เพิ่มบันทึก</h3>

        <div class="note-modal-body">
          <div class="note-section-row">
            <span class="note-section-label">หมวดหมู่</span>
            <button type="button" class="note-cat-manage-btn" onclick="openNoteCatManager()" title="จัดการหมวดหมู่">⚙ จัดการ</button>
          </div>
          <ul class="note-cat-list" id="noteCatList"></ul>

          <div class="note-section-label">รายละเอียด</div>
          <textarea class="note-textarea" id="noteBody" placeholder="พิมพ์รายละเอียดที่ลูกค้าแจ้ง..."></textarea>

          <div class="note-section-label" style="margin-top: 20px;">บันทึกโดย</div>
          <input type="text" class="note-author-input" id="noteAuthor" placeholder="เช่น Admin" maxlength="40" />
        </div>

        <div class="note-actions-row">
          <button type="button" class="note-btn cancel" onclick="closeNoteModal()">ยกเลิก</button>
          <button type="button" class="note-btn save" id="noteSaveBtn" onclick="saveNote()">บันทึก</button>
        </div>
      </div>
    </div>

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
    const filters = { dateFrom: '', dateTo: '', name: '', message: '', status: 'all' };
    let _lastMessagesById = new Map(); // populated by loadMessages each render

    function escapeHtml(str) {
      return String(str ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      })[c]);
    }

    function avatarMarkup(pictureUrl, name, sizeClass) {
      const initial = escapeHtml((name || '?').trim().charAt(0).toUpperCase() || '?');
      const safe = escapeHtml(name || '');
      if (pictureUrl) {
        return \`<img class="avatar \${sizeClass || ''}" src="\${escapeHtml(pictureUrl)}" alt="\${safe}" onerror="this.replaceWith(document.createRange().createContextualFragment('<div class=\\\\'avatar \${sizeClass || ''}\\\\'>\${initial}</div>').firstChild)" />\`;
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
      const countSpamEl = document.getElementById('countSpam');

      // Spam chats are quarantined to their own tab — they shouldn't pollute
      // "ทั้งหมด" / "ยังไม่ตอบ" counts (otherwise admin sees "10 unread" but
      // only 3 are real customer chats and 7 are spam noise).
      const spamUsers    = allUsers.filter(u => loadChatStatus(u.lineUserId).isSpam);
      const nonSpamUsers = allUsers.filter(u => !loadChatStatus(u.lineUserId).isSpam);
      const unreadUsers  = nonSpamUsers.filter(u => Number(u.unreadCount || 0) > 0);
      countAllEl.textContent    = nonSpamUsers.length;
      countUnreadEl.textContent = unreadUsers.length;
      countSpamEl.textContent   = spamUsers.length;

      const term = searchTerm.trim().toLowerCase();
      let users;
      if (activeFilter === 'spam')        users = spamUsers;
      else if (activeFilter === 'unread') users = unreadUsers;
      else                                users = nonSpamUsers;

      // Pinned chats float to the top (most-recently pinned first), regardless
      // of which tab is active. Non-pinned keep their original timestamp order
      // (server already sorted by latest message DESC).
      users = users.slice().sort((a, b) => {
        const sa = loadChatStatus(a.lineUserId);
        const sb = loadChatStatus(b.lineUserId);
        if (sa.pinned && !sb.pinned) return -1;
        if (!sa.pinned && sb.pinned) return 1;
        if (sa.pinned && sb.pinned) {
          return new Date(sb.pinnedAt || 0) - new Date(sa.pinnedAt || 0);
        }
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
      if (term) {
        users = users.filter(u => {
          const name = (u.displayName || u.lineUserId || '').toLowerCase();
          return name.includes(term);
        });
      }

      const nameQ = filters.name.trim().toLowerCase();
      const msgQ = filters.message.trim().toLowerCase();
      const fromTs = filters.dateFrom ? new Date(filters.dateFrom).getTime() : null;
      const toTs = filters.dateTo ? new Date(filters.dateTo).getTime() + 86399999 : null;

      users = users.filter(u => {
        if (nameQ) {
          const n = (u.displayName || u.lineUserId || '').toLowerCase();
          if (!n.includes(nameQ)) return false;
        }
        if (msgQ) {
          const m = (u.content?.text || '').toLowerCase();
          if (!m.includes(msgQ)) return false;
        }
        if (fromTs !== null || toTs !== null) {
          const ts = new Date(u.timestamp).getTime();
          if (fromTs !== null && ts < fromTs) return false;
          if (toTs !== null && ts > toTs) return false;
        }
        if (filters.status === 'unread') {
          if (Number(u.unreadCount || 0) === 0) return false;
        } else if (filters.status === 'needsAdmin') {
          if (!u.needsAdmin) return false;
        } else if (filters.status === 'answered') {
          if (Number(u.unreadCount || 0) > 0) return false;
        }
        return true;
      });

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
        const adminFlag = u.needsAdmin
          ? '<span class="admin-flag" title="ลูกค้าต้องการให้แอดมินติดต่อกลับ">ติดต่อเจ้าหน้าที่</span>'
          : '';
        const unreadCls = n > 0 ? 'unread' : '';
        const activeCls = u.lineUserId === currentUserId ? 'active' : '';

        // Status chips below user name. Two visual groups separated by a
        // thin divider:
        //   1. Manual chips — picked from the popover, stored as user status.
        //   2. Note chips — derived live from the user's notes (save/edit/
        //      delete on a note flows through automatically).
        // Click any chip — or "+ สถานะ" — to open the popover.
        const manualTags = loadUserStatusTags(u.lineUserId);
        const noteTags = loadNoteStatusChips(u.lineUserId);
        const safeUid = escapeHtml(u.lineUserId);
        const renderChip = (t, fromNote) => \`<button type="button" class="user-tag has-status\${fromNote ? ' from-note' : ''}" title="\${escapeHtml(t.label)}\${fromNote ? ' (จากบันทึก)' : ''}"
                onclick="event.stopPropagation();openStatusPopover(this,'\${safeUid}')">
              <span class="dot" style="background:\${t.color}"></span>
              <span class="label">\${escapeHtml(t.label)}</span>
              \${fromNote ? '<span class="src" aria-hidden="true">📝</span>' : ''}
            </button>\`;
        const manualChips = manualTags
          .map(k => USER_STATUS_BY_KEY[k]).filter(Boolean)
          .map(t => renderChip(t, false)).join('');
        const noteChips = noteTags.map(t => renderChip(t, true)).join('');
        const addChip = \`<button type="button" class="user-tag empty"
                onclick="event.stopPropagation();openStatusPopover(this,'\${safeUid}')">
              <span class="label">+ สถานะ</span>
            </button>\`;
        const groups = [];
        if (manualChips) groups.push(\`<span class="user-tag-group">\${manualChips}</span>\`);
        if (noteChips) groups.push(\`<span class="user-tag-group">\${noteChips}</span>\`);
        const tagMarkup = \`<div class="user-tag-row">\${groups.join('')}\${addChip}</div>\`;

        // Pinned chats render with a 📌 marker next to the name; the kebab
        // button + right-click handler expose the chat-level context menu
        // (preview / pin / spam / delete). Both wrappers stopPropagation so
        // they don't bubble to the user-item's selectUser handler.
        const chatStatus = loadChatStatus(u.lineUserId);
        const pinMark = chatStatus.pinned ? \`<span class="pin-mark" title="ปักหมุด">\${ICON_PIN}</span>\` : '';
        const spamCls = chatStatus.isSpam ? ' is-spam' : '';
        return \`
          <div class="user-item \${activeCls} \${unreadCls}\${spamCls}"
               onclick="selectUser('\${escapeHtml(u.lineUserId)}')"
               oncontextmenu="event.preventDefault();openChatContextMenu(event,'\${safeUid}');return false;">
            <div class="avatar-wrap">\${avatar}</div>
            <div class="user-meta">
              <div class="user-top">
                <div class="user-name">\${pinMark}\${name}\${adminFlag}</div>
                <div class="user-date">\${time}</div>
              </div>
              <div class="user-bottom">
                <div class="user-last">\${lastMsg}</div>
                \${badge}
              </div>
              \${tagMarkup}
            </div>
            <button type="button" class="user-kebab" title="เพิ่มเติม"
                    onclick="event.stopPropagation();openChatContextMenuFromKebab(this,'\${safeUid}')">⋮</button>
          </div>
        \`;
      }).join('');

      if (list.dataset.hash !== newHtml) {
        list.innerHTML = newHtml;
        list.dataset.hash = newHtml;
      }
    }

    // === Mobile drawer toggles ============================================
    // On screens < 768px the user-side and info-side become slide-in drawers.
    // These functions are no-ops visually on desktop because the @media rule
    // doesn't apply — the .mobile-show class doesn't change anything > 768px.
    function toggleMobilePanel(which) {
      const left  = document.querySelector('.user-side');
      const right = document.querySelector('.info-side');
      const back  = document.getElementById('mobileBackdrop');
      if (which === 'user') {
        const open = left.classList.toggle('mobile-show');
        right.classList.remove('mobile-show');
        back.classList.toggle('show', open);
      } else if (which === 'info') {
        const open = right.classList.toggle('mobile-show');
        left.classList.remove('mobile-show');
        back.classList.toggle('show', open);
      }
    }
    function closeMobilePanels() {
      document.querySelector('.user-side')?.classList.remove('mobile-show');
      document.querySelector('.info-side')?.classList.remove('mobile-show');
      document.getElementById('mobileBackdrop')?.classList.remove('show');
    }
    // === end mobile drawer ================================================

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
        // Prime pin/spam cache from server response so togglePin/toggleSpam
        // and renderUserList read fresh state without an extra fetch.
        primeChatStatusFromUsers(users);
        allUsers = users;
        renderUserList();
      } catch (err) {
        console.warn('loadConversations failed:', err);
      }
    }

    // Format relative time for "ทักล่าสุด N ชม.ที่แล้ว"
    function formatRelativeTime(ts) {
      if (!ts) return '—';
      const ms = Date.now() - new Date(ts).getTime();
      const min = Math.floor(ms / 60000);
      if (min < 1) return 'เมื่อสักครู่';
      if (min < 60) return min + ' นาทีที่แล้ว';
      const hr = Math.floor(min / 60);
      if (hr < 24) return hr + ' ชม.ที่แล้ว';
      const day = Math.floor(hr / 24);
      if (day < 7) return day + ' วันที่แล้ว';
      return new Date(ts).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
    }
    // Format absolute Thai date "5 พ.ค. 69"
    function formatThaiDate(ts) {
      if (!ts) return '—';
      return new Date(ts).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
    }
    // Compute presence based on most recent inbound message timestamp
    function computePresence(lastInboundTs) {
      if (!lastInboundTs) return { idle: true, label: 'ยังไม่มีข้อความ' };
      const minAgo = (Date.now() - new Date(lastInboundTs).getTime()) / 60000;
      if (minAgo < 60) return { idle: false, label: 'ทักล่าสุด ' + formatRelativeTime(lastInboundTs) };
      return { idle: true, label: 'ทักล่าสุด ' + formatRelativeTime(lastInboundTs) };
    }
    function toggleTechCollapse(el) {
      const body = el.nextElementSibling;
      body.classList.toggle('open');
      el.firstElementChild.textContent = body.classList.contains('open') ? '▾ ข้อมูลทางเทคนิค' : '▸ ข้อมูลทางเทคนิค';
    }
    function copyToClipboard(text, btn) {
      navigator.clipboard.writeText(text).then(() => {
        const orig = btn.textContent;
        btn.textContent = '✓';
        setTimeout(() => btn.textContent = orig, 1200);
      });
    }

    function renderInfoPanel(userId, profile, messages) {
      const info = document.getElementById('infoSide');
      const name = (profile?.displayName || userProfiles[userId]?.displayName || userId).trim();
      const pic = profile?.pictureUrl || userProfiles[userId]?.pictureUrl || null;
      const safeUserId = escapeHtml(userId);

      // Compute stats from messages array (can be array or '...' for loading)
      let inboundLast = null, adminLast = null, firstSeen = null, count = 0;
      if (Array.isArray(messages)) {
        count = messages.length;
        for (const m of messages) {
          if (firstSeen === null) firstSeen = m.timestamp;
          if (m.direction === 'inbound') inboundLast = m.timestamp;
          if (m.direction === 'outbound_admin') adminLast = m.timestamp;
        }
      }
      const presence = computePresence(inboundLast);
      const presenceClass = presence.idle ? 'info-presence idle' : 'info-presence';

      info.innerHTML = \`
        <div class="info-head">
          \${avatarMarkup(pic, name)}
          <div class="info-name-row">
            <span class="info-name">\${escapeHtml(name)}</span>
          </div>
          <div class="\${presenceClass}">
            <span class="presence-dot"></span>\${escapeHtml(presence.label)}
          </div>
        </div>
        <div class="info-body">
          <div class="info-block">
            <h4>สรุป</h4>
            <div class="info-row"><span class="k">ข้อความ</span><span class="v">\${count}</span></div>
            <div class="info-row"><span class="k">ตอบล่าสุด</span><span class="v">\${formatRelativeTime(adminLast)}</span></div>
            <div class="info-row"><span class="k">ลูกค้าตั้งแต่</span><span class="v">\${formatThaiDate(firstSeen)}</span></div>
          </div>
          <div class="info-block notes-block">
            <div class="notes-head">
              <h4>บันทึก</h4>
              <div class="notes-head-actions">
                <button type="button" class="notes-add-btn" onclick="openNoteCatManager()" title="จัดการหมวดหมู่">⚙</button>
                <button type="button" class="notes-add-btn" onclick="openNoteModal()" title="เพิ่มบันทึก">⊕</button>
              </div>
            </div>
            <div class="notes-list" id="notesList"></div>
          </div>
          <div class="info-tech" onclick="toggleTechCollapse(this)">
            <span>▸ ข้อมูลทางเทคนิค</span>
            <span style="color:#9ca3af;font-size:10px;text-transform:none;">developer</span>
          </div>
          <div class="info-tech-body">
            <div class="info-tech-row">
              <span class="k">User ID</span>
              <span class="v">\${escapeHtml(userId.slice(0, 18))}...<button type="button" class="info-copy-btn" style="margin-left:4px;width:20px;height:20px;font-size:10px;" onclick="copyToClipboard('\${safeUserId}', this)" title="คัดลอก">📋</button></span>
            </div>
            <div class="info-tech-row">
              <span class="k">First seen</span>
              <span class="v">\${firstSeen ? new Date(firstSeen).toLocaleString('th-TH') : '—'}</span>
            </div>
          </div>
        </div>
      \`;
      renderNotes(userId);
    }

    // === Notes (prototype: localStorage) ===========================
    // PROTOTYPE: notes are persisted in localStorage so we can iterate on
    // UX without backend work. Replace with real API once schema is final.

    // Tags used in Notes panel + Topic chip in Export modal.
    // Editable: admin can add/edit/delete via the "จัดการหมวดหมู่" button in
    // the note add/edit modal. Stored in localStorage like USER_STATUS_TAGS.
    const DEFAULT_NOTE_CATEGORIES = [
      { key: 'register',      label: 'การลงทะเบียน',           color: '#2d6cdf' },
      { key: 'doc_review',    label: 'ระยะเวลาตรวจสอบเอกสาร',   color: '#0f9d58' },
      { key: 'tm_send',       label: 'ระยะเวลาส่ง Code True Money', color: '#f29900' },
      { key: 'tm_redeem',     label: 'การเติม Code True Money',  color: '#d23f87' },
      { key: 'qr_fail',       label: 'สแกน QR Code ไม่ได้',      color: '#9b59b6' },
      { key: 'doc_extra',     label: 'เอกสารเพิ่มเติม',          color: '#5f6368' },
      { key: 'receipt',       label: 'ใบเสร็จ',                  color: '#d93025' },
    ];
    const NOTE_CATEGORIES_KEY = 'noteCategories';
    function loadNoteCategoriesStored() {
      try {
        const raw = localStorage.getItem(NOTE_CATEGORIES_KEY);
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr) && arr.length > 0) return arr;
        }
      } catch {}
      return DEFAULT_NOTE_CATEGORIES.map(c => ({ ...c }));
    }
    function persistNoteCategories() {
      localStorage.setItem(NOTE_CATEGORIES_KEY, JSON.stringify(NOTE_CATEGORIES));
    }
    function rebuildNoteCatByKey() {
      NOTE_CAT_BY_KEY = Object.fromEntries(NOTE_CATEGORIES.map(c => [c.key, c]));
    }
    let NOTE_CATEGORIES = loadNoteCategoriesStored();
    let NOTE_CAT_BY_KEY = Object.fromEntries(NOTE_CATEGORIES.map(c => [c.key, c]));

    // Customer status tags — display-only chip below user name in left sidebar.
    // Independent from Notes/Export. Editable list (CRUD) + per-user assignment,
    // both stored in localStorage. Seeded with the defaults below on first run.
    const DEFAULT_STATUS_TAGS = [
      { key: 'parts_inquiry', label: 'สอบถามข้อมูล/อะไหล่',      color: '#1e88e5' },
      { key: 'parts_quote',   label: 'รอใบเสนอราคาอะไหล่',       color: '#fb8c00' },
      { key: 'parts_order',   label: 'สั่งซื้ออะไหล่',           color: '#26c6a4' },
      { key: 'tracking',      label: 'รอแจ้ง Tracking',          color: '#fbc02d' },
      { key: 'return_item',   label: 'แจ้งคืนสินค้า',            color: '#bf6f1f' },
      { key: 'shipping',      label: 'ติดตามสถานะการจัดส่ง',     color: '#8e44ad' },
      { key: 'complaint',     label: 'ร้องเรียน',                color: '#c0392b' },
      { key: 'bkf',           label: 'ลูกค้า BKF',               color: '#c4d83f' },
      { key: 'service_pm',    label: 'สอบถามข้อมูล/ราคา งานบริการ/PM', color: '#5dade2' },
      { key: 'repair',        label: 'แจ้งงานซ่อม',              color: '#f1948a' },
    ];
    const STATUS_TAGS_KEY = 'userStatusTags';
    const USER_STATUS_KEY = (userId) => 'userStatus:' + userId;

    function loadStatusTags() {
      try {
        const raw = localStorage.getItem(STATUS_TAGS_KEY);
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr) && arr.length > 0) {
            // Strip legacy note-derived entries from the prior sync design;
            // note chips are now fully derived from the user's notes.
            return arr.filter(t => !(t.key || '').startsWith('note:'));
          }
        }
      } catch {}
      return DEFAULT_STATUS_TAGS.map(t => ({ ...t }));
    }
    function persistStatusTags() {
      localStorage.setItem(STATUS_TAGS_KEY, JSON.stringify(USER_STATUS_TAGS));
    }
    function rebuildStatusByKey() {
      USER_STATUS_BY_KEY = Object.fromEntries(USER_STATUS_TAGS.map(t => [t.key, t]));
    }

    let USER_STATUS_TAGS = loadStatusTags();
    let USER_STATUS_BY_KEY = Object.fromEntries(USER_STATUS_TAGS.map(t => [t.key, t]));

    function loadUserStatus(userId) {
      try {
        const raw = localStorage.getItem(USER_STATUS_KEY(userId));
        return raw ? JSON.parse(raw) : null;
      } catch { return null; }
    }
    // User-status array — only holds **manual** tags picked from the popover.
    // Note-derived chips are computed on the fly from the user's notes (see
    // loadNoteStatusChips), so save/edit/delete on a note flows through the
    // chip automatically. Legacy "note:*" entries from the old sync design
    // are filtered out on read.
    function loadUserStatusTags(userId) {
      const s = loadUserStatus(userId);
      if (!s) return [];
      let tags = [];
      if (Array.isArray(s.tags)) tags = s.tags.slice();
      else if (typeof s.tag === 'string' && s.tag) tags = [s.tag];
      return tags.filter(k => !k.startsWith('note:'));
    }
    function saveUserStatusTags(userId, tags) {
      const arr = Array.isArray(tags) ? tags.filter(Boolean) : [];
      if (arr.length > 0) {
        localStorage.setItem(USER_STATUS_KEY(userId), JSON.stringify({ tags: arr, updatedAt: new Date().toISOString() }));
      } else {
        localStorage.removeItem(USER_STATUS_KEY(userId));
      }
    }
    function saveUserStatus(userId, status) {
      // Backward-compat shim: routes legacy {tag} writes through the tags array.
      if (!status) { saveUserStatusTags(userId, []); return; }
      if (Array.isArray(status.tags)) { saveUserStatusTags(userId, status.tags); return; }
      if (status.tag) { saveUserStatusTags(userId, [status.tag]); return; }
      saveUserStatusTags(userId, []);
    }

    // === Chat-level status (pin / spam) — shared across admins via DB ===
    // Cache primed by GET /api/admin/conversations response (which LEFT JOINs
    // chat_status). Toggles do an optimistic update + PATCH; on failure we
    // revert and re-render so the UI never lies about the persisted state.
    //
    // _pendingStatus tracks userIds with an in-flight PATCH so the 5-second
    // loadConversations refresh doesn't overwrite the optimistic cache before
    // the PATCH commits server-side (race that made pins appear to "flicker").
    const _chatStatusCache = new Map(); // userId -> { pinned, pinnedAt, isSpam }
    const _pendingStatus = new Set();   // userIds with in-flight PATCH
    function loadChatStatus(userId) {
      return _chatStatusCache.get(userId) ?? { pinned: false, pinnedAt: null, isSpam: false };
    }
    function primeChatStatusFromUsers(users) {
      for (const u of users) {
        if (_pendingStatus.has(u.lineUserId)) continue; // don't clobber an in-flight toggle
        _chatStatusCache.set(u.lineUserId, {
          pinned: !!u.pinned,
          pinnedAt: u.pinnedAt ?? null,
          isSpam: !!u.isSpam,
        });
      }
    }
    async function patchChatStatus(userId, patch) {
      _pendingStatus.add(userId);
      try {
        const res = await fetch('/api/admin/chat-status/' + encodeURIComponent(userId), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
      } finally {
        _pendingStatus.delete(userId);
      }
    }
    async function togglePin(userId) {
      const before = loadChatStatus(userId);
      const after = { ...before, pinned: !before.pinned, pinnedAt: !before.pinned ? new Date().toISOString() : null };
      _chatStatusCache.set(userId, after);
      renderUserList();
      try {
        await patchChatStatus(userId, { pinned: after.pinned });
      } catch (err) {
        _chatStatusCache.set(userId, before);
        renderUserList();
        showAlert('ปักหมุดไม่สำเร็จ: ' + err.message);
      }
    }
    async function toggleSpam(userId) {
      const before = loadChatStatus(userId);
      const after = { ...before, isSpam: !before.isSpam };
      _chatStatusCache.set(userId, after);
      renderUserList();
      try {
        await patchChatStatus(userId, { isSpam: after.isSpam });
      } catch (err) {
        _chatStatusCache.set(userId, before);
        renderUserList();
        showAlert('กำหนดสแปมไม่สำเร็จ: ' + err.message);
      }
    }
    // === Chat context menu (kebab + right-click) ======================
    let _chatCtxTarget = null;

    // Feather-style line icons — render as SVG so they inherit text color
    // and stroke weight. Avoids the emoji rendering inconsistency between
    // OS / browser font fallbacks (e.g. 📌 looks like a flag in some Windows).
    const ICON_PIN     = '<svg viewBox="0 0 24 24"><path d="M12 17v5"/><path d="M9 10.76V6h-1V4h8v2h-1v4.76a2 2 0 0 0 1.11 1.79l1.78.9A2 2 0 0 1 19 15.24V17H5v-1.76a2 2 0 0 1 1.11-1.79l1.78-.9A2 2 0 0 0 9 10.76z"/></svg>';
    const ICON_BAN     = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>';
    const ICON_TRASH   = '<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';

    function buildChatCtxItems(userId) {
      const s = loadChatStatus(userId);
      const pinLabel = s.pinned ? 'เลิกปักหมุด' : 'ปักหมุด';
      const spamLabel = s.isSpam ? 'ยกเลิกสแปม' : 'กำหนดเป็นสแปม';
      return \`
        <div class="ctx-item" onclick="closeChatContextMenu();togglePin('\${escapeHtml(userId)}')">
          <span class="ctx-icon">\${ICON_PIN}</span><span>\${pinLabel}</span>
        </div>
        <div class="ctx-item" onclick="closeChatContextMenu();toggleSpam('\${escapeHtml(userId)}')">
          <span class="ctx-icon">\${ICON_BAN}</span><span>\${spamLabel}</span>
        </div>
        <div class="ctx-divider"></div>
        <div class="ctx-item danger" onclick="closeChatContextMenu();deleteChat('\${escapeHtml(userId)}')">
          <span class="ctx-icon">\${ICON_TRASH}</span><span>ลบทั้ง chat</span>
        </div>
      \`;
    }

    function showChatContextMenu(x, y, userId) {
      _chatCtxTarget = userId;
      const menu = document.getElementById('chatCtxMenu');
      menu.innerHTML = buildChatCtxItems(userId);

      // Position then clamp to viewport
      menu.style.visibility = 'hidden';
      menu.classList.add('show');
      const w = menu.offsetWidth;
      const h = menu.offsetHeight;
      const left = Math.min(x, window.innerWidth - w - 8);
      const top = Math.min(y, window.innerHeight - h - 8);
      menu.style.left = left + 'px';
      menu.style.top = top + 'px';
      menu.style.visibility = '';

      setTimeout(() => document.addEventListener('mousedown', _ctxOutsideClick), 0);
    }

    function _ctxOutsideClick(e) {
      const menu = document.getElementById('chatCtxMenu');
      if (!menu.contains(e.target)) closeChatContextMenu();
    }

    function closeChatContextMenu() {
      document.getElementById('chatCtxMenu').classList.remove('show');
      _chatCtxTarget = null;
      document.removeEventListener('mousedown', _ctxOutsideClick);
    }

    function openChatContextMenu(ev, userId) {
      showChatContextMenu(ev.clientX, ev.clientY, userId);
    }
    function openChatContextMenuFromKebab(btn, userId) {
      const r = btn.getBoundingClientRect();
      showChatContextMenu(r.right - 180, r.bottom + 4, userId);
    }
    // === end chat context menu =========================================

    // === Message context menu (long-press → reply on mobile) ===========
    // Touch devices have no hover, so the desktop ↩ button is hidden on
    // mobile (CSS). Long-press a bubble for ~500ms to bring up a small
    // menu with Reply (and room for future actions: copy / forward / etc).
    let _msgLongPressTimer = null;
    let _msgLongPressStart = null;
    const MSG_LONG_PRESS_MS = 480;
    const MSG_MOVE_TOLERANCE = 10;

    function _msgTouchStart(e) {
      if (e.touches.length !== 1) return;
      const bubble = e.target.closest('.msg');
      if (!bubble) return;
      // Skip if user tapped inside an interactive child (link, button, video, audio)
      if (e.target.closest('a, button, video, audio, input, textarea')) return;
      const id = bubble.dataset.msgId;
      if (!id) return;
      const t = e.touches[0];
      _msgLongPressStart = { x: t.clientX, y: t.clientY };
      _msgLongPressTimer = setTimeout(() => {
        showMsgContextMenu(t.clientX, t.clientY, id);
        if ('vibrate' in navigator) navigator.vibrate(30);
        _msgLongPressTimer = null;
      }, MSG_LONG_PRESS_MS);
    }
    function _msgTouchEnd() {
      if (_msgLongPressTimer) { clearTimeout(_msgLongPressTimer); _msgLongPressTimer = null; }
    }
    function _msgTouchMove(e) {
      if (!_msgLongPressTimer || !_msgLongPressStart) return;
      const t = e.touches[0];
      const dx = Math.abs(t.clientX - _msgLongPressStart.x);
      const dy = Math.abs(t.clientY - _msgLongPressStart.y);
      if (dx > MSG_MOVE_TOLERANCE || dy > MSG_MOVE_TOLERANCE) {
        clearTimeout(_msgLongPressTimer);
        _msgLongPressTimer = null;
      }
    }

    function showMsgContextMenu(x, y, msgId) {
      const menu = document.getElementById('msgCtxMenu');
      menu.innerHTML = \`
        <div class="ctx-item" onclick="closeMsgContextMenu();startReplyQuote('\${escapeHtml(msgId)}')">
          <span class="ctx-icon" style="font-size:14px;">↩</span><span>ตอบกลับ</span>
        </div>
      \`;
      menu.style.visibility = 'hidden';
      menu.classList.add('show');
      const w = menu.offsetWidth, h = menu.offsetHeight;
      const left = Math.min(Math.max(x - w / 2, 8), window.innerWidth - w - 8);
      const top  = Math.max(8, Math.min(y - h - 12, window.innerHeight - h - 8));
      menu.style.left = left + 'px';
      menu.style.top  = top + 'px';
      menu.style.visibility = '';
      setTimeout(() => {
        document.addEventListener('mousedown', _msgCtxOutsideClick);
        document.addEventListener('touchstart', _msgCtxOutsideClick);
      }, 0);
    }
    function _msgCtxOutsideClick(e) {
      const menu = document.getElementById('msgCtxMenu');
      if (menu && !menu.contains(e.target)) closeMsgContextMenu();
    }
    function closeMsgContextMenu() {
      document.getElementById('msgCtxMenu')?.classList.remove('show');
      document.removeEventListener('mousedown', _msgCtxOutsideClick);
      document.removeEventListener('touchstart', _msgCtxOutsideClick);
    }
    // Wire up touch listeners on the chat scroll area (event delegation —
    // works for bubbles that get re-rendered on every poll).
    {
      const chatScroll = document.getElementById('chatMessages');
      if (chatScroll) {
        chatScroll.addEventListener('touchstart', _msgTouchStart, { passive: true });
        chatScroll.addEventListener('touchend',   _msgTouchEnd);
        chatScroll.addEventListener('touchmove',  _msgTouchMove, { passive: true });
        chatScroll.addEventListener('touchcancel', _msgTouchEnd);
      }
    }
    // === end message context menu ======================================

    // === Promise-based confirm modal ===================================
    let _confirmResolver = null;
    function showConfirm({ title, body, warn, okLabel, danger, alertOnly }) {
      document.getElementById('confirmTitle').textContent = title || 'ยืนยัน?';
      document.getElementById('confirmBody').textContent = body || '';
      const warnEl = document.getElementById('confirmWarn');
      if (warn) {
        warnEl.textContent = warn;
        warnEl.style.display = '';
      } else {
        warnEl.style.display = 'none';
      }
      const okBtn = document.getElementById('confirmOkBtn');
      okBtn.textContent = okLabel || 'ตกลง';
      okBtn.classList.toggle('danger', danger === true);
      // Alert mode hides the Cancel button — single OK acknowledgement
      document.getElementById('confirmCancelBtn').style.display = alertOnly ? 'none' : '';
      document.getElementById('confirmOverlay').classList.add('show');
      return new Promise(resolve => { _confirmResolver = resolve; });
    }
    // Drop-in styled replacement for native showAlert(). Returns a Promise so
    // callers can await acknowledgement before continuing.
    function showAlert(message, title) {
      return showConfirm({ title: title || 'แจ้งเตือน', body: message, okLabel: 'ตกลง', alertOnly: true, danger: false });
    }
    function closeConfirm(result) {
      document.getElementById('confirmOverlay').classList.remove('show');
      const r = _confirmResolver;
      _confirmResolver = null;
      if (r) r(result);
    }

    async function deleteChat(userId) {
      const ok = await showConfirm({
        title: 'ลบ chat ทั้งหมด?',
        body: 'จะลบประวัติข้อความทั้งหมดของ user นี้ใน DB',
        warn: '⚠ ลบแล้วกู้ไม่ได้ · ไฟล์ใน GCS storage จะถูกเก็บไว้ (cleanup ภายหลัง) · ลูกค้าใน LINE ยังเห็นข้อความเดิม',
        okLabel: 'ลบ',
        danger: true,
      });
      if (!ok) return;
      try {
        const res = await fetch('/api/admin/conversations/' + encodeURIComponent(userId), { method: 'DELETE' });
        if (!res.ok) throw new Error('ลบไม่สำเร็จ');
        // Backend DELETE also removed the chat_status row — drop our cache entry
        _chatStatusCache.delete(userId);
        if (currentUserId === userId) {
          currentUserId = null;
          document.getElementById('chatHeader').innerHTML = '<span>เลือก user ทางซ้ายเพื่อเริ่มแชท</span>';
          document.getElementById('chatMessages').innerHTML = '<div class="empty-state">ยังไม่มี user ที่เลือก</div>';
          document.getElementById('chatInput').style.display = 'none';
          document.getElementById('tplBar').style.display = 'none';
          closeTplPanel();
          document.getElementById('infoSide').innerHTML = '<div class="info-side-empty"><button type="button" class="info-empty-manage" onclick="openNoteCatManager()" title="จัดการหมวดหมู่">⚙ จัดการหมวดหมู่</button><div class="empty-state">เลือก user เพื่อดูข้อมูล</div></div>';
        }
        await loadConversations();
      } catch (err) {
        showAlert('ลบไม่สำเร็จ: ' + err.message);
      }
    }

    // === Status popover (per-user) =====================================
    let statusPopoverTarget = null;

    function openStatusPopover(anchor, userId) {
      statusPopoverTarget = userId;
      const pop = document.getElementById('statusPopover');
      renderStatusPopoverBody(pop);

      pop.style.visibility = 'hidden';
      pop.classList.add('show');
      const popH = pop.offsetHeight;
      const popW = pop.offsetWidth;
      const r = anchor.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom - 8;
      const spaceAbove = r.top - 8;
      let top = r.bottom + 6;
      if (popH > spaceBelow && spaceAbove > spaceBelow) top = r.top - popH - 6;
      top = Math.max(8, Math.min(window.innerHeight - popH - 8, top));
      const left = Math.max(8, Math.min(window.innerWidth - popW - 8, r.left));
      pop.style.top = top + 'px';
      pop.style.left = left + 'px';
      pop.style.visibility = '';

      setTimeout(() => document.addEventListener('mousedown', statusPopoverOutsideClick), 0);
    }

    // Re-render the popover body in place. Called on first open and after
    // every multi-select toggle so checkmarks update without closing.
    function renderStatusPopoverBody(pop) {
      const userId = statusPopoverTarget;
      const currentTags = userId ? loadUserStatusTags(userId) : [];
      // Popover only manages **manual** status tags — note-derived chips
      // are owned by the บันทึก feature (add/remove a note to add/remove
      // its chip), so they intentionally aren't selectable here.
      const opts = USER_STATUS_TAGS.map(t => \`
        <div class="status-opt \${currentTags.includes(t.key) ? 'selected' : ''}" data-tag="\${t.key}">
          <span class="dot" style="background:\${t.color}"></span>
          <span>\${escapeHtml(t.label)}</span>
          <span class="check">✓</span>
        </div>
      \`).join('');
      pop.innerHTML = \`
        <div class="pop-head">
          <span>เลือกสถานะ</span>
          <button type="button" class="pop-clear" onclick="clearUserStatusFromPopover()" \${currentTags.length ? '' : 'disabled'}>ล้าง</button>
        </div>
        \${opts || '<div style="padding:14px;color:#9ca3af;font-size:12px;text-align:center;">ยังไม่มีแท็ก — กด "จัดการแท็ก" ด้านล่างเพื่อเพิ่ม</div>'}
        <div class="pop-foot">
          <button type="button" class="pop-manage" onclick="openTagManager()">⚙ จัดการแท็ก</button>
        </div>
      \`;
      pop.querySelectorAll('.status-opt').forEach(el => {
        el.addEventListener('click', () => commitUserStatus(el.dataset.tag));
      });
    }

    function commitUserStatus(tagKey) {
      if (!statusPopoverTarget) return;
      const tags = loadUserStatusTags(statusPopoverTarget);
      const idx = tags.indexOf(tagKey);
      if (idx >= 0) tags.splice(idx, 1); else tags.push(tagKey);
      saveUserStatusTags(statusPopoverTarget, tags);
      // Re-render body so the checkmark updates while the popover stays open
      // (lets admins toggle several tags in one pass).
      renderStatusPopoverBody(document.getElementById('statusPopover'));
      renderUserList();
    }

    function clearUserStatusFromPopover() {
      if (!statusPopoverTarget) return;
      saveUserStatusTags(statusPopoverTarget, []);
      renderStatusPopoverBody(document.getElementById('statusPopover'));
      renderUserList();
    }

    function closeStatusPopover() {
      document.getElementById('statusPopover').classList.remove('show');
      statusPopoverTarget = null;
      document.removeEventListener('mousedown', statusPopoverOutsideClick);
    }

    function statusPopoverOutsideClick(e) {
      const pop = document.getElementById('statusPopover');
      if (!pop.contains(e.target) && !e.target.closest('.user-tag') && !e.target.closest('.tag-mgr-overlay')) {
        closeStatusPopover();
      }
    }

    // === Tag manager modal (CRUD on USER_STATUS_TAGS) ==================
    let editingTagKey = null;

    function openTagManager() {
      editingTagKey = null;
      renderTagManagerList();
      resetTagForm();
      document.getElementById('tagMgrOverlay').classList.add('show');
      // Don't close status popover — user might come back to pick after editing
    }

    function closeTagManager() {
      document.getElementById('tagMgrOverlay').classList.remove('show');
      editingTagKey = null;
      // Refresh status popover if it's still open (tag list may have changed)
      if (statusPopoverTarget) {
        const anchor = document.querySelector(\`.user-tag[onclick*="\${statusPopoverTarget}"]\`);
        if (anchor) openStatusPopover(anchor, statusPopoverTarget);
      }
      renderUserList();
    }

    function renderTagManagerList() {
      const list = document.getElementById('tagMgrList');
      if (USER_STATUS_TAGS.length === 0) {
        list.innerHTML = '<div style="text-align:center;color:#9ca3af;padding:24px;font-size:13px;">ยังไม่มีแท็ก — เพิ่มได้ที่ฟอร์มด้านล่าง</div>';
        return;
      }
      list.innerHTML = USER_STATUS_TAGS.map(t => \`
        <div class="tag-mgr-row">
          <span class="dot" style="background:\${t.color}"></span>
          <span class="name">\${escapeHtml(t.label)}</span>
          <div class="actions">
            <button type="button" class="icon-btn" title="แก้ไข" onclick="startEditTag('\${escapeHtml(t.key)}')">
              <svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
            </button>
            <button type="button" class="icon-btn danger" title="ลบ" onclick="removeTag('\${escapeHtml(t.key)}')">
              <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2"/></svg>
            </button>
          </div>
        </div>
      \`).join('');
    }

    function startEditTag(key) {
      const t = USER_STATUS_BY_KEY[key];
      if (!t) return;
      editingTagKey = key;
      document.getElementById('tagFormTitle').textContent = 'แก้ไขแท็ก';
      document.getElementById('tagFormLabel').value = t.label;
      document.getElementById('tagFormColor').value = t.color;
      document.getElementById('tagFormCancel').style.display = '';
      document.getElementById('tagFormLabel').focus();
    }

    function cancelTagEdit() {
      editingTagKey = null;
      resetTagForm();
    }

    function resetTagForm() {
      editingTagKey = null;
      document.getElementById('tagFormTitle').textContent = 'เพิ่มแท็กใหม่';
      document.getElementById('tagFormLabel').value = '';
      document.getElementById('tagFormColor').value = '#2d6cdf';
      document.getElementById('tagFormCancel').style.display = 'none';
    }

    function commitTagForm() {
      const label = document.getElementById('tagFormLabel').value.trim();
      const color = document.getElementById('tagFormColor').value;
      if (!label) {
        showAlert('กรุณากรอกชื่อแท็ก');
        return;
      }
      if (editingTagKey) {
        const idx = USER_STATUS_TAGS.findIndex(t => t.key === editingTagKey);
        if (idx >= 0) USER_STATUS_TAGS[idx] = { ...USER_STATUS_TAGS[idx], label, color };
      } else {
        const newKey = 'tag_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        USER_STATUS_TAGS.push({ key: newKey, label, color });
      }
      persistStatusTags();
      rebuildStatusByKey();
      renderTagManagerList();
      resetTagForm();
    }

    async function removeTag(key) {
      const ok = await showConfirm({ title: 'ลบแท็กนี้?', body: 'user ที่ใช้แท็กนี้อยู่จะถูกล้างสถานะ', okLabel: 'ลบ', danger: true });
      if (!ok) return;
      USER_STATUS_TAGS = USER_STATUS_TAGS.filter(t => t.key !== key);
      persistStatusTags();
      rebuildStatusByKey();
      // Also strip this tag from any user that has it. Status now stores
      // an array of tags, so remove just the deleted key and keep the rest;
      // the legacy {tag} shape collapses to empty when its single tag matches.
      const keysToRewrite = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('userStatus:')) keysToRewrite.push(k);
      }
      for (const k of keysToRewrite) {
        try {
          const v = JSON.parse(localStorage.getItem(k));
          let nextTags = [];
          if (Array.isArray(v?.tags)) nextTags = v.tags.filter(t => t !== key);
          else if (typeof v?.tag === 'string' && v.tag !== key) nextTags = [v.tag];
          if (nextTags.length > 0) {
            localStorage.setItem(k, JSON.stringify({ tags: nextTags, updatedAt: new Date().toISOString() }));
          } else {
            localStorage.removeItem(k);
          }
        } catch {}
      }
      renderTagManagerList();
    }
    // === end status feature ============================================

    // === Note category manager (CRUD) ==================================
    // Same UX pattern as tag manager. Categories are referenced by their key
    // from saved notes; deleting a category leaves orphan notes that fall
    // back to a generic gray label (handled by NOTE_CAT_BY_KEY[k] fallback).
    let editingNoteCatKey = null;

    function openNoteCatManager() {
      editingNoteCatKey = null;
      renderNoteCatList();
      resetNoteCatForm();
      document.getElementById('noteCatMgrOverlay').classList.add('show');
    }

    function closeNoteCatManager() {
      document.getElementById('noteCatMgrOverlay').classList.remove('show');
      editingNoteCatKey = null;
      // If the note add/edit modal is still open, re-render its category list
      // so newly added/renamed/deleted categories show immediately.
      if (document.getElementById('noteOverlay')?.classList.contains('show')) {
        openNoteModal(editingNoteId || undefined);
      }
      // Refresh notes panel + sidebar status chips (note labels may have changed)
      if (currentUserId) renderNotes(currentUserId);
      renderUserList();
    }

    function renderNoteCatList() {
      const list = document.getElementById('noteCatMgrList');
      if (NOTE_CATEGORIES.length === 0) {
        list.innerHTML = '<div style="text-align:center;color:#9ca3af;padding:24px;font-size:13px;">ยังไม่มีหมวดหมู่ — เพิ่มได้ที่ฟอร์มด้านล่าง</div>';
        return;
      }
      list.innerHTML = NOTE_CATEGORIES.map(c => \`
        <div class="tag-mgr-row">
          <span class="dot" style="background:\${c.color}"></span>
          <span class="name">\${escapeHtml(c.label)}</span>
          <div class="actions">
            <button type="button" class="icon-btn" title="แก้ไข" onclick="startEditNoteCat('\${escapeHtml(c.key)}')">
              <svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
            </button>
            <button type="button" class="icon-btn danger" title="ลบ" onclick="removeNoteCat('\${escapeHtml(c.key)}')">
              <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2"/></svg>
            </button>
          </div>
        </div>
      \`).join('');
    }

    function startEditNoteCat(key) {
      const c = NOTE_CAT_BY_KEY[key];
      if (!c) return;
      editingNoteCatKey = key;
      document.getElementById('noteCatFormTitle').textContent = 'แก้ไขหมวดหมู่';
      document.getElementById('noteCatFormLabel').value = c.label;
      document.getElementById('noteCatFormColor').value = c.color;
      document.getElementById('noteCatFormCancel').style.display = '';
      document.getElementById('noteCatFormLabel').focus();
    }

    function cancelNoteCatEdit() {
      editingNoteCatKey = null;
      resetNoteCatForm();
    }

    function resetNoteCatForm() {
      editingNoteCatKey = null;
      document.getElementById('noteCatFormTitle').textContent = 'เพิ่มหมวดหมู่ใหม่';
      document.getElementById('noteCatFormLabel').value = '';
      document.getElementById('noteCatFormColor').value = '#2d6cdf';
      document.getElementById('noteCatFormCancel').style.display = 'none';
    }

    function commitNoteCatForm() {
      const label = document.getElementById('noteCatFormLabel').value.trim();
      const color = document.getElementById('noteCatFormColor').value;
      if (!label) {
        showAlert('กรุณากรอกชื่อหมวดหมู่');
        return;
      }
      if (editingNoteCatKey) {
        const idx = NOTE_CATEGORIES.findIndex(c => c.key === editingNoteCatKey);
        if (idx >= 0) NOTE_CATEGORIES[idx] = { ...NOTE_CATEGORIES[idx], label, color };
      } else {
        const newKey = 'cat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        NOTE_CATEGORIES.push({ key: newKey, label, color });
      }
      persistNoteCategories();
      rebuildNoteCatByKey();
      renderNoteCatList();
      resetNoteCatForm();
    }

    async function removeNoteCat(key) {
      const ok = await showConfirm({ title: 'ลบหมวดหมู่นี้?', body: 'บันทึกที่ใช้หมวดหมู่นี้อยู่จะแสดงเป็นป้ายสีเทาแทน', okLabel: 'ลบ', danger: true });
      if (!ok) return;
      NOTE_CATEGORIES = NOTE_CATEGORIES.filter(c => c.key !== key);
      persistNoteCategories();
      rebuildNoteCatByKey();
      renderNoteCatList();
    }
    // === end note category manager =====================================

    // === Quick reply templates =========================================
    // Per-browser localStorage. Each template = { key, items: [...] } where
    // items is an ordered array of { type: 'text'|'image'|'video', content?, gcsPath?, thumbPath? }.
    // Sending preserves item order, so admin controls layout (text-first vs media-first vs interleaved).
    // Files live in GCS; localStorage only stores the gs:// paths.
    const TPL_MAX = 20;
    const TPL_ITEMS_MAX = 5; // LINE allows 5 messages per push request
    const TPL_STORAGE_KEY = 'replyTemplates';
    const DEFAULT_TEMPLATES = [
      { key: 'hi',      items: [{ type: 'text', content: 'สวัสดีค่ะ มีอะไรให้ช่วยแจ้งได้เลยนะคะ' }] },
      { key: 'thanks',  items: [{ type: 'text', content: 'ขอบคุณที่สอบถามมานะคะ' }] },
      { key: 'wait',    items: [{ type: 'text', content: 'รอสักครู่นะคะ ทีมงานกำลังตรวจสอบให้ค่ะ' }] },
      { key: 'sorry',   items: [{ type: 'text', content: 'ขออภัยในความไม่สะดวกค่ะ' }] },
      { key: 'closing', items: [{ type: 'text', content: 'หากมีข้อสงสัยเพิ่มเติม สามารถสอบถามได้เลยค่ะ' }] },
    ];
    // Migrate old { body, assets } format → new items array (assets first then text,
    // matching the old send order). Idempotent — already-new templates pass through.
    function normalizeTpl(t) {
      if (Array.isArray(t.items)) return { key: t.key, items: t.items };
      const items = [];
      for (const a of t.assets ?? []) {
        items.push({ type: a.type, gcsPath: a.gcsPath, ...(a.thumbPath && { thumbPath: a.thumbPath }) });
      }
      if (t.body) items.push({ type: 'text', content: t.body });
      return { key: t.key, items };
    }
    function loadTemplates() {
      try {
        const raw = localStorage.getItem(TPL_STORAGE_KEY);
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) return arr.map(normalizeTpl);
        }
      } catch {}
      return DEFAULT_TEMPLATES.map(t => ({ ...t, items: [...t.items] }));
    }
    function persistTemplates() {
      localStorage.setItem(TPL_STORAGE_KEY, JSON.stringify(TEMPLATES));
    }
    // Helper: pick the first text content for chip display (or "(N items)" if all media)
    function tplDisplayText(t) {
      const text = t.items?.find(i => i.type === 'text')?.content;
      if (text) return text;
      return '(' + (t.items?.length ?? 0) + ' รายการ)';
    }
    function tplHasMedia(t) {
      return (t.items ?? []).some(i => i.type === 'image' || i.type === 'video');
    }
    let TEMPLATES = loadTemplates();
    let editingTplKey = null;

    function renderTplBar() {
      const chips = document.getElementById('tplChips');
      if (!chips) return;
      if (TEMPLATES.length === 0) {
        chips.innerHTML = '<span class="tpl-chips-empty">ยังไม่มีเทมเพลต — กดลูกศร → กด "+ เพิ่ม"</span>';
      } else {
        chips.innerHTML = TEMPLATES.map(t => {
          const display = tplDisplayText(t);
          const hasMedia = tplHasMedia(t);
          const cls = hasMedia ? 'tpl-chip has-assets' : 'tpl-chip';
          const tip = display + (hasMedia ? ' (มีไฟล์แนบ)' : '');
          return \`<button type="button" class="\${cls}" title="\${escapeHtml(tip)}"
                    onclick="useTemplate('\${escapeHtml(t.key)}')">\${escapeHtml(display)}</button>\`;
        }).join('');
      }
      renderTplPanel();
    }

    function renderTplPanel() {
      const list = document.getElementById('tplPanelList');
      if (!list) return;
      const addBtn = document.querySelector('.tpl-panel-add');
      if (addBtn) addBtn.disabled = TEMPLATES.length >= TPL_MAX;
      if (TEMPLATES.length === 0) {
        list.innerHTML = '<div class="tpl-empty-state">ยังไม่มีเทมเพลต<br>กด "+ เพิ่ม" เพื่อสร้างใหม่</div>';
        return;
      }
      list.innerHTML = TEMPLATES.map(t => {
        const display = tplDisplayText(t);
        const hasMedia = tplHasMedia(t);
        const mediaIcon = hasMedia ? '<span style="margin-right:6px;opacity:0.7;">📎</span>' : '';
        return \`
        <div class="tpl-row" onclick="useTemplate('\${escapeHtml(t.key)}');closeTplPanel()">
          <div class="tpl-text">\${mediaIcon}\${escapeHtml(display)}</div>
          <div class="tpl-row-actions">
            <button type="button" class="icon-btn" title="แก้ไข" onclick="event.stopPropagation();openTplEditor('\${escapeHtml(t.key)}')">
              <svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
            </button>
            <button type="button" class="icon-btn danger" title="ลบ" onclick="event.stopPropagation();removeTemplate('\${escapeHtml(t.key)}')">
              <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
            </button>
          </div>
        </div>
      \`;
      }).join('');
    }

    function toggleTplPanel() {
      const panel = document.getElementById('tplPanel');
      const bar = document.getElementById('tplBar');
      const isOpen = panel.classList.contains('show');
      if (isOpen) {
        panel.classList.remove('show');
        bar.classList.remove('expanded');
      } else {
        renderTplPanel();
        panel.classList.add('show');
        bar.classList.add('expanded');
        setTimeout(() => document.addEventListener('mousedown', _tplPanelOutsideClick), 0);
      }
    }
    function closeTplPanel() {
      document.getElementById('tplPanel')?.classList.remove('show');
      document.getElementById('tplBar')?.classList.remove('expanded');
      document.removeEventListener('mousedown', _tplPanelOutsideClick);
    }
    function _tplPanelOutsideClick(e) {
      const bar = document.getElementById('tplBar');
      const editOverlay = document.getElementById('tplEditOverlay');
      if (editOverlay?.classList.contains('show')) return; // editor is open, ignore
      if (bar && !bar.contains(e.target)) closeTplPanel();
    }

    async function useTemplate(key) {
      const t = TEMPLATES.find(x => x.key === key);
      if (!t) return;

      const items = t.items ?? [];
      const onlyTextItems = items.length > 0 && items.every(i => i.type === 'text');

      // Pure text → insert into input so admin can edit before sending (legacy UX
      // people are used to). Anything with media goes through the preview modal.
      if (onlyTextItems) {
        const input = document.getElementById('msgInput');
        const text = items.map(i => i.content).filter(Boolean).join('\\n');
        const cur = input.value;
        input.value = cur ? (cur.replace(/\\s+$/, '') + ' ' + text) : text;
        input.focus();
        input.dispatchEvent(new Event('input'));
        return;
      }

      if (!currentUserId) { showAlert('เลือก user ก่อน'); return; }
      openTplSendPreview(t);
    }

    // === Send preview modal ===========================================
    let _pendingSendItems = null;

    async function openTplSendPreview(t) {
      _pendingSendItems = t.items;
      const sub = document.getElementById('tplSendSub');
      const counts = (t.items ?? []).reduce((acc, i) => { acc[i.type] = (acc[i.type] ?? 0) + 1; return acc; }, {});
      const parts = [];
      if (counts.text)  parts.push(counts.text + ' ข้อความ');
      if (counts.image) parts.push(counts.image + ' รูป');
      if (counts.video) parts.push(counts.video + ' วิดีโอ');
      sub.textContent = 'ส่ง ' + parts.join(' + ') + ' ตามลำดับด้านล่าง';
      _renderTplSendBody(t.items, {});
      document.getElementById('tplSendOverlay').classList.add('show');

      // Re-sign gs:// paths so the preview shows real thumbnails. Persisted
      // templates only carry gcsPath (signed URLs expire), so we fetch fresh
      // ones here. Placeholders stay if backend is unreachable.
      const paths = [];
      for (const i of (t.items ?? [])) {
        if (i.type !== 'text' && i.gcsPath) paths.push(i.thumbPath || i.gcsPath);
      }
      if (paths.length === 0) return;
      try {
        const res = await fetch('/api/admin/template-preview-urls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paths }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!_pendingSendItems) return; // user closed modal mid-fetch
        _renderTplSendBody(t.items, data?.urls ?? {});
      } catch {
        // Keep placeholders on network failure
      }
    }

    function _renderTplSendBody(items, urlMap) {
      const body = document.getElementById('tplSendBody');
      body.innerHTML = (items ?? []).map(i => {
        if (i.type === 'text') {
          return \`<div class="tpl-send-bubble">\${escapeHtml(i.content || '')}</div>\`;
        }
        const key = i.thumbPath || i.gcsPath;
        const previewSrc = (urlMap && urlMap[key]) || i.previewUrl || '';
        const badge = i.type === 'video' ? '<span class="tpl-send-media-badge">▶ VIDEO</span>' : '';
        if (previewSrc) {
          return \`<div class="tpl-send-media"><img src="\${escapeHtml(previewSrc)}" alt="">\${badge}</div>\`;
        }
        // Loading state — fetched URLs replace this on resolve
        return \`<div class="tpl-send-media" style="padding:30px;text-align:center;color:#9ca3af;font-size:11px;">
          กำลังโหลดตัวอย่าง…\${badge}</div>\`;
      }).join('');
    }
    function closeTplSendPreview() {
      document.getElementById('tplSendOverlay').classList.remove('show');
      _pendingSendItems = null;
    }
    async function confirmTplSend() {
      if (!_pendingSendItems || !currentUserId) return;
      const btn = document.getElementById('tplSendBtn');
      btn.disabled = true;
      btn.textContent = 'กำลังส่ง…';
      try {
        const res = await fetch('/api/admin/send-template', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lineUserId: currentUserId, items: _pendingSendItems }),
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error(e.error || 'HTTP ' + res.status);
        }
        closeTplSendPreview();
        closeTplPanel();
        lastMessageCount = -1;
        await loadMessages(currentUserId, false);
        await loadConversations();
      } catch (err) {
        showAlert('ส่งเทมเพลตไม่สำเร็จ: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = 'ส่งให้ลูกค้า';
      }
    }

    // Editor — track in-progress items separately from saved TEMPLATES so user
    // can cancel without committing. Copy from existing template on open.
    // Each item: { type: 'text'|'image'|'video', content?, gcsPath?, thumbPath?, previewUrl?, _uploading? }
    let _editingItems = [];

    function openTplEditor(key) {
      editingTplKey = key || null;
      const t = key ? TEMPLATES.find(x => x.key === key) : null;
      document.getElementById('tplEditTitle').textContent = t ? 'แก้ไขเทมเพลต' : 'เพิ่มเทมเพลต';
      _editingItems = t?.items ? t.items.map(i => ({ ...i })) : [];
      // Seed with one empty text item if creating new
      if (!t && _editingItems.length === 0) {
        _editingItems.push({ type: 'text', content: '' });
      }
      renderTplItems();
      document.getElementById('tplEditOverlay').classList.add('show');
      setTimeout(() => {
        const firstText = document.querySelector('#tplItemsList textarea');
        firstText?.focus();
      }, 50);
    }
    function closeTplEditor() {
      document.getElementById('tplEditOverlay').classList.remove('show');
      editingTplKey = null;
      _editingItems = [];
    }
    function commitTplEditor() {
      // Sync any in-flight textarea edits into the model first
      _syncTplTextEdits();
      // Filter out empty text items + still-uploading media
      const cleanItems = _editingItems
        .filter(i => !i._uploading)
        .filter(i => i.type !== 'text' || (i.content && i.content.trim()))
        .map(i => {
          if (i.type === 'text') return { type: 'text', content: i.content.trim() };
          return { type: i.type, gcsPath: i.gcsPath, ...(i.thumbPath && { thumbPath: i.thumbPath }) };
        });
      if (cleanItems.length === 0) {
        showAlert('ต้องมีอย่างน้อย 1 รายการ (ข้อความหรือไฟล์)');
        return;
      }
      if (editingTplKey) {
        const idx = TEMPLATES.findIndex(t => t.key === editingTplKey);
        if (idx >= 0) TEMPLATES[idx] = { ...TEMPLATES[idx], items: cleanItems };
      } else {
        if (TEMPLATES.length >= TPL_MAX) {
          showAlert('เก็บได้สูงสุด ' + TPL_MAX + ' เทมเพลต — ลบบางอันก่อนเพิ่ม');
          return;
        }
        const newKey = 'tpl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        TEMPLATES.push({ key: newKey, items: cleanItems });
      }
      persistTemplates();
      renderTplBar();
      closeTplEditor();
    }
    async function removeTemplate(key) {
      const ok = await showConfirm({ title: 'ลบเทมเพลตนี้?', okLabel: 'ลบ', danger: true });
      if (!ok) return;
      TEMPLATES = TEMPLATES.filter(t => t.key !== key);
      persistTemplates();
      renderTplBar();
    }

    // Read textarea DOM values back into _editingItems (textareas don't fire
    // input events on every keystroke if user is fast — read on demand)
    function _syncTplTextEdits() {
      document.querySelectorAll('#tplItemsList textarea[data-tpl-idx]').forEach(ta => {
        const idx = parseInt(ta.dataset.tplIdx, 10);
        if (_editingItems[idx]?.type === 'text') {
          _editingItems[idx].content = ta.value;
        }
      });
    }

    function renderTplItems() {
      _syncTplTextEdits(); // preserve in-flight typing across re-renders (e.g. from move/remove)
      const list = document.getElementById('tplItemsList');
      const count = document.getElementById('tplItemCount');
      if (count) count.textContent = _editingItems.length + '/' + TPL_ITEMS_MAX;
      // Disable add buttons when at limit
      document.querySelectorAll('.tpl-edit-add-buttons .tpl-asset-add-btn').forEach(b => {
        b.disabled = _editingItems.length >= TPL_ITEMS_MAX;
      });
      if (!list) return;
      if (_editingItems.length === 0) {
        list.innerHTML = '<div class="tpl-items-empty">ยังไม่มีรายการ — กดปุ่มด้านล่างเพื่อเพิ่ม</div>';
        return;
      }
      const last = _editingItems.length - 1;
      list.innerHTML = _editingItems.map((it, i) => {
        const upArrow = \`<button type="button" onclick="moveTplItem(\${i},-1)" \${i === 0 ? 'disabled' : ''} title="ขึ้น"><svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg></button>\`;
        const downArrow = \`<button type="button" onclick="moveTplItem(\${i},1)" \${i === last ? 'disabled' : ''} title="ลง"><svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg></button>\`;
        const removeBtn = \`<button type="button" class="tpl-item-remove" onclick="removeTplItem(\${i})" title="ลบ">×</button>\`;
        let middle;
        if (it.type === 'text') {
          middle = \`<div class="tpl-item-content"><textarea data-tpl-idx="\${i}" rows="2" maxlength="500" placeholder="พิมพ์ข้อความ..." oninput="_editingItems[\${i}].content=this.value">\${escapeHtml(it.content || '')}</textarea></div>\`;
        } else {
          const previewSrc = it.previewUrl || '';
          const badge = it.type === 'video' ? '<span class="tpl-thumb-badge">VIDEO</span>' : '';
          const thumb = it._uploading
            ? '<div class="tpl-asset-spinner" style="position:static;background:transparent;color:#6b7280;width:56px;height:56px;">…</div>'
            : (previewSrc ? \`<div class="tpl-item-thumb"><img src="\${escapeHtml(previewSrc)}" alt="">\${badge}</div>\` : \`<div class="tpl-item-thumb">\${badge}</div>\`);
          const meta = it._uploading ? 'กำลังอัปโหลด…' : (it.type === 'image' ? '🖼️ รูปภาพ' : '🎬 วิดีโอ');
          middle = \`<div class="tpl-item-content">\${thumb}<span class="tpl-item-meta">\${meta}</span></div>\`;
        }
        return \`
          <div class="tpl-item \${it._uploading ? 'uploading' : ''}">
            <div class="tpl-item-handle">\${upArrow}\${downArrow}</div>
            \${middle}
            \${removeBtn}
          </div>
        \`;
      }).join('');
    }

    function moveTplItem(idx, delta) {
      _syncTplTextEdits();
      const target = idx + delta;
      if (target < 0 || target >= _editingItems.length) return;
      const tmp = _editingItems[idx];
      _editingItems[idx] = _editingItems[target];
      _editingItems[target] = tmp;
      renderTplItems();
    }

    function removeTplItem(idx) {
      _syncTplTextEdits();
      _editingItems.splice(idx, 1);
      renderTplItems();
    }

    function addTplTextItem() {
      _syncTplTextEdits();
      if (_editingItems.length >= TPL_ITEMS_MAX) {
        showAlert('เก็บได้สูงสุด ' + TPL_ITEMS_MAX + ' รายการต่อเทมเพลต');
        return;
      }
      _editingItems.push({ type: 'text', content: '' });
      renderTplItems();
      // Focus the new textarea
      setTimeout(() => {
        const tas = document.querySelectorAll('#tplItemsList textarea');
        tas[tas.length - 1]?.focus();
      }, 30);
    }

    async function _onTplFileSelected(input) {
      const files = Array.from(input.files || []);
      input.value = '';
      for (const file of files) {
        if (_editingItems.length >= TPL_ITEMS_MAX) {
          showAlert('เก็บได้สูงสุด ' + TPL_ITEMS_MAX + ' รายการต่อเทมเพลต');
          break;
        }
        await _uploadOneTplAsset(file);
      }
    }

    async function _uploadOneTplAsset(file) {
      _syncTplTextEdits();
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');
      if (!isImage && !isVideo) {
        showAlert('เฉพาะรูปภาพหรือวิดีโอเท่านั้น: ' + file.name);
        return;
      }

      const placeholder = { type: isImage ? 'image' : 'video', _uploading: true };
      _editingItems.push(placeholder);
      const idx = _editingItems.length - 1;
      renderTplItems();

      try {
        const fd = new FormData();
        fd.append('file', file);
        if (isVideo) {
          const thumbBlob = await _generateVideoThumb(file);
          fd.append('thumbnail', thumbBlob, 'thumb.jpg');
        }
        const res = await fetch('/api/admin/template-asset', { method: 'POST', body: fd });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error(e.error || 'HTTP ' + res.status);
        }
        const asset = await res.json();
        _editingItems[idx] = { type: asset.type, gcsPath: asset.gcsPath, thumbPath: asset.thumbPath, previewUrl: asset.previewUrl };
        renderTplItems();
      } catch (err) {
        _editingItems.splice(idx, 1);
        renderTplItems();
        showAlert('อัปโหลดไม่สำเร็จ (' + file.name + '): ' + err.message);
      }
    }

    // Generate a JPEG thumbnail from the first ~1s of a video using <video>+canvas
    function _generateVideoThumb(file) {
      return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;
        video.src = URL.createObjectURL(file);
        const cleanup = () => URL.revokeObjectURL(video.src);
        video.onloadedmetadata = () => {
          video.currentTime = Math.min(1, (video.duration || 4) * 0.25);
        };
        video.onseeked = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0);
            canvas.toBlob(blob => {
              cleanup();
              if (blob) resolve(blob); else reject(new Error('toBlob returned null'));
            }, 'image/jpeg', 0.85);
          } catch (err) { cleanup(); reject(err); }
        };
        video.onerror = () => { cleanup(); reject(new Error('video load failed')); };
      });
    }
    // === end templates =================================================
    const NOTES_STORAGE_KEY = (userId) => 'chatNotes:' + userId;
    let editingNoteId = null;

    function loadNotes(userId) {
      try {
        const raw = localStorage.getItem(NOTES_STORAGE_KEY(userId));
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    }
    function saveNotes(userId, notes) {
      localStorage.setItem(NOTES_STORAGE_KEY(userId), JSON.stringify(notes));
    }

    // Note-derived status chips — derived directly from a user's notes so
    // save/edit/delete on a note flows through to the chip with no extra
    // bookkeeping. Each note category contributes one chip; duplicates
    // collapse. Notes whose category was deleted (no metadata in
    // NOTE_CAT_BY_KEY) are skipped.
    function loadNoteStatusChips(userId) {
      const notes = loadNotes(userId).slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const seen = new Set();
      const chips = [];
      for (const n of notes) {
        let key, label, color;
        if (n.category === 'other') {
          const lbl = (n.customLabel || '').trim();
          if (!lbl) continue;
          key = 'note:other:' + lbl.toLowerCase();
          label = lbl;
          color = '#5f6368';
        } else {
          const meta = NOTE_CAT_BY_KEY[n.category];
          if (!meta) continue;
          key = 'note:' + n.category;
          label = meta.label;
          color = meta.color;
        }
        if (!seen.has(key)) {
          seen.add(key);
          chips.push({ key, label, color });
        }
      }
      return chips;
    }

    function fmtNoteDate(iso) {
      const d = new Date(iso);
      const date = d.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short' });
      const time = d.toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });
      return date + ' ' + time;
    }

    function renderNotes(userId) {
      const list = document.getElementById('notesList');
      if (!list) return;
      const notes = loadNotes(userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      if (notes.length === 0) {
        list.innerHTML = '<div class="note-empty">ยังไม่มีบันทึกสำหรับ user รายนี้</div>';
        return;
      }
      list.innerHTML = notes.map(n => {
        const cat = n.category === 'other'
          ? { label: n.customLabel || 'อื่น ๆ', color: '#5f6368' }
          : NOTE_CAT_BY_KEY[n.category] || { label: n.category, color: '#999' };
        return \`
          <div class="note-item" data-id="\${escapeHtml(n.id)}">
            <div class="note-cat">
              <span class="dot" style="background:\${cat.color}"></span>
              <span>\${escapeHtml(cat.label)}</span>
            </div>
            <div class="note-body">\${escapeHtml(n.body)}</div>
            <div class="note-meta">
              <span>\${escapeHtml(n.author || '—')} · \${fmtNoteDate(n.createdAt)}</span>
              <span class="note-actions">
                <button type="button" class="note-action" onclick="openNoteModal('\${n.id}')">แก้ไข</button>
                <button type="button" class="note-action danger" onclick="deleteNote('\${n.id}')">ลบ</button>
              </span>
            </div>
          </div>
        \`;
      }).join('');
    }

    function openNoteModal(noteId) {
      if (!currentUserId) return;
      editingNoteId = noteId || null;
      const overlay = document.getElementById('noteOverlay');
      const title = document.getElementById('noteModalTitle');
      const catList = document.getElementById('noteCatList');
      const body = document.getElementById('noteBody');
      const author = document.getElementById('noteAuthor');

      title.textContent = noteId ? 'แก้ไขบันทึก' : 'เพิ่มบันทึก';

      let existing = null;
      if (noteId) {
        existing = loadNotes(currentUserId).find(n => n.id === noteId) || null;
      }

      const isOther = existing?.category === 'other';
      const presetChecked = !existing && !isOther; // default to first preset on new note
      catList.innerHTML =
        NOTE_CATEGORIES.map((c, i) => \`
          <li>
            <label>
              <input type="radio" name="noteCat" value="\${c.key}" \${(existing ? existing.category === c.key : (presetChecked && i === 0)) ? 'checked' : ''} />
              <span class="cat-dot" style="background:\${c.color}"></span>
              <span>\${escapeHtml(c.label)}</span>
            </label>
          </li>
        \`).join('') +
        \`<li>
          <label>
            <input type="radio" name="noteCat" value="other" \${isOther ? 'checked' : ''} />
            <span class="cat-dot" style="background:#5f6368"></span>
            <span>อื่น ๆ</span>
          </label>
          <div class="note-other-input \${isOther ? 'show' : ''}" id="noteOtherWrap">
            <input type="text" id="noteOtherInput" placeholder="ระบุหัวข้อ..." maxlength="60"
                   value="\${escapeHtml(existing?.customLabel || '')}" />
          </div>
        </li>\`;

      // Toggle the custom-label input when "อื่น ๆ" is picked vs not
      catList.querySelectorAll('input[name="noteCat"]').forEach(el => {
        el.addEventListener('change', () => {
          const wrap = document.getElementById('noteOtherWrap');
          if (el.value === 'other' && el.checked) {
            wrap.classList.add('show');
            document.getElementById('noteOtherInput')?.focus();
          } else if (el.checked) {
            wrap.classList.remove('show');
          }
        });
      });

      body.value = existing?.body || '';
      author.value = existing?.author || (localStorage.getItem('lastNoteAuthor') || '');

      overlay.classList.add('show');
      setTimeout(() => body.focus(), 50);
    }

    function closeNoteModal() {
      document.getElementById('noteOverlay').classList.remove('show');
      editingNoteId = null;
    }

    function saveNote() {
      if (!currentUserId) return;
      const cat = document.querySelector('input[name="noteCat"]:checked')?.value;
      const body = document.getElementById('noteBody').value.trim();
      const author = document.getElementById('noteAuthor').value.trim() || 'Admin';

      if (!cat) {
        showAlert('กรุณาเลือกหมวด');
        return;
      }

      let customLabel = '';
      if (cat === 'other') {
        customLabel = (document.getElementById('noteOtherInput')?.value || '').trim();
        if (!customLabel) {
          showAlert('กรุณาระบุหัวข้อสำหรับ "อื่น ๆ"');
          return;
        }
      }

      localStorage.setItem('lastNoteAuthor', author);
      const notes = loadNotes(currentUserId);

      if (editingNoteId) {
        const idx = notes.findIndex(n => n.id === editingNoteId);
        if (idx >= 0) {
          notes[idx] = { ...notes[idx], category: cat, customLabel, body, author, updatedAt: new Date().toISOString() };
        }
      } else {
        notes.push({
          id: 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
          category: cat,
          customLabel,
          body,
          author,
          createdAt: new Date().toISOString(),
        });
      }

      saveNotes(currentUserId, notes);
      closeNoteModal();
      renderNotes(currentUserId);
      // Note-derived chip is computed from the notes themselves, so a fresh
      // user-list render is enough — saving/editing a note flows through.
      renderUserList();
    }

    async function deleteNote(noteId) {
      if (!currentUserId) return;
      const ok = await showConfirm({ title: 'ลบบันทึกนี้?', okLabel: 'ลบ', danger: true });
      if (!ok) return;
      const notes = loadNotes(currentUserId).filter(n => n.id !== noteId);
      saveNotes(currentUserId, notes);
      renderNotes(currentUserId);
      // Drops the corresponding chip when this was the last note in its
      // category — chips are derived from the notes array.
      renderUserList();
    }
    // === end Notes prototype ========================================

    function exportIconMarkup() {
      return \`<div class="chat-head-actions">
        <button type="button" class="chat-head-icon" onclick="openBulkModal()" title="Export บทสนทนา">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/>
          </svg>
        </button>
      </div>\`;
    }

    async function selectUser(userId) {
      currentUserId = userId;
      lastMessageCount = -1;
      cancelReplyQuote(); // clear any in-progress quote when switching users
      // On mobile, picking a user closes the sidebar drawer so the chat is visible
      closeMobilePanels();
      document.getElementById('chatInput').style.display = 'flex';
      document.getElementById('tplBar').style.display = 'flex';
      renderTplBar();

      document.querySelectorAll('.user-item').forEach(el => {
        el.classList.toggle('active', el.getAttribute('onclick')?.includes(userId));
      });

      const header = document.getElementById('chatHeader');
      const container = document.getElementById('chatMessages');
      const cached = userProfiles[userId];
      const headAvatar = avatarMarkup(cached?.pictureUrl, cached?.displayName || userId);
      header.innerHTML = \`\${headAvatar}<span class="name">\${escapeHtml(cached?.displayName || userId.substring(0, 20) + '...')}</span>\${exportIconMarkup()}\`;
      container.innerHTML = '<div class="loading-wrap"><div class="spinner"></div><div>กำลังโหลดข้อความ...</div></div>';
      renderInfoPanel(userId, null, null);

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
        if (!res.ok) throw new Error('HTTP ' + res.status);
        data = await res.json();
      } catch (err) {
        if (mySeq === loadSeq && isInitial) {
          document.getElementById('chatMessages').innerHTML =
            '<div class="empty-state">โหลดข้อความไม่สำเร็จ (' + err.message + ')</div>';
        }
        return;
      }

      if (mySeq !== loadSeq || userId !== currentUserId) return;
      // Guard against malformed responses (e.g. error JSON without messages)
      if (!data || !Array.isArray(data.messages)) {
        if (isInitial) {
          document.getElementById('chatMessages').innerHTML =
            '<div class="empty-state">โหลดข้อความไม่สำเร็จ (response ผิดรูปแบบ)</div>';
        }
        return;
      }

      const container = document.getElementById('chatMessages');
      const header = document.getElementById('chatHeader');
      const profile = data.profile;
      const name = profile?.displayName || userProfiles[userId]?.displayName || userId;
      const pic = profile?.pictureUrl || userProfiles[userId]?.pictureUrl || null;
      header.innerHTML = \`\${avatarMarkup(pic, name)}<span class="name">\${escapeHtml(name)}</span>\${exportIconMarkup()}\`;
      renderInfoPanel(userId, profile, data.messages);

      if (data.messages.length === lastMessageCount) return;
      lastMessageCount = data.messages.length;

      // Index by id for quick quote lookup (also exposed as _lastMessagesById
      // so the reply button handler can find a message at hover time).
      const msgById = new Map(data.messages.map(m => [String(m.id), m]));
      _lastMessagesById = msgById;
      const previewOfMessage = (m) => {
        if (m?.content?.text) return String(m.content.text).slice(0, 120);
        if (m?.messageType === 'image') return '🖼 รูปภาพ';
        if (m?.messageType === 'video') return '🎬 วิดีโอ';
        if (m?.messageType === 'audio') return '🎵 ไฟล์เสียง';
        if (m?.messageType === 'file') return '📎 ' + (m?.content?.filename || 'ไฟล์');
        if (m?.messageType === 'sticker') return '🟢 สติกเกอร์';
        return '[' + (m?.messageType || '') + ']';
      };
      const authorOfMessage = (m, fallbackName) => {
        if (m?.direction === 'outbound_admin') return 'Admin';
        if (m?.direction === 'outbound_bot') return 'Bot';
        return fallbackName;
      };
      const _convoUserName = (data.profile?.displayName || userProfiles[userId]?.displayName || userId);

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

        // If this message quoted another, render the quote box at the top
        let quoteBox = '';
        if (m.quotedMessageId) {
          const q = msgById.get(String(m.quotedMessageId));
          if (q) {
            const author = authorOfMessage(q, _convoUserName);
            quoteBox = \`<div class="msg-quote-box" data-quoted-id="\${escapeHtml(String(q.id))}" title="ข้อความที่อ้างถึง">
              <div class="msg-quote-author">\${escapeHtml(author)}</div>
              <div class="msg-quote-body">\${escapeHtml(previewOfMessage(q))}</div>
            </div>\`;
          } else {
            quoteBox = \`<div class="msg-quote-box"><div class="msg-quote-body">(ข้อความที่อ้างถึงถูกลบหรือเก่าเกินไป)</div></div>\`;
          }
        }

        const canQuote = !!m.quoteToken;
        const replyBtnTitle = canQuote
          ? 'ตอบกลับข้อความนี้'
          : 'ตอบกลับ (ข้อความนี้ไม่รองรับ quote — จะส่งเป็นข้อความปกติ)';
        const replyBtn = \`<button type="button" class="msg-reply-btn\${canQuote ? '' : ' no-quote'}" title="\${replyBtnTitle}"
          onclick="event.stopPropagation();startReplyQuote('\${escapeHtml(String(m.id))}')">↩</button>\`;

        return \`\${dayHtml}
          <div class="msg \${dir}" data-msg-id="\${escapeHtml(String(m.id))}">
            \${label ? \`<div class="msg-label">\${label}</div>\` : ''}
            \${quoteBox}
            \${media}
            \${hasText ? \`<div>\${text}</div>\` : ''}
            <div class="msg-time">\${time}</div>
            \${replyBtn}
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

    // === Reply / Quote state ===========================================
    // When set, the next text message sent will be a quote-reply to this msg.
    // Quote applies only to TEXT replies (LINE quoteToken needs a text message
    // payload). Attachments fall through unchanged.
    let _replyQuoteMessageId = null;

    function startReplyQuote(msgId) {
      // Find the message in the latest loaded set
      const container = document.getElementById('chatMessages');
      const bubble = container.querySelectorAll('.msg');
      // The data we have for quote preview is the rendered text; pull from
      // the bubble itself for the banner preview.
      // Find bubble by data-quoted-id is wrong direction — instead match by
      // looking for the bubble that has reply button targeting this msgId.
      // Simpler: store the message map at render time.
      const m = _lastMessagesById?.get(String(msgId));
      if (!m) {
        showAlert('ไม่พบข้อความที่จะตอบกลับ — ลองรีเฟรช');
        return;
      }
      _replyQuoteMessageId = String(msgId);

      const banner = document.getElementById('quoteBanner');
      const labelEl = document.getElementById('quoteLabel');
      const textEl = document.getElementById('quoteText');
      const author = m.direction === 'outbound_admin' ? 'Admin'
                   : m.direction === 'outbound_bot' ? 'Bot'
                   : (userProfiles[currentUserId]?.displayName || 'ลูกค้า');
      // When the target has no quoteToken (e.g. it was sent before the
      // capture-token feature), we fall back to a plain text reply on the
      // server. Tell the admin up-front so the result isn't surprising.
      const canQuote = !!m.quoteToken;
      labelEl.textContent = canQuote
        ? '↩ ตอบกลับ ' + author
        : '↩ ตอบกลับ ' + author + ' (ส่งเป็นข้อความปกติ — ไม่รองรับ quote)';
      textEl.textContent = (m.content?.text)
        ? String(m.content.text)
        : (m.messageType === 'image' ? '🖼 รูปภาพ'
           : m.messageType === 'video' ? '🎬 วิดีโอ'
           : m.messageType === 'audio' ? '🎵 ไฟล์เสียง'
           : m.messageType === 'sticker' ? '🟢 สติกเกอร์'
           : '[' + m.messageType + ']');
      banner.classList.add('show');
      document.getElementById('msgInput').focus();
    }

    function cancelReplyQuote() {
      _replyQuoteMessageId = null;
      document.getElementById('quoteBanner').classList.remove('show');
    }
    // === end reply/quote state =========================================

    async function sendMessage() {
      const input = document.getElementById('msgInput');
      const btn = document.getElementById('sendBtn');
      const message = input.value.trim();
      const hasAttachments = pendingAttachments.length > 0;
      if (!message && !hasAttachments) return;
      if (!currentUserId) return;

      btn.disabled = true;
      const savedText = message;
      const savedQuoteId = _replyQuoteMessageId;
      input.value = '';
      input.style.height = '';

      // Snapshot attachments so user can paste more during upload without race
      const attachments = pendingAttachments.slice();
      clearPendingAttachments();

      try {
        // Send attachments first, in paste order (no quote on attachments — LINE
        // requires the message to be text-typed for quoteToken in v1)
        for (const a of attachments) {
          await uploadOneFile(a.file, a.kind);
        }
        // Then text last (acts as caption + carries the quote if any)
        if (message) {
          const body = { lineUserId: currentUserId, message };
          if (savedQuoteId) body.quoteMessageId = savedQuoteId;
          const res = await fetch('/api/admin/reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          if (!res.ok) {
            const txt = await res.text();
            // Try to parse JSON error message for nicer alert
            let msg = txt;
            try { msg = (JSON.parse(txt).error || txt); } catch {}
            throw new Error(msg);
          }
        }
        cancelReplyQuote();
        lastMessageCount = -1;
        await loadMessages(currentUserId, false);
        await loadConversations();
      } catch (err) {
        showAlert('ส่งไม่สำเร็จ: ' + err.message);
        // Restore so user doesn't lose their work
        input.value = savedText;
        input.dispatchEvent(new Event('input')); // re-trigger auto-grow
        for (const a of attachments) pendingAttachments.push(a);
        renderAttachBar();
        // Keep the quote selection so user can retry
        _replyQuoteMessageId = savedQuoteId;
        if (savedQuoteId) document.getElementById('quoteBanner').classList.add('show');
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

    // Pending attachments — files staged via paste/picker, sent on Enter/Send.
    // Each item: { file, previewUrl }. previewUrl needs URL.revokeObjectURL on remove.
    const pendingAttachments = [];

    function addPendingFile(file) {
      if (!file) return;
      const kind = file.type.startsWith('image/') ? 'image'
                 : file.type.startsWith('video/') ? 'video'
                 : 'file';
      const limit = SIZE_LIMITS[kind];
      if (file.size > limit) {
        showAlert(\`ไฟล์ใหญ่เกินไป\\n\\nประเภท: \${kind}\\nขนาดไฟล์: \${formatMB(file.size)}\\nขีดจำกัด: \${formatMB(limit)}\`);
        return;
      }
      const previewUrl = (kind === 'image' || kind === 'video') ? URL.createObjectURL(file) : null;
      pendingAttachments.push({ file, previewUrl, kind });
      renderAttachBar();
    }

    function removePendingAt(idx) {
      const a = pendingAttachments[idx];
      if (a?.previewUrl) URL.revokeObjectURL(a.previewUrl);
      pendingAttachments.splice(idx, 1);
      renderAttachBar();
    }

    function clearPendingAttachments() {
      for (const a of pendingAttachments) if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      pendingAttachments.length = 0;
      renderAttachBar();
    }

    function renderAttachBar() {
      const bar = document.getElementById('attachBar');
      if (!bar) return;
      if (pendingAttachments.length === 0) {
        bar.classList.remove('show');
        bar.innerHTML = '';
        return;
      }
      bar.classList.add('show');
      bar.innerHTML = pendingAttachments.map((a, i) => {
        const inner = a.kind === 'image' && a.previewUrl
          ? \`<img src="\${a.previewUrl}" alt="">\`
          : a.kind === 'video' && a.previewUrl
            ? \`<video src="\${a.previewUrl}" muted></video>\`
            : \`<span class="placeholder">📎 \${escapeHtml((a.file.name || 'file').slice(0, 20))}</span>\`;
        const sizeLabel = formatMB(a.file.size);
        return \`<div class="attach-item">
          \${inner}
          <span class="meta">\${sizeLabel}</span>
          <button type="button" class="remove" title="เอาออก" onclick="removePendingAt(\${i})">×</button>
        </div>\`;
      }).join('');
    }

    // Single-file upload (used by sendMessage to flush pending attachments one at a time).
    async function uploadOneFile(file, kind) {
      const formData = new FormData();
      formData.append('lineUserId', currentUserId);
      formData.append('file', file);

      if (kind === 'video') {
        let thumb;
        try {
          thumb = await generateVideoThumbnail(file);
        } catch (err) {
          console.warn('video thumbnail gen failed, using placeholder:', err);
          thumb = await makePlaceholderThumbnail();
        }
        formData.append('thumbnail', thumb, 'thumb.jpg');
      }

      const res = await fetch('/api/admin/upload', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('upload failed: ' + res.status);
    }

    function uploadMedia() {
      const fileInput = document.getElementById('fileInput');
      const files = Array.from(fileInput.files || []);
      for (const file of files) addPendingFile(file);
      fileInput.value = '';
    }


    // Enter sends, Shift+Enter inserts newline
    document.getElementById('msgInput').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Auto-grow the textarea up to max-height (CSS controls the cap, then scrolls)
    const _msgInputEl = document.getElementById('msgInput');
    function autoGrowMsgInput() {
      _msgInputEl.style.height = 'auto';
      _msgInputEl.style.height = Math.min(_msgInputEl.scrollHeight, 150) + 'px';
    }
    _msgInputEl.addEventListener('input', autoGrowMsgInput);

    // === Image lightbox =================================================
    function openLightbox(src) {
      const lb = document.getElementById('lightbox');
      document.getElementById('lightboxImg').src = src;
      lb.classList.add('show');
    }
    function closeLightbox() {
      const lb = document.getElementById('lightbox');
      lb.classList.remove('show');
      document.getElementById('lightboxImg').src = '';
    }
    // Click any image in the chat scroll → open lightbox
    document.getElementById('chatMessages').addEventListener('click', e => {
      const img = e.target;
      if (img && img.tagName === 'IMG' && img.classList.contains('msg-media')) {
        openLightbox(img.src);
      }
    });
    // Esc closes
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && document.getElementById('lightbox').classList.contains('show')) {
        closeLightbox();
      }
    });
    // === end lightbox ===================================================

    // Paste from clipboard — Ctrl+V an image/file stages it as a pending
    // attachment (shows in the bar above the input). The user can keep typing
    // text or paste more files, then press Enter / click Send to send everything.
    // Plain-text paste falls through to the default behaviour.
    document.getElementById('msgInput').addEventListener('paste', e => {
      if (!currentUserId) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      let staged = false;
      for (const item of items) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (!file) continue;
          addPendingFile(file);
          staged = true;
        }
      }
      if (staged) e.preventDefault();
    });

    function readFilters() {
      filters.dateFrom = document.getElementById('filterDateFrom').value;
      filters.dateTo = document.getElementById('filterDateTo').value;
      filters.name = document.getElementById('filterUserName').value;
      filters.message = document.getElementById('filterMessage').value;
      filters.status = document.getElementById('filterStatus').value;
      searchTerm = filters.name;
      renderUserList();
    }
    ['filterDateFrom', 'filterDateTo', 'filterUserName', 'filterMessage', 'filterStatus']
      .forEach(id => {
        const el = document.getElementById(id);
        const evt = el.tagName === 'SELECT' || el.type === 'date' ? 'change' : 'input';
        el.addEventListener(evt, readFilters);
      });
    document.getElementById('filterSearchBtn').addEventListener('click', readFilters);
    document.getElementById('filterResetBtn').addEventListener('click', () => {
      ['filterDateFrom', 'filterDateTo', 'filterUserName', 'filterMessage'].forEach(id => {
        document.getElementById(id).value = '';
      });
      document.getElementById('filterStatus').value = 'all';
      readFilters();
      loadConversations();
    });

    document.getElementById('tabs').addEventListener('click', e => {
      const tab = e.target.closest('.tab');
      if (!tab) return;
      activeFilter = tab.dataset.filter;
      document.querySelectorAll('.tab').forEach(el => el.classList.toggle('active', el === tab));
      renderUserList();
    });

    // === Bulk export modal ===
    const BULK_MAX = 100;
    const bulkSelected = new Set();

    let _bulkDateListenersAttached = false;
    function openBulkModal() {
      bulkSelected.clear();
      bulkTopics.clear();
      if (currentUserId && allUsers.some(u => u.lineUserId === currentUserId)) {
        bulkSelected.add(currentUserId);
      }
      // Re-render bulk list when date inputs change so out-of-range users
      // are faded/disabled accordingly. Attach once — listeners persist.
      if (!_bulkDateListenersAttached) {
        document.getElementById('bulkFrom')?.addEventListener('change', renderBulkList);
        document.getElementById('bulkTo')?.addEventListener('change', renderBulkList);
        _bulkDateListenersAttached = true;
      }
      renderBulkList();
      updateBulkFooter();
      renderQuickChip();
      document.getElementById('bulkOverlay').classList.add('show');
      setTimeout(() => document.getElementById('bulkEditor')?.focus(), 50);
    }

    function closeBulkModal() {
      closeTopicPopover();
      document.getElementById('bulkOverlay').classList.remove('show');
    }

    // Mirror server-side 17:00 cutoff so the date-range filter in the modal
    // matches what the export would actually produce.
    function bizDayStartMs(dateStr) {
      const d = new Date(dateStr);
      d.setUTCDate(d.getUTCDate() - 1);
      d.setUTCHours(10, 0, 0, 0); // 17:00 Bangkok = 10:00 UTC
      return d.getTime();
    }
    function bizDayEndMs(dateStr) {
      const d = new Date(dateStr);
      d.setUTCHours(9, 59, 59, 999);
      return d.getTime();
    }
    function bulkDateRange() {
      const fromVal = document.getElementById('bulkFrom')?.value || '';
      const toVal = document.getElementById('bulkTo')?.value || '';
      return {
        startTs: fromVal ? bizDayStartMs(fromVal) : null,
        endTs: toVal ? bizDayEndMs(toVal) : null,
      };
    }
    function isUserInBulkRange(u, range) {
      if (range.startTs === null && range.endTs === null) return true;
      const ts = new Date(u.timestamp).getTime();
      if (range.startTs !== null && ts < range.startTs) return false;
      if (range.endTs !== null && ts > range.endTs) return false;
      return true;
    }

    function renderBulkList() {
      const list = document.getElementById('bulkList');
      if (allUsers.length === 0) {
        list.innerHTML = '<div class="empty-state">ยังไม่มี user</div>';
        return;
      }

      // Auto-deselect users that fell out of range when date inputs changed
      const range = bulkDateRange();
      const userInRange = new Map(allUsers.map(u => [u.lineUserId, isUserInBulkRange(u, range)]));
      const toDrop = [];
      bulkSelected.forEach(uid => { if (!userInRange.get(uid)) toDrop.push(uid); });
      toDrop.forEach(uid => bulkSelected.delete(uid));

      const atMax = bulkSelected.size >= BULK_MAX;
      list.innerHTML = allUsers.map(u => {
        const inRange = userInRange.get(u.lineUserId);
        const rawName = u.displayName || u.lineUserId.substring(0, 12) + '...';
        const name = escapeHtml(rawName);
        const avatar = avatarMarkup(u.pictureUrl, rawName);
        const safeId = escapeHtml(u.lineUserId);
        const isChecked = bulkSelected.has(u.lineUserId);
        const checkedAttr = isChecked ? 'checked' : '';
        const disabledAttr = (!inRange || (!isChecked && atMax)) ? 'disabled' : '';
        const cls = !inRange ? 'out-of-range' : '';
        const rowStyle = (inRange && !isChecked && atMax) ? 'opacity:0.4;cursor:not-allowed;' : '';
        return \`
          <label class="bulk-item \${cls}" style="\${rowStyle}">
            <input type="checkbox" value="\${safeId}" \${checkedAttr} \${disabledAttr} onchange="toggleBulkUser('\${safeId}', this.checked)" />
            \${avatar}
            <div class="bulk-name">
              <div>\${name}</div>
              <div class="bulk-sub">\${safeId.substring(0, 20)}...</div>
            </div>
            \${inRange ? renderTopicChip(u.lineUserId) : ''}
          </label>
        \`;
      }).join('');
      // Keep footer count consistent if we just auto-dropped any users
      updateBulkFooter();
    }

    // === Per-user topic selection (export-time tagging) =================
    // bulkTopics: lineUserId -> { category, otherText? }
    // For "__quick__" key: holds the staged topic for quick-apply.
    const bulkTopics = new Map();
    let topicPopoverTarget = null;  // userId or '__quick__'
    let topicPopoverDraft = null;   // { category, otherText }

    function getTopicMeta(category) {
      if (category === 'other') return { label: 'อื่น ๆ', color: '#5f6368' };
      const cat = NOTE_CAT_BY_KEY[category];
      return cat ? { label: cat.label, color: cat.color } : null;
    }

    // Pre-fill default topic from the user's most recent note (if any).
    function defaultTopicForUser(userId) {
      const notes = loadNotes(userId);
      if (notes.length === 0) return null;
      const latest = notes.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      if (latest.category === 'other' && latest.customLabel) {
        // Note's custom label flows into Topic chip → "หัวข้อที่แจ้ง" in export
        return { category: 'other', otherText: latest.customLabel };
      }
      if (NOTE_CAT_BY_KEY[latest.category]) {
        return { category: latest.category };
      }
      return null;
    }

    function ensureBulkTopic(userId) {
      if (bulkTopics.has(userId)) return bulkTopics.get(userId);
      const def = defaultTopicForUser(userId);
      if (def) {
        bulkTopics.set(userId, def);
        return def;
      }
      return null;
    }

    function renderTopicChip(userId) {
      const t = ensureBulkTopic(userId);
      if (!t) {
        return \`<button type="button" class="topic-chip" onclick="event.preventDefault();event.stopPropagation();openTopicPopover(this, '\${escapeHtml(userId)}')">
          <span class="label">+ หัวข้อ</span>
        </button>\`;
      }
      const meta = getTopicMeta(t.category);
      if (!meta) return '';
      const display = t.category === 'other' ? (t.otherText || 'อื่น ๆ') : meta.label;
      return \`<button type="button" class="topic-chip has-topic" onclick="event.preventDefault();event.stopPropagation();openTopicPopover(this, '\${escapeHtml(userId)}')">
        <span class="dot" style="background:\${meta.color}"></span>
        <span class="label">\${escapeHtml(display)}</span>
        <span class="caret">▾</span>
      </button>\`;
    }

    function renderQuickChip() {
      const chip = document.getElementById('quickTopicChip');
      const applyBtn = document.getElementById('quickApplyBtn');
      const t = bulkTopics.get('__quick__');
      const dot = chip.querySelector('.dot');
      const label = chip.querySelector('.label');
      if (!t) {
        chip.classList.remove('has-topic');
        dot.style.display = 'none';
        label.textContent = 'เลือกหัวข้อ';
        applyBtn.disabled = true;
      } else {
        const meta = getTopicMeta(t.category);
        chip.classList.add('has-topic');
        dot.style.display = '';
        dot.style.background = meta?.color || '#999';
        label.textContent = t.category === 'other' ? (t.otherText || 'อื่น ๆ') : (meta?.label || t.category);
        applyBtn.disabled = bulkSelected.size === 0;
      }
    }

    function openTopicPopover(anchor, key) {
      topicPopoverTarget = key;
      const current = bulkTopics.get(key) || null;
      topicPopoverDraft = current ? { ...current } : null;

      const pop = document.getElementById('topicPopover');
      const opts = NOTE_CATEGORIES.map(c => \`
        <div class="topic-opt \${topicPopoverDraft?.category === c.key ? 'selected' : ''}" data-cat="\${c.key}">
          <span class="dot" style="background:\${c.color}"></span>
          <span>\${escapeHtml(c.label)}</span>
          <span class="check">✓</span>
        </div>
      \`).join('');
      const isOther = topicPopoverDraft?.category === 'other';
      pop.innerHTML = \`
        <div class="pop-head">
          <span>เลือกหัวข้อ</span>
          <button type="button" class="pop-clear" onclick="topicClear()" \${current ? '' : 'disabled'}>ล้าง</button>
        </div>
        \${opts}
        <div class="topic-opt other-opt \${isOther ? 'selected' : ''}" data-cat="other">
          <span class="dot" style="background:#5f6368"></span>
          <span>อื่น ๆ</span>
          <span class="check">✓</span>
          <div class="topic-other-input \${isOther ? 'show' : ''}" onclick="event.stopPropagation()">
            <input type="text" id="topicOtherInput" placeholder="ระบุหัวข้อ แล้วกด Enter" maxlength="60"
                   value="\${escapeHtml(topicPopoverDraft?.otherText || '')}" />
          </div>
        </div>
      \`;

      pop.querySelectorAll('.topic-opt').forEach(el => {
        el.addEventListener('click', () => topicSelect(el.dataset.cat));
      });
      const otherInp = document.getElementById('topicOtherInput');
      if (otherInp) {
        otherInp.addEventListener('keydown', e => {
          if (e.key === 'Enter') { e.preventDefault(); topicCommitOther(); }
          else if (e.key === 'Escape') { closeTopicPopover(); }
        });
        otherInp.addEventListener('blur', () => {
          // Commit on blur ONLY if value is non-empty (so accidental focus loss doesn't drop input)
          if (otherInp.value.trim()) topicCommitOther();
        });
      }

      // Position: prefer below, fall back to above. Clamp to viewport.
      pop.style.visibility = 'hidden';
      pop.classList.add('show');
      const popH = pop.offsetHeight;
      const popW = pop.offsetWidth;
      const r = anchor.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom - 8;
      const spaceAbove = r.top - 8;
      let top = r.bottom + 6;
      if (popH > spaceBelow && spaceAbove > spaceBelow) {
        top = r.top - popH - 6;
      }
      top = Math.max(8, Math.min(window.innerHeight - popH - 8, top));
      const left = Math.max(8, Math.min(window.innerWidth - popW - 8, r.left));
      pop.style.top = top + 'px';
      pop.style.left = left + 'px';
      pop.style.visibility = '';

      setTimeout(() => {
        document.addEventListener('mousedown', topicPopoverOutsideClick);
        if (isOther) otherInp?.focus();
      }, 0);
    }

    // Click on a category row.
    // - Non-"other": commit immediately + close popover (1 click = done)
    // - "other": expand inline input, focus it; commit happens on Enter/blur
    function topicSelect(cat) {
      if (cat !== 'other') {
        commitTopic({ category: cat });
        return;
      }
      // Switch to "other" without committing yet
      topicPopoverDraft = { category: 'other', otherText: topicPopoverDraft?.otherText || '' };
      const pop = document.getElementById('topicPopover');
      pop.querySelectorAll('.topic-opt').forEach(el => {
        el.classList.toggle('selected', el.dataset.cat === 'other');
      });
      pop.querySelector('.topic-other-input')?.classList.add('show');
      document.getElementById('topicOtherInput')?.focus();
    }

    function topicCommitOther() {
      const inp = document.getElementById('topicOtherInput');
      const text = (inp?.value || '').trim();
      if (!text) return; // require text for "other"
      commitTopic({ category: 'other', otherText: text.slice(0, 60) });
    }

    function commitTopic(draft) {
      if (!topicPopoverTarget) return;
      bulkTopics.set(topicPopoverTarget, draft);
      const wasQuick = topicPopoverTarget === '__quick__';
      closeTopicPopover();
      if (wasQuick) renderQuickChip();
      else renderBulkList();
    }

    function topicClear() {
      if (!topicPopoverTarget) return;
      bulkTopics.delete(topicPopoverTarget);
      const wasQuick = topicPopoverTarget === '__quick__';
      closeTopicPopover();
      if (wasQuick) renderQuickChip();
      else renderBulkList();
    }

    function closeTopicPopover() {
      document.getElementById('topicPopover').classList.remove('show');
      topicPopoverTarget = null;
      topicPopoverDraft = null;
      document.removeEventListener('mousedown', topicPopoverOutsideClick);
    }

    function topicPopoverOutsideClick(e) {
      const pop = document.getElementById('topicPopover');
      if (!pop.contains(e.target) && !e.target.closest('.topic-chip')) {
        closeTopicPopover();
      }
    }

    function applyQuickTopic() {
      const t = bulkTopics.get('__quick__');
      if (!t || bulkSelected.size === 0) return;
      bulkSelected.forEach(uid => bulkTopics.set(uid, { ...t }));
      renderBulkList();
    }
    // === end topic selection ============================================

    function toggleBulkUser(userId, checked) {
      if (checked) {
        if (bulkSelected.size >= BULK_MAX) {
          showAlert('เลือกได้สูงสุด ' + BULK_MAX + ' แชทต่อครั้ง');
          renderBulkList();
          return;
        }
        bulkSelected.add(userId);
      } else {
        bulkSelected.delete(userId);
      }
      renderBulkList();
      updateBulkFooter();
    }

    function toggleAllBulk() {
      // Only operate on users in the selected date range
      const range = bulkDateRange();
      const selectable = allUsers
        .filter(u => isUserInBulkRange(u, range))
        .slice(0, BULK_MAX)
        .map(u => u.lineUserId);
      const allCapSelected = selectable.every(id => bulkSelected.has(id)) && bulkSelected.size === selectable.length;
      if (allCapSelected) {
        bulkSelected.clear();
      } else {
        bulkSelected.clear();
        selectable.forEach(id => bulkSelected.add(id));
      }
      renderBulkList();
      updateBulkFooter();
    }

    function updateBulkFooter() {
      const n = bulkSelected.size;
      document.getElementById('bulkCount').textContent = n + ' / ' + BULK_MAX;
      document.getElementById('bulkWordBtn').disabled = n === 0;
      const pdfBtn = document.getElementById('bulkPdfBtn');
      pdfBtn.disabled = n !== 1;
      pdfBtn.title = n === 0
        ? 'กรุณาเลือกผู้ใช้ 1 คน'
        : n === 1
          ? 'Export PDF ของแชทนี้'
          : 'PDF รองรับเฉพาะแชทเดียว (Word รองรับหลายแชท)';
      renderQuickChip();
    }

    // Notes shipped to the server: just the fields the renderer needs (no
    // local IDs or timestamps that aren't display-relevant).
    function notesPayloadFor(userId) {
      return loadNotes(userId).map(n => {
        const cat = NOTE_CAT_BY_KEY[n.category] || { label: n.category, color: '#999999' };
        return {
          category: n.category,
          categoryLabel: cat.label,
          color: cat.color,
          body: n.body,
          author: n.author,
          createdAt: n.createdAt,
        };
      });
    }

    function topicPayloadFor(userId) {
      const t = bulkTopics.get(userId);
      if (!t) return null;
      const meta = getTopicMeta(t.category);
      if (!meta) return null;
      const label = t.category === 'other' ? (t.otherText || 'อื่น ๆ') : meta.label;
      return {
        category: t.category,
        categoryLabel: label,
        color: meta.color,
      };
    }

    async function postExport(url, body, suggestedFilename) {
      const btns = document.querySelectorAll('#bulkPdfBtn, #bulkWordBtn');
      btns.forEach(b => b.disabled = true);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const text = await res.text();
          showAlert('Export ล้มเหลว: ' + (text || res.status));
          return;
        }
        const blob = await res.blob();
        // Try to use server-provided filename, fall back to suggested.
        let filename = suggestedFilename;
        const cd = res.headers.get('Content-Disposition') || '';
        const m = cd.match(/filename\\*=UTF-8''([^;]+)/i);
        if (m) { try { filename = decodeURIComponent(m[1]); } catch {} }

        const a = document.createElement('a');
        const objectUrl = URL.createObjectURL(blob);
        a.href = objectUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
      } finally {
        btns.forEach(b => b.disabled = false);
      }
    }

    function doBulkExport(format) {
      const count = bulkSelected.size;
      if (count === 0) return;
      if (format === 'pdf' && count > 1) return;

      const from = document.getElementById('bulkFrom')?.value || '';
      const to = document.getElementById('bulkTo')?.value || '';
      const editor = (document.getElementById('bulkEditor')?.value || '').trim();

      const commonParams = new URLSearchParams();
      if (from) commonParams.set('from', from);
      if (to) commonParams.set('to', to);
      if (editor) commonParams.set('editor', editor);

      // Filename date = end-of-range (or start, if only "from" given), else today
      const pickDate = to || from || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
      const today = new Date(pickDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }).replace(/-/g, '');
      let url, body, fallbackName;
      if (count === 1) {
        const userId = Array.from(bulkSelected)[0];
        const profile = userProfiles[userId];
        const safeName = (profile?.displayName || userId.slice(0, 8))
          .replace(/[^a-zA-Z0-9ก-๙_\\-.]/g, '_').slice(0, 40);
        url = '/api/admin/conversations/' + encodeURIComponent(userId) + '/export/' + format;
        if (commonParams.toString()) url += '?' + commonParams.toString();
        body = {
          notes: notesPayloadFor(userId),
          topic: topicPayloadFor(userId),
        };
        fallbackName = 'DaikinPromo_' + safeName + '_' + today + (format === 'pdf' ? '.pdf' : '.docx');
      } else {
        const qs = new URLSearchParams(commonParams);
        qs.set('ids', Array.from(bulkSelected).join(','));
        url = '/api/admin/export/bulk/word?' + qs.toString();
        const notesByUser = {};
        const topicByUser = {};
        Array.from(bulkSelected).forEach(uid => {
          const arr = notesPayloadFor(uid);
          if (arr.length > 0) notesByUser[uid] = arr;
          const t = topicPayloadFor(uid);
          if (t) topicByUser[uid] = t;
        });
        body = { notesByUser, topicByUser };
        fallbackName = 'DaikinPromo_ChatReport_' + today + '.docx';
      }
      postExport(url, body, fallbackName).then(() => closeBulkModal());
    }

    loadConversations();
    setInterval(loadConversations, 5000);

    // === Pretty date format dd/mm/yyyy ==================================
    // Native <input type="date"> shows mm/dd/yyyy on en-US browsers and we
    // can't reorder fields via CSS. Workaround: hide the native input
    // off-screen but keep it functional, and overlay a sibling text input
    // that shows dd/mm/yyyy. Click → trigger native picker via showPicker().
    function _formatDDMM(yyyymmdd) {
      if (!yyyymmdd) return '';
      const parts = yyyymmdd.split('-');
      if (parts.length !== 3) return yyyymmdd;
      // dd/mm/yyyy — both day and month zero-padded, full year
      return parts[2] + '/' + parts[1] + '/' + parts[0];
    }
    function _enhanceDateInputs() {
      document.querySelectorAll('input[type=date]').forEach(input => {
        if (input.dataset.enhanced === '1') return;
        input.dataset.enhanced = '1';

        // Wrap input + display so the native input can sit absolutely on top
        // of the visible dd/mm/yyyy text. Native input is opacity:0 so the
        // calendar icon is invisible — Chrome won't auto-open the picker on
        // a plain click in that case, so we explicitly call showPicker() in
        // the click handler. Anchors correctly because the input is now at
        // its real on-screen position (not off-screen like before).
        const wrap = document.createElement('span');
        wrap.className = 'date-wrap';

        const display = document.createElement('input');
        display.type = 'text';
        display.readOnly = true;
        display.placeholder = 'dd/mm/yyyy';
        display.className = 'date-pretty ' + (input.className || '');
        display.tabIndex = -1;

        input.parentNode.insertBefore(wrap, input);
        wrap.appendChild(display);
        wrap.appendChild(input);

        const openPicker = (e) => {
          if (e) e.preventDefault();
          if (typeof input.showPicker === 'function') {
            try { input.showPicker(); return; } catch {}
          }
          input.focus();
        };
        // Catch click on either the visible display OR the transparent native
        // input on top of it — both should open the picker.
        display.addEventListener('mousedown', openPicker);
        input.addEventListener('mousedown', openPicker);

        input.addEventListener('change', () => {
          display.value = _formatDDMM(input.value);
        });

        display.value = _formatDDMM(input.value);
      });
    }
    _enhanceDateInputs();
    // Re-enhance whenever a modal that contains date inputs is opened
    // (the bulk export modal's date inputs are static HTML so already handled,
    // but this guards against future dynamically-added inputs).
    new MutationObserver(_enhanceDateInputs).observe(document.body, { childList: true, subtree: true });
    // === end pretty date ================================================
  </script>
</body>
</html>
`;