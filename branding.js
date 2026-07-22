// 공개 홈페이지 브랜드 적용 (로고 / 기업명)
//  · 관리자에서 저장한 site_settings 를 읽어 네비·푸터·파비콘·타이틀에 반영
//  · localStorage 캐시를 먼저 적용해 새로고침 시 깜빡임 방지
(function () {
  'use strict';
  var CACHE_KEY = 'site_branding_v1';

  function setFavicon(href) {
    var link = document.querySelector('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = href;
  }

  function setText(sel, value) {
    var v = (value || '').trim();
    if (!v) return;
    document.querySelectorAll(sel).forEach(function (el) { el.textContent = v; });
  }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function parseJSON(str) {
    try { var v = JSON.parse(str); return Array.isArray(v) ? v : null; }
    catch (e) { return null; }
  }

  // 시공 과정(PROCESS) 4단계: 제목/설명
  function applyProcess(str) {
    var items = parseJSON(str);
    if (!items) return;
    var steps = document.querySelectorAll('.steps .step');
    items.forEach(function (it, i) {
      var step = steps[i];
      if (!step || !it) return;
      var t = step.querySelector('.step__title');
      var d = step.querySelector('.step__desc');
      if (t && it.title) t.textContent = it.title;
      if (d && it.desc) d.textContent = it.desc;
    });
  }

  function parseObj(str) {
    try { var v = JSON.parse(str); return (v && typeof v === 'object' && !Array.isArray(v)) ? v : null; }
    catch (e) { return null; }
  }

  // 메인(히어로) 섹션
  function applyHero(str) {
    var h = parseObj(str);
    if (!h) return;
    setText('.pill-tag__text', h.pill);
    setText('.hero__title-lead', h.titleLead);
    setText('.hero__desc', h.desc);
    setText('.hero__actions .btn--primary', h.btnPrimary);
    setText('.hero__actions .btn--ghost', h.btnSecondary);

    // 타이핑 문구 (main.js 의 타이프라이터가 참조)
    if (Array.isArray(h.phrases) && h.phrases.length) {
      var phrases = h.phrases.map(function (p) { return String(p).trim(); }).filter(Boolean);
      if (phrases.length) {
        window.__heroPhrases = phrases;
        if (typeof window.setHeroPhrases === 'function') window.setHeroPhrases(phrases);
      }
    }

    // 배경 이미지
    var bg = (h.bg || '').trim();
    if (bg) {
      var stage = document.querySelector('.hero__stage');
      if (stage) {
        stage.dataset.bg = bg;
        stage.style.backgroundImage =
          "linear-gradient(180deg, rgba(20,48,61,0) 45%, rgba(15,40,55,0.34)), url('" + bg + "')";
        stage.style.backgroundSize = 'cover';
        stage.style.backgroundPosition = 'center 20%';
        stage.classList.add('has-photo');
      }
    }
  }

  // 요금 안내(PRICING) 섹션
  function applyPricing(str) {
    var p = parseObj(str);
    if (!p) return;
    if (p.heading) {
      setText('#pricing h2', p.heading.title);
      setText('#pricing .h-center p', p.heading.desc);
    }
    if (Array.isArray(p.plans)) {
      var cards = document.querySelectorAll('.plans .plan');
      p.plans.forEach(function (pl, i) {
        var card = cards[i];
        if (!card || !pl) return;
        var nameEl = card.querySelector('.plan__name');
        var sizeEl = card.querySelector('.plan__size');
        var priceEl = card.querySelector('.plan__price');
        var featsEl = card.querySelector('.plan__feats');
        var ctaEl = card.querySelector('.plan__cta');
        if (nameEl && pl.name) nameEl.textContent = pl.name;
        if (sizeEl && pl.size) sizeEl.textContent = pl.size;
        if (priceEl && pl.price) {
          priceEl.innerHTML = esc(pl.price) + '<small>' + esc(pl.priceUnit || '') + '</small>';
        }
        if (featsEl && Array.isArray(pl.feats) && pl.feats.length) {
          featsEl.innerHTML = pl.feats
            .map(function (f) { return String(f).trim(); })
            .filter(Boolean)
            .map(function (f) { return '<span>' + esc(f) + '</span>'; })
            .join('');
        }
        if (ctaEl && pl.cta) ctaEl.textContent = pl.cta;
      });
    }
  }

  // 시공 현장(CASE) 갤러리: 사진/제목/설명
  function applyCases(str) {
    var items = parseJSON(str);
    if (!items) return;
    var cards = document.querySelectorAll('.cases > div');
    items.forEach(function (it, i) {
      var card = cards[i];
      if (!card || !it) return;
      var t = card.querySelector('.case__title');
      var s = card.querySelector('.case__sub');
      if (t && it.title) t.textContent = it.title;
      if (s && it.sub) s.textContent = it.sub;
      var photo = (it.photo || '').trim();
      if (photo) {
        var media = card.querySelector('.case__media');
        var ph = card.querySelector('.case__ph');
        if (media) {
          media.style.backgroundImage = "url('" + photo + "')";
          media.style.backgroundSize = 'cover';
          media.style.backgroundPosition = 'center';
        }
        if (ph) ph.style.display = 'none';
      }
    });
  }

  function apply(s) {
    if (!s) return;
    var name = (s.brand_name || '').trim();
    var sub = (s.brand_sub || '').trim();
    var logo = (s.logo_url || '').trim();

    if (name) {
      document.querySelectorAll('.brand__name, .footer__brand-name, .footer__copy-name')
        .forEach(function (el) { el.textContent = name; });
      // 문서 타이틀의 기본 브랜드 토큰만 교체 (한 번만)
      if (name !== '맑음' && document.title.indexOf('맑음') !== -1) {
        document.title = document.title.replace(/맑음/g, name);
      }
    }
    if (sub) {
      document.querySelectorAll('.brand__sub').forEach(function (el) { el.textContent = sub; });
    }

    // 푸터 사업자 정보 (상호 / 대표명 / 사업자등록번호)
    setText('.footer__biz-name', s.biz_name);
    setText('.footer__biz-ceo', s.biz_ceo);
    setText('.footer__biz-reg', s.biz_reg_no);

    // 상담 문의 (전화 / 운영시간 / 카카오 링크)
    setText('.footer__phone', s.contact_phone);
    setText('.footer__hours', s.contact_hours);
    var kakao = (s.kakao_url || '').trim();
    document.querySelectorAll('.footer__kakao').forEach(function (a) {
      if (kakao) {
        a.href = kakao;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      } else {
        a.href = '#contact';
        a.removeAttribute('target');
        a.removeAttribute('rel');
      }
    });

    // 후기 평점 / 개수
    setText('.hero__badge-score, .rating-score__num', s.rating_score);
    setText('.rating-score__count', s.review_count);
    setText('.hero__badge-count', s.hero_review_count);

    // 메인(히어로) / 요금 안내 / 시공 과정 / 시공 현장
    if (s.hero_json) applyHero(s.hero_json);
    if (s.pricing_json) applyPricing(s.pricing_json);
    if (s.process_json) applyProcess(s.process_json);
    if (s.cases_json) applyCases(s.cases_json);

    if (logo) {
      document.querySelectorAll('.brand').forEach(function (brand) {
        var dot = brand.querySelector('.brand__dot');
        var img = brand.querySelector('.brand__logo');
        if (!img) {
          img = document.createElement('img');
          img.className = 'brand__logo';
          brand.insertBefore(img, brand.firstChild);
        }
        img.src = logo;
        img.alt = name || 'logo';
        if (dot) dot.style.display = 'none';
      });
      setFavicon(logo);
    }
  }

  // 1) 캐시 즉시 적용 (네트워크 응답 전 깜빡임 방지)
  try {
    var cached = localStorage.getItem(CACHE_KEY);
    if (cached) apply(JSON.parse(cached));
  } catch (e) { /* noop */ }

  // 2) 최신값 로드 후 반영 + 캐시 갱신
  (async function () {
    try {
      var client = await window.appReady;
      if (!client) return;
      var res = await client.from('site_settings').select('key, value');
      if (res.error || !res.data) return;
      var map = {};
      res.data.forEach(function (r) { map[r.key] = r.value; });
      apply(map);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(map)); } catch (e) { /* noop */ }
    } catch (e) { /* noop */ }
  })();
})();
