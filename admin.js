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
    biz_name: '(주)맑음 에어케어', biz_ceo: '000', biz_reg_no: '000-00-00000',
    contact_phone: '1600-0000', contact_hours: '평일 09:00 – 19:00', kakao_url: ''
  };
  let settings = { ...SETTINGS_DEFAULTS };
  let pendingLogo = ''; // 설정 폼에서 편집 중인 로고(data URL)
  let reviews = [];
  let editingReviewId = null;   // null = 새 리뷰 작성
  let pendingReviewPhoto = '';  // 리뷰 편집 중인 사진(data URL)

  // 콘텐츠(시공 과정/현장) 기본값 — 공개 페이지 초기 HTML과 동일
  const PROCESS_DEFAULTS = [
    { title: '방문 정밀 측정', desc: '공인 측정기로 실내 공기질을 진단하고 오염 원인을 파악합니다.' },
    { title: '이중 시공', desc: '광촉매 코팅과 고온 베이크아웃으로 유해물질을 분해·배출합니다.' },
    { title: '재측정 & 인증', desc: '시공 후 수치를 다시 측정하고 결과 리포트를 발급해 드립니다.' },
    { title: '12개월 A/S', desc: '시공 후에도 재점검과 사후 관리로 깨끗한 공기를 유지합니다.' }
  ];
  const CASE_DEFAULTS = [
    { title: '01 · 방문 정밀 측정', sub: '공인 측정기로 실내 오염도를 진단합니다.', photo: '' },
    { title: '02 · 이중 시공', sub: '광촉매 코팅 + 고온 베이크아웃 진행.', photo: '' },
    { title: '03 · 재측정 완료', sub: '시공 후 수치를 재측정해 리포트를 발급합니다.', photo: '' }
  ];
  let pendingCasePhotos = ['', '', ''];  // 케이스 편집 중 사진(data URL)

  const HERO_DEFAULTS = {
    pill: '새집증후군 · 리모델링 유해물질 전문 시공',
    titleLead: '새집의 설렘은 그대로,',
    phrases: ['유해물질은 0으로', '포름알데히드는 0으로', 'VOCs는 0으로', '새집 냄새는 0으로'],
    desc: '입주 전 단 하루. 건축자재에서 나오는 포름알데히드와 VOCs를 안전 기준 이하로. 아이도 반려동물도 안심하고 첫 숨을 쉬는 집을 만들어 드립니다.',
    btnPrimary: '무료 방문 측정 신청 →',
    btnSecondary: '시공과정 보기',
    bg: ''
  };
  const PRICING_DEFAULTS = {
    heading: { title: '평형에 맞는 합리적인 견적', desc: '방문 측정 후 정확한 견적을 안내드립니다. 아래는 기준 예상가입니다.' },
    plans: [
      { name: '소형 · 원룸', size: '~ 20평', price: '18', priceUnit: '만원 ~', feats: ['✓ 방문 정밀 측정', '✓ 광촉매 + 베이크아웃', '✓ 시공 후 재측정 1회', '✓ A/S 12개월'], cta: '견적 문의' },
      { name: '중형 · 아파트', size: '20 ~ 34평', price: '32', priceUnit: '만원 ~', feats: ['✓ 소형 패키지 전체 포함', '✓ 시공 후 재측정 2회', '✓ 결과 리포트 발급', '✓ 공기청정 마감 코팅'], cta: '무료 측정 신청' },
      { name: '대형 · 주택', size: '34평 ~ / 상업공간', price: '별도', priceUnit: ' 견적', feats: ['✓ 중형 패키지 전체 포함', '✓ 층별·구역별 맞춤 시공', '✓ 대면 결과 브리핑', '✓ 정기 관리 옵션'], cta: '상담 문의' }
    ]
  };
  let pendingHeroBg = '';  // 히어로 배경 편집 중(data URL)

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

    // 리뷰 (테이블 미생성 시에도 대시보드가 깨지지 않도록 개별 try/catch)
    try {
      const rRes = await client.from('reviews').select('*').order('created_at', { ascending: false });
      reviews = rRes.error ? [] : (rRes.data || []);
    } catch (e) { reviews = []; }
  }

  // =========================================================
  //  렌더 - 전체
  // =========================================================
  function renderAll() {
    renderDashboard();
    renderConsultTab();
    renderTrafficTab();
    renderReviewList();
    renderContent();
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

    // 상담 문의 폼
    const cPhone = $('#set-contact-phone');
    if (cPhone) {
      cPhone.value = settings.contact_phone || '';
      $('#set-contact-hours').value = settings.contact_hours || '';
      $('#set-kakao-url').value = settings.kakao_url || '';
    }

    // 후기 평점·개수 폼
    const rScore = $('#set-rating-score');
    if (rScore) {
      rScore.value = settings.rating_score || '';
      $('#set-review-count').value = settings.review_count || '';
      $('#set-hero-review-count').value = settings.hero_review_count || '';
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

  // 이미지 파일 → 리사이즈된 data URL
  //  · 로고: PNG(투명 배경 유지) / 리뷰 사진: JPEG(용량 절감)
  function fileToLogoDataURL(file, maxDim = 256, mime = 'image/png', quality = 0.9) {
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
          const ctx = canvas.getContext('2d');
          if (mime === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height); }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL(mime, quality));
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

  async function saveContactInfo() {
    const btn = $('#set-contact-save');
    const savedEl = $('#set-contact-saved');
    const errEl = $('#set-contact-error');
    savedEl.hidden = true; errEl.hidden = true;

    const kakao = ($('#set-kakao-url').value || '').trim();
    if (kakao && !/^https?:\/\//i.test(kakao)) {
      errEl.textContent = '카카오 URL은 http:// 또는 https:// 로 시작해야 합니다.';
      errEl.hidden = false;
      return;
    }

    btn.disabled = true; btn.textContent = '저장 중…';
    const rows = [
      { key: 'contact_phone', value: ($('#set-contact-phone').value || '').trim() },
      { key: 'contact_hours', value: ($('#set-contact-hours').value || '').trim() },
      { key: 'kakao_url', value: kakao }
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

  async function saveRating() {
    const btn = $('#set-rating-save');
    const savedEl = $('#set-rating-saved');
    const errEl = $('#set-rating-error');
    savedEl.hidden = true; errEl.hidden = true;
    btn.disabled = true; btn.textContent = '저장 중…';

    const rows = [
      { key: 'rating_score', value: ($('#set-rating-score').value || '').trim() },
      { key: 'review_count', value: ($('#set-review-count').value || '').trim() },
      { key: 'hero_review_count', value: ($('#set-hero-review-count').value || '').trim() }
    ].map((r) => ({ ...r, updated_at: new Date().toISOString() }));

    const { error } = await client.from('site_settings').upsert(rows, { onConflict: 'key' });
    btn.disabled = false; btn.textContent = '저장';
    if (error) { errEl.textContent = '저장 실패: ' + error.message; errEl.hidden = false; return; }
    rows.forEach((r) => { settings[r.key] = r.value; });
    savedEl.hidden = false;
    setTimeout(() => { savedEl.hidden = true; }, 1800);
  }

  // =========================================================
  //  콘텐츠 관리 (시공 과정 PROCESS / 시공 현장 CASE)
  // =========================================================
  function getProcess() {
    let arr = null;
    try { const v = JSON.parse(settings.process_json || 'null'); if (Array.isArray(v)) arr = v; } catch (e) { /* noop */ }
    return PROCESS_DEFAULTS.map((d, i) => ({
      title: (arr && arr[i] && arr[i].title) || d.title,
      desc: (arr && arr[i] && arr[i].desc) || d.desc
    }));
  }
  function getCases() {
    let arr = null;
    try { const v = JSON.parse(settings.cases_json || 'null'); if (Array.isArray(v)) arr = v; } catch (e) { /* noop */ }
    return CASE_DEFAULTS.map((d, i) => ({
      title: (arr && arr[i] && arr[i].title) || d.title,
      sub: (arr && arr[i] && arr[i].sub) || d.sub,
      photo: (arr && arr[i] && arr[i].photo) || ''
    }));
  }

  function renderContent() {
    renderHeroFields();
    renderProcessFields();
    renderCaseFields();
    renderPricingFields();
  }

  function renderProcessFields() {
    const host = $('#process-fields');
    if (!host) return;
    const steps = getProcess();
    host.innerHTML = steps.map((s, i) => `
      <div class="content-item">
        <div class="content-item__label">STEP 0${i + 1}</div>
        <div class="set-field">
          <label for="proc-title-${i}">제목</label>
          <input id="proc-title-${i}" class="set-input" maxlength="40" value="${esc(s.title)}">
        </div>
        <div class="set-field">
          <label for="proc-desc-${i}">설명</label>
          <textarea id="proc-desc-${i}" class="set-input rv-textarea" maxlength="200" rows="2">${esc(s.desc)}</textarea>
        </div>
      </div>`).join('');
  }

  function renderCaseFields() {
    const host = $('#cases-fields');
    if (!host) return;
    const cases = getCases();
    pendingCasePhotos = cases.map((c) => c.photo || '');
    host.innerHTML = cases.map((c, i) => `
      <div class="content-item">
        <div class="content-item__label">CASE 0${i + 1}</div>
        <div class="set-field">
          <label>사진 <span class="set-hint">선택 · 자동 리사이즈</span></label>
          <div class="logo-uploader">
            <div class="logo-preview logo-preview--wide" id="case-preview-${i}"></div>
            <div class="logo-actions">
              <label class="btn-file">이미지 선택
                <input type="file" id="case-file-${i}" accept="image/*" hidden>
              </label>
              <button type="button" class="btn-ghost" id="case-clear-${i}">제거</button>
            </div>
          </div>
        </div>
        <div class="set-field">
          <label for="case-title-${i}">제목</label>
          <input id="case-title-${i}" class="set-input" maxlength="40" value="${esc(c.title)}">
        </div>
        <div class="set-field">
          <label for="case-sub-${i}">설명</label>
          <input id="case-sub-${i}" class="set-input" maxlength="80" value="${esc(c.sub)}">
        </div>
      </div>`).join('');

    // 미리보기 + 이벤트 바인딩 (동적 생성이라 매 렌더마다 연결)
    cases.forEach((c, i) => {
      renderCasePreview(i);
      $('#case-file-' + i).addEventListener('change', (e) => handleCasePhoto(i, e));
      $('#case-clear-' + i).addEventListener('click', () => { pendingCasePhotos[i] = ''; renderCasePreview(i); });
    });
  }

  function renderCasePreview(i) {
    const box = $('#case-preview-' + i);
    if (!box) return;
    box.innerHTML = pendingCasePhotos[i]
      ? `<img src="${esc(pendingCasePhotos[i])}" alt="사진 미리보기">`
      : '<span class="logo-preview__empty">사진 없음</span>';
  }

  async function handleCasePhoto(i, e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const errEl = $('#cases-error');
    errEl.hidden = true;
    if (!/^image\//.test(file.type)) { errEl.textContent = '이미지 파일만 선택하세요.'; errEl.hidden = false; return; }
    try {
      pendingCasePhotos[i] = await fileToLogoDataURL(file, 800, 'image/jpeg', 0.8);
      renderCasePreview(i);
    } catch (err) {
      errEl.textContent = err.message || '이미지 처리 중 오류가 발생했습니다.';
      errEl.hidden = false;
    }
    e.target.value = '';
  }

  async function saveProcess() {
    const btn = $('#process-save');
    const savedEl = $('#process-saved');
    const errEl = $('#process-error');
    savedEl.hidden = true; errEl.hidden = true;
    btn.disabled = true; btn.textContent = '저장 중…';

    const steps = PROCESS_DEFAULTS.map((_, i) => ({
      title: ($('#proc-title-' + i).value || '').trim(),
      desc: ($('#proc-desc-' + i).value || '').trim()
    }));
    const value = JSON.stringify(steps);
    const { error } = await client.from('site_settings')
      .upsert([{ key: 'process_json', value, updated_at: new Date().toISOString() }], { onConflict: 'key' });
    btn.disabled = false; btn.textContent = '저장';
    if (error) { errEl.textContent = '저장 실패: ' + error.message; errEl.hidden = false; return; }
    settings.process_json = value;
    savedEl.hidden = false;
    setTimeout(() => { savedEl.hidden = true; }, 1800);
  }

  async function saveCases() {
    const btn = $('#cases-save');
    const savedEl = $('#cases-saved');
    const errEl = $('#cases-error');
    savedEl.hidden = true; errEl.hidden = true;
    btn.disabled = true; btn.textContent = '저장 중…';

    const cases = CASE_DEFAULTS.map((_, i) => ({
      title: ($('#case-title-' + i).value || '').trim(),
      sub: ($('#case-sub-' + i).value || '').trim(),
      photo: pendingCasePhotos[i] || ''
    }));
    const value = JSON.stringify(cases);
    const { error } = await client.from('site_settings')
      .upsert([{ key: 'cases_json', value, updated_at: new Date().toISOString() }], { onConflict: 'key' });
    btn.disabled = false; btn.textContent = '저장';
    if (error) { errEl.textContent = '저장 실패: ' + error.message; errEl.hidden = false; return; }
    settings.cases_json = value;
    savedEl.hidden = false;
    setTimeout(() => { savedEl.hidden = true; }, 1800);
  }

  // ---------- 메인(히어로) ----------
  function getHero() {
    let o = null;
    try { const v = JSON.parse(settings.hero_json || 'null'); if (v && typeof v === 'object' && !Array.isArray(v)) o = v; } catch (e) { /* noop */ }
    o = o || {};
    return {
      pill: o.pill != null ? o.pill : HERO_DEFAULTS.pill,
      titleLead: o.titleLead != null ? o.titleLead : HERO_DEFAULTS.titleLead,
      phrases: (Array.isArray(o.phrases) && o.phrases.length) ? o.phrases : HERO_DEFAULTS.phrases,
      desc: o.desc != null ? o.desc : HERO_DEFAULTS.desc,
      btnPrimary: o.btnPrimary != null ? o.btnPrimary : HERO_DEFAULTS.btnPrimary,
      btnSecondary: o.btnSecondary != null ? o.btnSecondary : HERO_DEFAULTS.btnSecondary,
      bg: o.bg || ''
    };
  }

  function renderHeroFields() {
    if (!$('#hero-pill')) return;
    const h = getHero();
    $('#hero-pill').value = h.pill || '';
    $('#hero-title-lead').value = h.titleLead || '';
    $('#hero-phrases').value = (h.phrases || []).join('\n');
    $('#hero-desc').value = h.desc || '';
    $('#hero-btn-primary').value = h.btnPrimary || '';
    $('#hero-btn-secondary').value = h.btnSecondary || '';
    pendingHeroBg = h.bg || '';
    renderHeroBgPreview();
  }

  function renderHeroBgPreview() {
    const box = $('#hero-bg-preview');
    if (!box) return;
    box.innerHTML = pendingHeroBg
      ? `<img src="${esc(pendingHeroBg)}" alt="배경 미리보기">`
      : '<span class="logo-preview__empty">이미지 없음</span>';
  }

  async function handleHeroBg(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const errEl = $('#hero-error');
    errEl.hidden = true;
    if (!/^image\//.test(file.type)) { errEl.textContent = '이미지 파일만 선택하세요.'; errEl.hidden = false; return; }
    try {
      pendingHeroBg = await fileToLogoDataURL(file, 1200, 'image/jpeg', 0.8);
      renderHeroBgPreview();
    } catch (err) {
      errEl.textContent = err.message || '이미지 처리 중 오류가 발생했습니다.';
      errEl.hidden = false;
    }
    e.target.value = '';
  }

  async function saveHero() {
    const btn = $('#hero-save');
    const savedEl = $('#hero-saved');
    const errEl = $('#hero-error');
    savedEl.hidden = true; errEl.hidden = true;
    btn.disabled = true; btn.textContent = '저장 중…';

    const phrases = ($('#hero-phrases').value || '').split('\n').map((s) => s.trim()).filter(Boolean);
    const hero = {
      pill: ($('#hero-pill').value || '').trim(),
      titleLead: ($('#hero-title-lead').value || '').trim(),
      phrases,
      desc: ($('#hero-desc').value || '').trim(),
      btnPrimary: ($('#hero-btn-primary').value || '').trim(),
      btnSecondary: ($('#hero-btn-secondary').value || '').trim(),
      bg: pendingHeroBg || ''
    };
    const value = JSON.stringify(hero);
    const { error } = await client.from('site_settings')
      .upsert([{ key: 'hero_json', value, updated_at: new Date().toISOString() }], { onConflict: 'key' });
    btn.disabled = false; btn.textContent = '저장';
    if (error) { errEl.textContent = '저장 실패: ' + error.message; errEl.hidden = false; return; }
    settings.hero_json = value;
    savedEl.hidden = false;
    setTimeout(() => { savedEl.hidden = true; }, 1800);
  }

  // ---------- 요금 안내(PRICING) ----------
  function getPricing() {
    let o = null;
    try { const v = JSON.parse(settings.pricing_json || 'null'); if (v && typeof v === 'object' && !Array.isArray(v)) o = v; } catch (e) { /* noop */ }
    o = o || {};
    const heading = o.heading || {};
    const plans = PRICING_DEFAULTS.plans.map((d, i) => {
      const s = (Array.isArray(o.plans) && o.plans[i]) ? o.plans[i] : {};
      return {
        name: s.name != null ? s.name : d.name,
        size: s.size != null ? s.size : d.size,
        price: s.price != null ? s.price : d.price,
        priceUnit: s.priceUnit != null ? s.priceUnit : d.priceUnit,
        feats: (Array.isArray(s.feats) && s.feats.length) ? s.feats : d.feats,
        cta: s.cta != null ? s.cta : d.cta
      };
    });
    return {
      heading: {
        title: heading.title != null ? heading.title : PRICING_DEFAULTS.heading.title,
        desc: heading.desc != null ? heading.desc : PRICING_DEFAULTS.heading.desc
      },
      plans
    };
  }

  function renderPricingFields() {
    const host = $('#pricing-fields');
    if (!host) return;
    const p = getPricing();
    $('#price-title').value = p.heading.title || '';
    $('#price-desc').value = p.heading.desc || '';
    host.innerHTML = p.plans.map((pl, i) => `
      <div class="content-item">
        <div class="content-item__label">PLAN 0${i + 1}</div>
        <div class="rv-grid">
          <div class="set-field">
            <label for="plan-name-${i}">이름</label>
            <input id="plan-name-${i}" class="set-input" maxlength="30" value="${esc(pl.name)}">
          </div>
          <div class="set-field">
            <label for="plan-size-${i}">평형</label>
            <input id="plan-size-${i}" class="set-input" maxlength="30" value="${esc(pl.size)}">
          </div>
          <div class="set-field">
            <label for="plan-price-${i}">가격</label>
            <input id="plan-price-${i}" class="set-input" maxlength="20" value="${esc(pl.price)}">
          </div>
          <div class="set-field">
            <label for="plan-unit-${i}">가격 단위</label>
            <input id="plan-unit-${i}" class="set-input" maxlength="20" value="${esc(pl.priceUnit || '')}">
          </div>
        </div>
        <div class="set-field">
          <label for="plan-feats-${i}">혜택 <span class="set-hint">한 줄에 하나씩</span></label>
          <textarea id="plan-feats-${i}" class="set-input rv-textarea" rows="4">${esc((pl.feats || []).join('\n'))}</textarea>
        </div>
        <div class="set-field">
          <label for="plan-cta-${i}">버튼 문구</label>
          <input id="plan-cta-${i}" class="set-input" maxlength="20" value="${esc(pl.cta)}">
        </div>
      </div>`).join('');
  }

  async function savePricing() {
    const btn = $('#pricing-save');
    const savedEl = $('#pricing-saved');
    const errEl = $('#pricing-error');
    savedEl.hidden = true; errEl.hidden = true;
    btn.disabled = true; btn.textContent = '저장 중…';

    const plans = PRICING_DEFAULTS.plans.map((_, i) => ({
      name: ($('#plan-name-' + i).value || '').trim(),
      size: ($('#plan-size-' + i).value || '').trim(),
      price: ($('#plan-price-' + i).value || '').trim(),
      priceUnit: ($('#plan-unit-' + i).value || '').trim(),
      feats: ($('#plan-feats-' + i).value || '').split('\n').map((s) => s.trim()).filter(Boolean),
      cta: ($('#plan-cta-' + i).value || '').trim()
    }));
    const pricing = {
      heading: {
        title: ($('#price-title').value || '').trim(),
        desc: ($('#price-desc').value || '').trim()
      },
      plans
    };
    const value = JSON.stringify(pricing);
    const { error } = await client.from('site_settings')
      .upsert([{ key: 'pricing_json', value, updated_at: new Date().toISOString() }], { onConflict: 'key' });
    btn.disabled = false; btn.textContent = '저장';
    if (error) { errEl.textContent = '저장 실패: ' + error.message; errEl.hidden = false; return; }
    settings.pricing_json = value;
    savedEl.hidden = false;
    setTimeout(() => { savedEl.hidden = true; }, 1800);
  }

  // =========================================================
  //  리뷰 관리 (작성 / 수정 / 삭제 / 게시토글)
  // =========================================================
  function starStr(n) {
    const k = Math.max(0, Math.min(5, parseInt(n, 10) || 5));
    return '★'.repeat(k) + '☆'.repeat(5 - k);
  }

  function renderReviewList() {
    const host = $('#review-list');
    if (!host) return;
    const countEl = $('#review-count');
    const emptyEl = $('#review-empty');
    if (countEl) countEl.textContent = reviews.length ? `${reviews.length}개` : '';
    if (emptyEl) emptyEl.hidden = reviews.length > 0;

    host.innerHTML = reviews.map((r) => {
      const pub = r.is_published;
      const thumb = r.photo_url
        ? `<div class="rv-item__thumb" style="background-image:url('${esc(r.photo_url)}')"></div>`
        : `<div class="rv-item__thumb">${esc((r.name || '·').trim().charAt(0) || '·')}</div>`;
      return `
        <div class="rv-item ${pub ? '' : 'is-hidden'}" data-id="${esc(r.id)}">
          ${thumb}
          <div class="rv-item__main">
            <div class="rv-item__top">
              <span class="rv-item__name">${esc(r.name)}</span>
              <span class="rv-item__stars">${starStr(r.rating)}</span>
              ${r.tag ? `<span class="rv-tagchip">#${esc(r.tag)}</span>` : ''}
              <span class="rv-badge ${pub ? 'rv-badge--on' : 'rv-badge--off'}">${pub ? '게시' : '숨김'}</span>
            </div>
            <div class="rv-item__meta">${esc([r.meta, r.review_date].filter(Boolean).join(' · '))}</div>
            <p class="rv-item__body">${esc(r.body)}</p>
          </div>
          <div class="rv-item__actions">
            <button class="btn-mini" data-act="edit">수정</button>
            <button class="btn-mini" data-act="toggle">${pub ? '숨김' : '게시'}</button>
            <button class="btn-mini btn-mini--danger" data-act="delete">삭제</button>
          </div>
        </div>`;
    }).join('');

    $$('#review-list .rv-item').forEach((row) => {
      const id = row.dataset.id;
      row.querySelector('[data-act="edit"]').addEventListener('click', () => openReviewEditor(id));
      row.querySelector('[data-act="toggle"]').addEventListener('click', () => toggleReviewPublished(id));
      row.querySelector('[data-act="delete"]').addEventListener('click', () => deleteReview(id));
    });
  }

  async function reloadReviews() {
    try {
      const r = await client.from('reviews').select('*').order('created_at', { ascending: false });
      if (!r.error) reviews = r.data || [];
    } catch (e) { /* noop */ }
  }

  function openReviewEditor(id) {
    editingReviewId = (id == null ? null : id);
    const r = id == null ? null : reviews.find((x) => String(x.id) === String(id));
    $('#review-editor-title').textContent = r ? '리뷰 수정' : '새 리뷰';
    $('#rv-name').value = r ? (r.name || '') : '';
    $('#rv-tag').value = r ? (r.tag || '') : '';
    $('#rv-meta').value = r ? (r.meta || '') : '';
    $('#rv-date').value = r ? (r.review_date || '') : '';
    $('#rv-rating').value = String(r ? (r.rating || 5) : 5);
    $('#rv-published').value = (r ? r.is_published : true) ? '1' : '0';
    $('#rv-body').value = r ? (r.body || '') : '';
    pendingReviewPhoto = r ? (r.photo_url || '') : '';
    updateReviewPhotoPreview();
    $('#rv-error').hidden = true;
    $('#rv-saved').hidden = true;
    $('#review-editor').hidden = false;
    $('#review-editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function closeReviewEditor() {
    $('#review-editor').hidden = true;
    editingReviewId = null;
    pendingReviewPhoto = '';
  }

  function updateReviewPhotoPreview() {
    const box = $('#rv-photo-preview');
    if (!box) return;
    box.innerHTML = pendingReviewPhoto
      ? `<img src="${esc(pendingReviewPhoto)}" alt="사진 미리보기">`
      : '<span class="logo-preview__empty">사진 없음</span>';
  }

  async function handleReviewPhoto(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const errEl = $('#rv-error');
    errEl.hidden = true;
    if (!/^image\//.test(file.type)) { errEl.textContent = '이미지 파일만 선택하세요.'; errEl.hidden = false; return; }
    try {
      pendingReviewPhoto = await fileToLogoDataURL(file, 640, 'image/jpeg', 0.82);
      updateReviewPhotoPreview();
    } catch (err) {
      errEl.textContent = err.message || '이미지 처리 중 오류가 발생했습니다.';
      errEl.hidden = false;
    }
    e.target.value = '';
  }

  async function saveReview() {
    const btn = $('#rv-save');
    const savedEl = $('#rv-saved');
    const errEl = $('#rv-error');
    savedEl.hidden = true; errEl.hidden = true;

    const name = ($('#rv-name').value || '').trim();
    const body = ($('#rv-body').value || '').trim();
    if (!name) { errEl.textContent = '이름을 입력하세요.'; errEl.hidden = false; return; }
    if (!body) { errEl.textContent = '후기 내용을 입력하세요.'; errEl.hidden = false; return; }

    btn.disabled = true; btn.textContent = '저장 중…';
    const row = {
      name,
      meta: ($('#rv-meta').value || '').trim() || null,
      tag: ($('#rv-tag').value || '').trim() || null,
      rating: parseInt($('#rv-rating').value, 10) || 5,
      review_date: ($('#rv-date').value || '').trim() || null,
      body,
      photo_url: pendingReviewPhoto || null,
      is_published: $('#rv-published').value === '1'
    };

    let error;
    if (editingReviewId == null) {
      ({ error } = await client.from('reviews').insert([row]));
    } else {
      ({ error } = await client.from('reviews').update(row).eq('id', editingReviewId));
    }
    btn.disabled = false; btn.textContent = '저장';
    if (error) { errEl.textContent = '저장 실패: ' + error.message; errEl.hidden = false; return; }

    await reloadReviews();
    renderReviewList();
    savedEl.hidden = false;
    setTimeout(() => { savedEl.hidden = true; closeReviewEditor(); }, 900);
  }

  async function deleteReview(id) {
    if (!window.confirm('이 리뷰를 삭제할까요? 되돌릴 수 없습니다.')) return;
    const { error } = await client.from('reviews').delete().eq('id', id);
    if (error) { alert('삭제 실패: ' + error.message); return; }
    await reloadReviews();
    renderReviewList();
    if (String(editingReviewId) === String(id)) closeReviewEditor();
  }

  async function toggleReviewPublished(id) {
    const r = reviews.find((x) => String(x.id) === String(id));
    if (!r) return;
    const { error } = await client.from('reviews').update({ is_published: !r.is_published }).eq('id', id);
    if (error) { alert('변경 실패: ' + error.message); return; }
    await reloadReviews();
    renderReviewList();
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
    $('#set-contact-save').addEventListener('click', saveContactInfo);
    $('#set-rating-save').addEventListener('click', saveRating);
    // 콘텐츠 관리
    $('#hero-save').addEventListener('click', saveHero);
    $('#hero-bg-file').addEventListener('change', handleHeroBg);
    $('#hero-bg-clear').addEventListener('click', () => { pendingHeroBg = ''; renderHeroBgPreview(); });
    $('#process-save').addEventListener('click', saveProcess);
    $('#cases-save').addEventListener('click', saveCases);
    $('#pricing-save').addEventListener('click', savePricing);
    // 리뷰 관리
    $('#review-new').addEventListener('click', () => openReviewEditor(null));
    $('#rv-save').addEventListener('click', saveReview);
    $('#rv-cancel').addEventListener('click', closeReviewEditor);
    $('#rv-photo-file').addEventListener('change', handleReviewPhoto);
    $('#rv-photo-clear').addEventListener('click', () => { pendingReviewPhoto = ''; updateReviewPhotoPreview(); });
    $('#drawer-backdrop').addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
  }

  // ---------- 시작 ----------
  bindEvents();
  boot();
})();
