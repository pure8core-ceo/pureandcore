/* =========================================================
   맑음 air care — 랜딩 인터랙션
   원본 Claude Design mockup의 renderVals() 로직을 그대로 옮김:
   후기 필터링 · FAQ 아코디언 · 문의 폼 제출 상태
   ========================================================= */
(function () {
  'use strict';

  /* ---------- 데이터: 후기 ---------- */
  const REVIEWS = [
    { name: '김O은', avatar: '김', meta: '34평 · 서울 마포 · 신축 아파트', tag: '신축', date: '2026.06', text: '입주 전 측정에서 포름알데히드가 기준의 3배였는데, 시공 후 재측정 리포트를 직접 보여주셔서 믿음이 갔어요. 새 가구 냄새가 확 줄었습니다.', photo: 'assets/review-1.png' },
    { name: '박O호', avatar: '박', meta: '24평 · 경기 성남 · 리모델링', tag: '리모델링', date: '2026.06', text: '리모델링 후 페인트 냄새가 너무 심했는데 베이크아웃 하루 만에 코가 편해졌어요. 아이가 재채기하던 게 사라진 게 제일 좋습니다.', photo: false },
    { name: '이O진', avatar: '이', meta: '32평 · 인천 송도 · 아파트', tag: '아파트', date: '2026.05', text: '측정부터 시공, 재측정까지 과정 하나하나 설명해주셔서 안심됐어요. 감으로 하는 게 아니라 데이터로 보여주니 확실히 신뢰가 갑니다.', photo: 'assets/review-2.png' },
    { name: '최O아', avatar: '최', meta: '18평 · 서울 강서 · 신혼집', tag: '신축', date: '2026.05', text: '신혼집이라 더 신경 쓰였는데 친환경 자재만 쓰신다고 해서 선택했어요. 시공 다음 날 바로 입주했는데 냄새가 거의 안 났습니다.', photo: false },
    { name: '정O석', avatar: '정', meta: '45평 · 서울 송파 · 아파트', tag: '아파트', date: '2026.04', text: '넓은 평수라 걱정했는데 구역별로 꼼꼼히 시공해주셨어요. 결과 브리핑까지 대면으로 해주셔서 만족도가 높습니다. 추천해요.', photo: false },
    { name: '한O림', avatar: '한', meta: '오피스 60평 · 서울 강남', tag: '오피스', date: '2026.04', text: '사무실 인테리어 후 직원들이 두통을 호소해서 의뢰했어요. 시공 후 확실히 공기가 가벼워졌다는 피드백이 많았습니다.', photo: false },
    { name: '윤O우', avatar: '윤', meta: '28평 · 대전 유성 · 리모델링', tag: '리모델링', date: '2026.03', text: '가격도 투명하게 안내해주시고 추가 비용 없이 견적 그대로 진행됐어요. A/S 보증까지 있어서 더 든든합니다.', photo: false },
    { name: '서O연', avatar: '서', meta: '39평 · 부산 해운대 · 신축', tag: '신축', date: '2026.03', text: '반려묘가 있어서 안전성이 제일 걱정이었는데 무독성 자재라 안심했어요. 시공 후 아이(고양이)도 활발해진 것 같아요 :)', photo: false },
    { name: '조O민', avatar: '조', meta: '오피스 40평 · 경기 판교', tag: '오피스', date: '2026.02', text: '스타트업 사무실 이전하면서 진행했어요. 주말에 맞춰 시공해주셔서 업무 공백 없이 깔끔하게 끝났습니다.', photo: false },
  ];

  const AVATAR_COLORS = [
    ['#EAF5FB', '#2079AD'],
    ['#EAF4EC', '#4E9A6E'],
    ['#FBF3E4', '#B77A1E'],
    ['#F3ECFA', '#7A5AB0'],
    ['#FBECEF', '#C0517A'],
  ];

  const FILTERS = ['전체', '신축', '아파트', '리모델링', '오피스'];

  /* ---------- 데이터: FAQ ---------- */
  const FAQS = [
    { q: '시공 후 바로 입주할 수 있나요?', a: '네. 베이크아웃과 환기 과정을 거친 뒤 시공 당일 저녁 또는 다음 날부터 입주 가능합니다. 잔여 냄새가 거의 없어 안심하고 생활하실 수 있습니다.' },
    { q: '냄새가 완전히 사라지나요?', a: '자재에서 방출되는 유해물질을 분해·배출하기 때문에 냄새의 원인 자체가 줄어듭니다. 광촉매 코팅은 시공 후에도 지속적으로 오염물질을 분해합니다.' },
    { q: '아이나 반려동물이 있어도 안전한가요?', a: '무독성·무취 친환경 인증 자재만 사용하므로 영유아와 반려동물이 있는 가정도 안전하게 이용하실 수 있습니다.' },
    { q: '시공 시간은 얼마나 걸리나요?', a: '평형에 따라 다르지만 일반 아파트 기준 약 4~6시간 내외로 완료됩니다. 대형·상업 공간은 방문 측정 시 상세 일정을 안내드립니다.' },
    { q: '효과는 얼마나 지속되나요?', a: '광촉매 코팅은 반영구적으로 작용하며, 시공 후 12개월간 무상 A/S로 재점검과 관리를 제공합니다.' },
    { q: '이미 입주한 집도 시공 가능한가요?', a: '가능합니다. 입주 후에도 새 가구·리모델링 등으로 유해물질이 남아 있을 수 있어, 방문 측정 후 맞춤 시공을 진행합니다.' },
  ];

  /* ---------- 히어로 타이프라이터 (…0으로) ----------
     붙여주신 React 컴포넌트의 타이핑/삭제 루프 + 깜빡이는 커서를 바닐라로 이식.
     첫 문구는 '유해물질은 0으로', 나머지는 온브랜드 변형. 한 개만 쓰려면 배열을 1개로. */
  const HERO_PHRASES = ['유해물질은 0으로', '포름알데히드는 0으로', 'VOCs는 0으로', '새집 냄새는 0으로'];

  function initHeroTypewriter() {
    const el = document.querySelector('.hero__type-text');
    const caret = document.querySelector('.hero__caret');
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || HERO_PHRASES.length <= 1) {         // 모션 최소화: 정적 표시
      el.textContent = HERO_PHRASES[0] || el.textContent;
      if (reduce && caret) caret.style.display = 'none';
      return;
    }
    const TYPE = 110, DEL = 55, HOLD = 1700, GAP = 380; // ms
    let i = 0, txt = '', deleting = false;
    el.textContent = '';
    (function tick() {
      const full = HERO_PHRASES[i];
      if (!deleting) {
        txt = full.slice(0, txt.length + 1);
        el.textContent = txt;
        if (txt === full) { deleting = true; return setTimeout(tick, HOLD); }
        return setTimeout(tick, TYPE);
      }
      txt = full.slice(0, txt.length - 1);
      el.textContent = txt;
      if (txt === '') { deleting = false; i = (i + 1) % HERO_PHRASES.length; return setTimeout(tick, GAP); }
      return setTimeout(tick, DEL);
    })();
  }

  /* ---------- 유틸 ---------- */
  const el = (tag, cls) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  };

  /* ---------- 후기 렌더 & 필터 ---------- */
  const grid = document.getElementById('reviews-grid');
  const filterBar = document.getElementById('review-filters');
  let activeFilter = '전체';

  function reviewCard(r, i) {
    const [bg, fg] = AVATAR_COLORS[i % AVATAR_COLORS.length];
    const card = el('article', 'review card');
    card.innerHTML = `
      <div class="review__head">
        <span class="avatar" style="background:${bg};color:${fg};">${r.avatar}</span>
        <span class="review__who">
          <span class="review__name">${r.name}</span>
          <span class="review__meta">${r.meta}</span>
        </span>
      </div>
      <div class="review__rating">
        <span class="review__stars">★★★★★</span>
        <span class="review__date">${r.date}</span>
      </div>
      <p class="review__text">${r.text}</p>
      ${r.photo ? `<span class="review__photo" data-img="${r.photo}" role="img" aria-label="후기 현장 사진"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>현장 사진</span>` : ''}
      <div class="review__foot">
        <span class="tag">#${r.tag}</span>
        <span class="verified">✓ 시공 인증 후기</span>
      </div>`;
    return card;
  }

  function renderReviews() {
    const list = activeFilter === '전체'
      ? REVIEWS
      : REVIEWS.filter((r) => r.tag === activeFilter);
    grid.replaceChildren(...list.map((r) => reviewCard(r, REVIEWS.indexOf(r))));
    applyReviewPhotos();
  }

  function renderFilters() {
    FILTERS.forEach((f) => {
      const btn = el('button', 'filter' + (f === activeFilter ? ' is-active' : ''));
      btn.type = 'button';
      btn.textContent = f;
      btn.addEventListener('click', () => {
        activeFilter = f;
        filterBar.querySelectorAll('.filter').forEach((b) =>
          b.classList.toggle('is-active', b.textContent === f)
        );
        renderReviews();
      });
      filterBar.appendChild(btn);
    });
  }

  /* ---------- FAQ 아코디언 (한 번에 하나만 열림) ---------- */
  const faqList = document.getElementById('faq-list');

  function renderFaqs() {
    FAQS.forEach((f, i) => {
      const item = el('div', 'faq card' + (i === 0 ? ' is-open' : ''));
      item.innerHTML = `
        <button class="faq__q" type="button" aria-expanded="${i === 0}">
          <span class="faq__q-text">${f.q}</span>
          <span class="faq__icon" aria-hidden="true">+</span>
        </button>
        <div class="faq__a"><div><p>${f.a}</p></div></div>`;
      const btn = item.querySelector('.faq__q');
      btn.addEventListener('click', () => {
        const willOpen = !item.classList.contains('is-open');
        faqList.querySelectorAll('.faq').forEach((n) => {
          n.classList.remove('is-open');
          n.querySelector('.faq__q').setAttribute('aria-expanded', 'false');
        });
        if (willOpen) {
          item.classList.add('is-open');
          btn.setAttribute('aria-expanded', 'true');
        }
      });
      faqList.appendChild(item);
    });
  }

  /* ---------- 문의 폼 제출 상태 ---------- */
  function initForm() {
    const wrap = document.getElementById('contact-form-wrap');
    const form = document.getElementById('contact-form');
    const reset = document.getElementById('form-reset');
    if (!wrap || !form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const submitBtn = form.querySelector('.form__submit');
      const originalText = submitBtn ? submitBtn.textContent : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '전송 중…';
      }

      // 필드명 충돌(form.name 등)을 피하려고 id 로 직접 읽는다
      const val = (id) => {
        const el = document.getElementById(id);
        return el ? el.value.trim() : '';
      };
      const payload = {
        name: val('f-name'),
        phone: val('f-phone'),
        area: val('f-area'),     // supabase-client 에서 size 로 매핑
        movein: val('f-date')    // supabase-client 에서 desired_date 로 매핑
      };

      let ok = false;
      try {
        if (window.consultationAPI) {
          const result = await window.consultationAPI.save(payload);
          ok = !!(result && result.success);
        }
      } catch (err) {
        console.error('상담 신청 저장 실패:', err);
      }

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }

      if (ok) {
        wrap.classList.add('is-submitted');
      } else {
        alert('신청 중 오류가 발생했어요. 잠시 후 다시 시도하시거나 전화로 문의해 주세요.');
      }
    });
    reset.addEventListener('click', () => {
      form.reset();
      wrap.classList.remove('is-submitted');
    });
  }

  /* ---------- 실제 이미지가 있으면 자동 적용 (없으면 플레이스홀더 유지) ----------
     assets/ 폴더에 파일을 넣으면 로드에 성공한 것만 실사진으로 교체됩니다.
     파일이 없으면 404를 그리지 않고 현재의 SVG/그라데이션 플레이스홀더가 그대로 남습니다. */
  function probe(url, onOk) {
    const img = new Image();
    img.onload = () => onOk(url);
    img.src = url;
  }

  function applyHeroImage() {
    const stage = document.querySelector('.hero__stage');
    if (!stage || !stage.dataset.bg) return;
    probe(stage.dataset.bg, (url) => {
      stage.style.backgroundImage =
        `linear-gradient(180deg, rgba(20,48,61,0) 45%, rgba(15,40,55,0.34)), url('${url}')`;
      stage.style.backgroundSize = 'cover';
      stage.style.backgroundPosition = 'center 20%';
      stage.classList.add('has-photo');
    });
  }

  function applyReviewPhotos() {
    document.querySelectorAll('.review__photo[data-img]:not(.has-photo)').forEach((span) => {
      probe(span.dataset.img, (url) => {
        span.style.background = `center / cover no-repeat url('${url}')`;
        span.classList.add('has-photo');
      });
    });
  }

  /* ---------- CTA 에어 리플 ---------- */
  function initCtaRipple() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const targets = document.querySelectorAll(
      '.btn--primary, .plan__cta--primary, .form__submit, .sticky-cta'
    );
    targets.forEach((el) => {
      el.addEventListener('pointerdown', (e) => {
        const rect = el.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height) * 2.2;
        const hasPoint = typeof e.clientX === 'number' && e.clientX !== 0;
        const x = hasPoint ? e.clientX - rect.left : rect.width / 2;
        const y = hasPoint ? e.clientY - rect.top : rect.height / 2;
        const ripple = document.createElement('span');
        ripple.className = 'cta-ripple';
        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        el.appendChild(ripple);
        ripple.addEventListener('animationend', () => ripple.remove());
      });
    });
  }

  /* ---------- 그래프 채우기 + 수치 카운트업 ---------- */
  function fmtCount(val, el) {
    const dec = parseInt(el.dataset.countDec || '0', 10);
    const prefix = el.dataset.countPrefix || '';
    const suffix = el.dataset.countSuffix || '';
    return prefix + val.toFixed(dec) + suffix;
  }

  function countUp(el, dur) {
    const to = parseFloat(el.dataset.countTo);
    if (isNaN(to)) return;
    const start = performance.now();
    (function frame(now) {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      el.textContent = fmtCount(to * eased, el);
      if (t < 1) requestAnimationFrame(frame);
      else el.textContent = fmtCount(to, el);
    })(start);
  }

  function revealGraph(g) {
    g.querySelectorAll('[data-fill]').forEach((el) => {
      requestAnimationFrame(() => { el.style.width = el.dataset.fill; });
    });
    g.querySelectorAll('[data-count-to]').forEach((el) => countUp(el, 1100));
  }

  function initGraphReveal() {
    const graphs = document.querySelectorAll('[data-graph]');
    if (!graphs.length) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // reduced-motion 또는 미지원 브라우저: 최종값 그대로 유지
    if (reduce || !('IntersectionObserver' in window)) return;

    // 시작 상태로 접기 (그래프는 화면 밖이라 깜빡임 없음)
    graphs.forEach((g) => {
      g.querySelectorAll('[data-fill]').forEach((el) => { el.style.width = '0%'; });
      g.querySelectorAll('[data-count-to]').forEach((el) => { el.textContent = fmtCount(0, el); });
    });

    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        revealGraph(entry.target);
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.35 });
    graphs.forEach((g) => io.observe(g));
  }

  /* ---------- init ---------- */
  renderFilters();
  renderReviews();
  renderFaqs();
  initForm();
  applyHeroImage();
  initHeroTypewriter();
  initCtaRipple();
  initGraphReveal();
})();
