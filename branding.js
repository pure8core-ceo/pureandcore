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
