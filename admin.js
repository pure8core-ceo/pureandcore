/* =========================================================
   맑음 air care — 관리자 대시보드 로직
   - Supabase Auth 로그인
   - 상담 문의 관리 (조회 / 필터 / 상태·메모 수정 / CSV)
   - 트래픽 분석 (방문 추이 / 유입경로 / 기기 / 페이지)
   ========================================================= */
(function () {
  'use strict';

  // ---------- 상태 라벨 ----------
  const STATUS = {
    NEW:       { label: '신규',   },
    CONTACTED: { label: '상담중', },
    BOOKED:    { label: '예약확정' },
    DONE:      { label: '완료',   },
    CANCELLED: { label: '취소',   }
  };
  const STATUS_ORDER = ['NEW', 'CONTACTED', 'BOOKED', 'DONE', 'CANCELLED'];
  const PALETTE = ['#2E9BD6', '#6FB48B', '#E8A13C', '#9B87D4', '#E0787D', '#5FBFC9', '#A7B0B8'];

  // ---------- 전역 상태 ----------
  let client = null;
  let consultations = [];
  let pageViews = [];
  let activeStatus = 'ALL';
  let searchTerm = '';
  const charts = {};
  const SETTINGS_DEFAULTS = {
    brand_name: '맑음', brand_sub: 'air care', logo_url: '',
    biz_name: '(주)맑음 에어케어', biz_ceo: '000', biz_reg_no: '000-00-00000'
  };
  let settings = { ...SETTINGS_DEFAULTS };
  let pendingLogo = ''; // 설정 폼에서 편집 중인 로고(data URL)

  // ---------- 유틸 ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function esc(v) {
    if (v == null) return '';
    return String(v).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }
  function dayKey(d) {
    const dt = (d instanceof Date) ? d : new Date(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function fmtDateTime(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${m}.${day} ${hh}:${mm}`;
  }
  function lastNDays(n) {
    const out = [];
    const today = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      out.push(dayKey(d));
    }
    return out;
  }
  function startOfDaysAgo(n) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - n);
    return d;
  }
  function uniqueSessions(rows) {
    const s = new Set();
    rows.forEach((r) => { if (r.session_id) s.add(r.session_id); });
    return s.size;
  }

  // =========================================================
  //  초기화 & 인증
  // =========================================================
  async function boot() {
    // 환경변수 로드
    let url = window.SUPABASE_URL, key = window.SUPABASE_ANON_KEY;
    if (!url || url === 'YOUR_SUPABASE_URL') {
      try {
        const r = await fetch('/api/env-config');
        if (r.ok) { const c = await r.json(); url = c.SUPABASE_URL; key = c.SUPABASE_ANON_KEY; }
      } catch (e) { /* noop */ }
    }
    if (!window.supabase || !url || !key) {
      showLoginError('Supabase 설정을 불러오지 못했습니다. 환경변수를 확인하세요.');
      show('login');
      return;
    }
    client = window.supabase.createClient(url, key);

    // 브랜드 설정 로드 (공개 읽기 — 로그인 전에도 적용)
    await loadSettings();

    // 기존 세션 확인
    const { data: { session } } = await client.auth.getSession();
    if (session) {
      await enterApp(session);
    } else {
      show('login');
    }

    client.auth.onAuthStateChange((_event, sess) => {
      if (!sess) show('login');
    });
  }

  function show(view) {
    $('#login-view').hidden = view !== 'login';
    $('#loading-view').hidden = view !== 'loading';
    $('#app-view').hidden = view !== 'app';
  }
  function showLoginError(msg) {
    const el = $('#login-error');
    el.textContent = msg;
    el.hidden = !msg;
  }

  async function handleLogin(e) {
    e.preventDefault();
    showLoginError('');
    const btn = $('.login__btn');
    btn.disabled = true; btn.textContent = '로그인 중…';
    const email = $('#login-email').value.trim();
    const password = $('#login-password').value;
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    btn.disabled = false; btn.textContent = '로그인';
    if (error) {
      showLoginError('로그인 실패: 이메일 또는 비밀번호를 확인하세요.');
      return;
    }
    await enterApp(data.session);
  }

  async function enterApp(session) {
    show('loading');
    $('#user-email').textContent = session.user.email || '';
    await loadData();
    renderAll();
    show('app');
    requestAnimationFrame(resizeAllCharts);
  }

  function resizeAllCharts() {
    Object.values(charts).forEach((c) => { try { c.resize(); } catch (e) { /* noop */ } });
  }

  async function handleLogout() {
    await client.auth.signOut();
    consultations = []; pageViews = [];
    show('login');
    $('#login-password').value = '';
  }

  // =========================================================
  //  데이터 로드
  // =========================================================
  async function loadData() {
    const since = startOfDaysAgo(90).toISOString();
    const [cRes, pRes] = await Promise.all([
      client.from('consultations').select('*').order('created_at', { ascending: false }),
      client.from('page_views').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(20000)
    ]);
    if (cRes.error) console.error('상담 로드 오류:', cRes.error.message);
    if (pRes.error) console.error('방문 로드 오류:', pRes.error.message);
    consultations = cRes.data || [];
    pageViews = pRes.data || [];
  }

  // =========================================================
  //  렌더 - 전체
  // =========================================================
  function renderAll() {
    renderDashboard();
    renderConsultTab();
    renderTrafficTab();
    renderSettings();
  }

  // ---------- 대시보드 ----------
  function renderDashboard() {
    const today = dayKey(new Date());
    const days7 = new Set(lastNDays(7));
    const viewsToday = pageViews.filter((v) => dayKey(v.created_at) === today);
    const views7 = pageViews.filter((v) => days7.has(dayKey(v.created_at)));
    const newCount = consultations.filter((c) => c.status === 'NEW').length;

    kpiCards('#kpi-grid', [
      { label: '오늘 방문', value: viewsToday.length, sub: `순 방문자 ${uniqueSessions(viewsToday)}명` },
      { label: '최근 7일 방문', value: views7.length, sub: `순 방문자 ${uniqueSessions(views7)}명` },
      { label: '전체 상담 신청', value: consultations.length, sub: `미처리 <b>${newCount}</b>건` },
      { label: '누적 방문(90일)', value: pageViews.length, sub: `순 방문자 ${uniqueSessions(pageViews)}명` }
    ]);

    // 최근 30일 추이
    const days = lastNDays(30);
    const counts = days.map((d) => pageViews.filter((v) => dayKey(v.created_at) === d).length);
    lineChart('chart-trend', days.map(shortDay), [
      { label: '방문수', data: counts, color: PALETTE[0], fill: true }
    ]);

    // 유입경로 / 기기
    doughnut('chart-source', groupCount(pageViews, 'utm_source'));
    doughnut('chart-device', groupCount(pageViews, 'device'));

    // 최근 상담 5건
    renderRecentConsults();
  }

  function renderRecentConsults() {
    const rows = consultations.slice(0, 5);
    const host = $('#recent-consults');
    if (!rows.length) { host.innerHTML = '<div class="empty">아직 상담 신청이 없습니다.</div>'; return; }
    host.innerHTML = `<div class="table-wrap"><table class="table"><tbody>${
      rows.map((c) => `
        <tr data-id="${esc(c.id)}">
          <td class="cell-name">${esc(c.name)}</td>
          <td>${esc(c.phone)}</td>
          <td class="cell-sub">${esc(c.size || '-')}</td>
          <td>${statusBadge(c.status)}</td>
          <td class="cell-sub">${fmtDateTime(c.created_at)}</td>
        </tr>`).join('')
    }</tbody></table></div>`;
    $$('#recent-consults tr').forEach((tr) => tr.addEventListener('click', () => openDrawer(tr.dataset.id)));
  }

  // ---------- 상담 문의 탭 ----------
  function renderConsultTab() {
    renderStatusFilters();
    renderConsultTable();
  }

  function renderStatusFilters() {
    const host = $('#status-filters');
    const counts = { ALL: consultations.length };
    STATUS_ORDER.forEach((s) => { counts[s] = consultations.filter((c) => c.status === s).length; });
    const chip = (key, label) =>
      `<button class="chip ${activeStatus === key ? 'is-active' : ''}" data-status="${key}">${label}<span class="chip__count">${counts[key] || 0}</span></button>`;
    host.innerHTML = chip('ALL', '전체') + STATUS_ORDER.map((s) => chip(s, STATUS[s].label)).join('');
    $$('#status-filters .chip').forEach((b) => b.addEventListener('click', () => {
      activeStatus = b.dataset.status;
      renderStatusFilters();
      renderConsultTable();
    }));
  }

  function filteredConsults() {
    const term = searchTerm.trim().toLowerCase();
    return consultations.filter((c) => {
      if (activeStatus !== 'ALL' && c.status !== activeStatus) return false;
      if (term) {
        const hay = `${c.name || ''} ${c.phone || ''} ${c.size || ''} ${c.address || ''}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }

  function renderConsultTable() {
    const rows = filteredConsults();
    const tbody = $('#consult-tbody');
    $('#consult-empty').hidden = rows.length > 0;
    tbody.innerHTML = rows.map((c) => `
      <tr data-id="${esc(c.id)}">
        <td class="cell-sub">${fmtDateTime(c.created_at)}</td>
        <td class="cell-name">${esc(c.name)}</td>
        <td>${esc(c.phone)}</td>
        <td>${esc([c.size, c.address].filter(Boolean).join(' · ') || '-')}</td>
        <td>${esc(c.desired_date || '-')}</td>
        <td class="cell-sub">${esc(c.utm_source || 'direct')}</td>
        <td>${statusBadge(c.status)}</td>
      </tr>`).join('');
    $$('#consult-tbody tr').forEach((tr) => tr.addEventListener('click', () => openDrawer(tr.dataset.id)));
  }

  function statusBadge(status) {
    const s = STATUS[status] ? status : 'NEW';
    return `<span class="badge badge--${s}">${STATUS[s].label}</span>`;
  }

  // ---------- 트래픽 탭 ----------
  function renderTrafficTab() {
    const since = startOfDaysAgo(60);
    const recent = pageViews.filter((v) => new Date(v.created_at) >= since);
    const conv = consultations.filter((c) => new Date(c.created_at) >= since).length;
    const uniq = uniqueSessions(recent);
    const rate = uniq ? ((conv / uniq) * 100).toFixed(1) : '0.0';

    kpiCards('#traffic-kpi', [
      { label: '방문수 (60일)', value: recent.length },
      { label: '순 방문자 (60일)', value: uniq },
      { label: '상담 전환 (60일)', value: conv },
      { label: '전환율', value: rate + '%', sub: '상담 ÷ 순 방문자' }
    ]);

    // 일별 방문 + 순방문자 (최근 30일)
    const days = lastNDays(30);
    const visits = days.map((d) => pageViews.filter((v) => dayKey(v.created_at) === d).length);
    const uniqs = days.map((d) => uniqueSessions(pageViews.filter((v) => dayKey(v.created_at) === d)));
    lineChart('chart-traffic-trend', days.map(shortDay), [
      { label: '방문수', data: visits, color: PALETTE[0], fill: true },
      { label: '순 방문자', data: uniqs, color: PALETTE[1], fill: false }
    ]);

    // 유입경로 테이블 (source+medium)
    const srcMap = {};
    recent.forEach((v) => {
      const k = `${v.utm_source || 'direct'}||${v.utm_medium || 'none'}`;
      srcMap[k] = (srcMap[k] || 0) + 1;
    });
    const srcRows = Object.entries(srcMap).sort((a, b) => b[1] - a[1]).slice(0, 12);
    $('#source-tbody').innerHTML = srcRows.length ? srcRows.map(([k, n]) => {
      const [s, m] = k.split('||');
      return `<tr><td>${esc(s)}</td><td class="cell-sub">${esc(m)}</td><td class="num">${n}</td></tr>`;
    }).join('') : emptyRow(3);

    // 페이지별
    const pathRows = Object.entries(groupCountRaw(recent, 'path')).sort((a, b) => b[1] - a[1]).slice(0, 12);
    $('#path-tbody').innerHTML = pathRows.length ? pathRows.map(([p, n]) =>
      `<tr><td>${esc(p || '/')}</td><td class="num">${n}</td></tr>`).join('') : emptyRow(2);
  }

  function emptyRow(cols) {
    return `<tr><td colspan="${cols}" class="cell-sub" style="text-align:center;padding:20px">데이터 없음</td></tr>`;
  }

  // =========================================================
  //  드로어 (상담 상세 & 편집)
  // =========================================================
  function openDrawer(id) {
    const c = consultations.find((x) => String(x.id) === String(id));
    if (!c) return;
    const panel = $('#drawer-panel');
    const row = (k, v) => `<div class="drawer__row"><span class="drawer__key">${k}</span><span class="drawer__val">${v}</span></div>`;
    const phoneLink = c.phone ? `<a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>` : '-';

    panel.innerHTML = `
      <div class="drawer__head">
        <div>
          <div class="drawer__title">${esc(c.name || '-')}</div>
          <div class="cell-sub" style="margin-top:4px">${fmtDateTime(c.created_at)} 접수</div>
        </div>
        <button class="drawer__close" id="drawer-close">×</button>
      </div>
      ${row('연락처', phoneLink)}
      ${row('평형', esc(c.size || '-'))}
      ${c.address ? row('지역', esc(c.address)) : ''}
      ${row('입주예정', esc(c.desired_date || '-'))}
      ${c.message ? row('메시지', esc(c.message)) : ''}
      ${row('유입', `${esc(c.utm_source || 'direct')} / ${esc(c.utm_medium || 'none')}`)}
      ${c.utm_campaign && c.utm_campaign !== 'none' ? row('캠페인', esc(c.utm_campaign)) : ''}
      ${c.referrer && c.referrer !== 'direct' ? row('referrer', esc(c.referrer)) : ''}

      <div class="drawer__section">
        <h4>상태</h4>
        <select class="status-select" id="d-status">
          ${STATUS_ORDER.map((s) => `<option value="${s}" ${c.status === s ? 'selected' : ''}>${STATUS[s].label}</option>`).join('')}
        </select>
      </div>
      <div class="drawer__section">
        <h4>담당자</h4>
        <input class="status-select" id="d-assigned" placeholder="담당 매니저" value="${esc(c.assigned_to || '')}">
      </div>
      <div class="drawer__section">
        <h4>메모</h4>
        <textarea class="notes-area" id="d-notes" placeholder="상담 내용, 특이사항 등">${esc(c.notes || '')}</textarea>
      </div>
      <button class="drawer__save" id="d-save">저장</button>
      <p class="drawer__saved" id="d-saved" hidden>✓ 저장되었습니다</p>
    `;
    $('#drawer').hidden = false;
    $('#drawer-close').addEventListener('click', closeDrawer);
    $('#d-save').addEventListener('click', () => saveConsult(c.id));
  }

  function closeDrawer() { $('#drawer').hidden = true; }

  async function saveConsult(id) {
    const btn = $('#d-save');
    btn.disabled = true; btn.textContent = '저장 중…';
    const patch = {
      status: $('#d-status').value,
      assigned_to: $('#d-assigned').value.trim() || null,
      notes: $('#d-notes').value.trim() || null
    };
    const { error } = await client.from('consultations').update(patch).eq('id', id);
    btn.disabled = false; btn.textContent = '저장';
    if (error) { alert('저장 실패: ' + error.message); return; }
    // 로컬 반영
    const c = consultations.find((x) => String(x.id) === String(id));
    if (c) Object.assign(c, patch);
    $('#d-saved').hidden = false;
    setTimeout(() => { $('#d-saved').hidden = true; }, 1500);
    renderConsultTab();
    renderDashboard();
  }

  // =========================================================
  //  집계 & 차트
  // =========================================================
  function groupCountRaw(rows, field) {
    const map = {};
    rows.forEach((r) => { const k = r[field] || '(없음)'; map[k] = (map[k] || 0) + 1; });
    return map;
  }
  function groupCount(rows, field) {
    const map = groupCountRaw(rows, field);
    let entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
    if (entries.length > 6) {
      const top = entries.slice(0, 6);
      const rest = entries.slice(6).reduce((s, e) => s + e[1], 0);
      top.push(['기타', rest]);
      entries = top;
    }
    return { labels: entries.map((e) => e[0]), data: entries.map((e) => e[1]) };
  }
  function shortDay(key) { return key.slice(5); } // MM-DD

  function destroyChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }

  function lineChart(id, labels, datasets) {
    destroyChart(id);
    const ctx = document.getElementById(id);
    if (!ctx || !window.Chart) return;
    charts[id] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: datasets.map((d) => ({
          label: d.label,
          data: d.data,
          borderColor: d.color,
          backgroundColor: d.fill ? hexA(d.color, 0.12) : d.color,
          fill: d.fill,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4
        }))
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: datasets.length > 1, position: 'bottom', labels: { boxWidth: 10, usePointStyle: true } } },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 10, color: '#9FB2BD', font: { size: 11 } } },
          y: { beginAtZero: true, grid: { color: '#EEF1F3' }, ticks: { precision: 0, color: '#9FB2BD', font: { size: 11 } } }
        }
      }
    });
  }

  function doughnut(id, { labels, data }) {
    destroyChart(id);
    const ctx = document.getElementById(id);
    if (!ctx || !window.Chart) return;
    if (!data.length) { data = [1]; labels = ['데이터 없음']; }
    charts[id] = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: PALETTE, borderWidth: 2, borderColor: '#fff' }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '62%',
        plugins: { legend: { position: 'right', labels: { boxWidth: 10, usePointStyle: true, font: { size: 12 } } } }
      }
    });
  }

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }

  // ---------- KPI 렌더 ----------
  function kpiCards(sel, items) {
    $(sel).innerHTML = items.map((k) => `
      <div class="kpi">
        <div class="kpi__label">${esc(k.label)}</div>
        <div class="kpi__value">${typeof k.value === 'number' ? k.value.toLocaleString() : esc(k.value)}</div>
        ${k.sub ? `<div class="kpi__sub">${k.sub}</div>` : ''}
      </div>`).join('');
  }

  // =========================================================
  //  브랜드 설정 (로고 / 기업명)
  // =========================================================
  async function loadSettings() {
    try {
      const res = await client.from('site_settings').select('key, value');
      if (!res.error && res.data) {
        const map = {};
        res.data.forEach((r) => { map[r.key] = r.value; });
        settings = Object.assign({ ...SETTINGS_DEFAULTS }, map);
      }
    } catch (e) { /* 테이블 미생성 등 — 기본값 유지 */ }
    applyBrandChrome();
  }

  // 관리자 화면(로그인/상단바/탭 타이틀/파비콘)에 브랜드 반영
  function applyBrandChrome() {
    const name = (settings.brand_name || '맑음').trim() || '맑음';
    const logo = (settings.logo_url || '').trim();

    $$('.login__name, .topbar__name').forEach((el) => { el.textContent = name; });
    document.title = `${name} · 관리자`;

    // 로그인 카드 로고
    swapBrandDot($('.login__brand'), '.login__dot', 'login__logo', logo, name);
    // 상단바 로고
    swapBrandDot($('.topbar__brand'), '.topbar__dot', 'topbar__logo', logo, name);

    if (logo) setFavicon(logo);
  }

  function swapBrandDot(host, dotSel, imgClass, logo, alt) {
    if (!host) return;
    const dot = host.querySelector(dotSel);
    let img = host.querySelector('.' + imgClass);
    if (logo) {
      if (!img) {
        img = document.createElement('img');
        img.className = imgClass;
        host.insertBefore(img, host.firstChild);
      }
      img.src = logo; img.alt = alt || 'logo';
      if (dot) dot.style.display = 'none';
    } else {
      if (img) img.remove();
      if (dot) dot.style.display = '';
    }
  }

  function setFavicon(href) {
    let link = document.querySelector('link[rel="icon"]');
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    link.href = href;
  }

  // 설정 폼 채우기 + 미리보기
  function renderSettings() {
    const nameI = $('#set-brand-name');
    const subI = $('#set-brand-sub');
    if (!nameI || !subI) return;
    nameI.value = settings.brand_name || '';
    subI.value = settings.brand_sub || '';
    pendingLogo = settings.logo_url || '';
    updateSettingsPreview();

    // 사업자 정보 폼
    const bizName = $('#set-biz-name');
    if (bizName) {
      bizName.value = settings.biz_name || '';
      $('#set-biz-ceo').value = settings.biz_ceo || '';
      $('#set-biz-reg').value = settings.biz_reg_no || '';
    }
  }

  function updateSettingsPreview() {
    const name = ($('#set-brand-name').value || '맑음').trim() || '맑음';
    const sub = $('#set-brand-sub').value.trim();
    $('#brand-preview-name').textContent = name;
    $('#brand-preview-sub').textContent = sub;

    const logoImg = $('#brand-preview-logo');
    const dot = $('#brand-preview-dot');
    if (pendingLogo) {
      logoImg.src = pendingLogo; logoImg.hidden = false; dot.hidden = true;
    } else {
      logoImg.hidden = true; dot.hidden = false;
    }

    // 로고 업로드 박스 미리보기
    const box = $('#logo-preview');
    box.innerHTML = pendingLogo
      ? `<img src="${esc(pendingLogo)}" alt="로고 미리보기">`
      : '<span class="logo-preview__empty">로고 없음</span>';
  }

  // 이미지 파일 → 리사이즈된 PNG data URL (투명 배경 유지)
  function fileToLogoDataURL(file, maxDim = 256) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('파일을 읽을 수 없습니다.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('이미지를 불러올 수 없습니다.'));
        img.onload = () => {
          let { width, height } = img;
          const scale = Math.min(1, maxDim / Math.max(width, height));
          width = Math.round(width * scale);
          height = Math.round(height * scale);
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/png'));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleLogoFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const errEl = $('#set-error');
    errEl.hidden = true;
    if (!/^image\//.test(file.type)) { errEl.textContent = '이미지 파일만 선택하세요.'; errEl.hidden = false; return; }
    try {
      pendingLogo = await fileToLogoDataURL(file);
      updateSettingsPreview();
    } catch (err) {
      errEl.textContent = err.message || '이미지 처리 중 오류가 발생했습니다.';
      errEl.hidden = false;
    }
    e.target.value = ''; // 같은 파일 재선택 허용
  }

  async function saveSettings() {
    const btn = $('#set-save');
    const savedEl = $('#set-saved');
    const errEl = $('#set-error');
    savedEl.hidden = true; errEl.hidden = true;
    btn.disabled = true; btn.textContent = '저장 중…';

    const rows = [
      { key: 'brand_name', value: ($('#set-brand-name').value || '').trim() },
      { key: 'brand_sub', value: ($('#set-brand-sub').value || '').trim() },
      { key: 'logo_url', value: pendingLogo || '' }
    ].map((r) => ({ ...r, updated_at: new Date().toISOString() }));

    const { error } = await client.from('site_settings').upsert(rows, { onConflict: 'key' });
    btn.disabled = false; btn.textContent = '저장';
    if (error) {
      errEl.textContent = '저장 실패: ' + error.message;
      errEl.hidden = false;
      return;
    }
    // 로컬 상태 반영
    rows.forEach((r) => { settings[r.key] = r.value; });
    applyBrandChrome();
    savedEl.hidden = false;
    setTimeout(() => { savedEl.hidden = true; }, 1800);
  }

  async function saveBizInfo() {
    const btn = $('#set-biz-save');
    const savedEl = $('#set-biz-saved');
    const errEl = $('#set-biz-error');
    savedEl.hidden = true; errEl.hidden = true;
    btn.disabled = true; btn.textContent = '저장 중…';

    const rows = [
      { key: 'biz_name', value: ($('#set-biz-name').value || '').trim() },
      { key: 'biz_ceo', value: ($('#set-biz-ceo').value || '').trim() },
      { key: 'biz_reg_no', value: ($('#set-biz-reg').value || '').trim() }
    ].map((r) => ({ ...r, updated_at: new Date().toISOString() }));

    const { error } = await client.from('site_settings').upsert(rows, { onConflict: 'key' });
    btn.disabled = false; btn.textContent = '저장';
    if (error) {
      errEl.textContent = '저장 실패: ' + error.message;
      errEl.hidden = false;
      return;
    }
    rows.forEach((r) => { settings[r.key] = r.value; });
    savedEl.hidden = false;
    setTimeout(() => { savedEl.hidden = true; }, 1800);
  }

  // =========================================================
  //  CSV 내보내기
  // =========================================================
  function exportCSV() {
    const rows = filteredConsults();
    if (!rows.length) { alert('내보낼 데이터가 없습니다.'); return; }
    const cols = [
      ['created_at', '접수일'], ['name', '이름'], ['phone', '연락처'],
      ['size', '평형'], ['address', '지역'], ['desired_date', '입주예정'], ['status', '상태'],
      ['assigned_to', '담당자'], ['utm_source', '유입경로'], ['utm_medium', '매체'],
      ['notes', '메모']
    ];
    const head = cols.map((c) => c[1]).join(',');
    const body = rows.map((r) => cols.map(([key]) => {
      let v = r[key] == null ? '' : String(r[key]);
      if (key === 'status') v = (STATUS[v] || { label: v }).label;
      return '"' + v.replace(/"/g, '""') + '"';
    }).join(',')).join('\n');
    const blob = new Blob(['﻿' + head + '\n' + body], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `상담문의_${dayKey(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // =========================================================
  //  탭 전환 & 이벤트 바인딩
  // =========================================================
  function switchTab(name) {
    $$('.tab').forEach((t) => t.classList.toggle('is-active', t.dataset.tab === name));
    $$('.panel').forEach((p) => { p.hidden = p.dataset.panel !== name; });
    requestAnimationFrame(resizeAllCharts);
  }

  function bindEvents() {
    $('#login-form').addEventListener('submit', handleLogin);
    $('#logout-btn').addEventListener('click', handleLogout);
    $('#refresh-btn').addEventListener('click', async () => {
      $('#refresh-btn').disabled = true;
      await loadData(); renderAll();
      $('#refresh-btn').disabled = false;
    });
    $$('.tab').forEach((t) => t.addEventListener('click', () => switchTab(t.dataset.tab)));
    $$('[data-goto]').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.goto)));
    $('#consult-search').addEventListener('input', (e) => { searchTerm = e.target.value; renderConsultTable(); });
    $('#export-btn').addEventListener('click', exportCSV);
    // 설정 탭
    $('#set-brand-name').addEventListener('input', updateSettingsPreview);
    $('#set-brand-sub').addEventListener('input', updateSettingsPreview);
    $('#set-logo-file').addEventListener('change', handleLogoFile);
    $('#set-logo-clear').addEventListener('click', () => { pendingLogo = ''; updateSettingsPreview(); });
    $('#set-save').addEventListener('click', saveSettings);
    $('#set-biz-save').addEventListener('click', saveBizInfo);
    $('#drawer-backdrop').addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
  }

  // ---------- 시작 ----------
  bindEvents();
  boot();
})();
