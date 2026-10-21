/* Mech Jr v2 - interações e coreografia de scroll.
   Sem dependência obrigatória: se GSAP/Lenis não carregarem ou o usuário
   preferir menos movimento, o site funciona e fica 100% legível. */
(() => {
  'use strict';

  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canReveal = !reduceMotion && 'IntersectionObserver' in window;
  const canAnimate = canReveal && typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  root.classList.add(canReveal ? 'motion-ready' : 'motion-off');

  /* ---------- Revelação no scroll: só CSS (opacity + translate), sem GSAP.
     O estado inicial já vem do CSS antes da primeira pintura, então não há
     "aparece, some, aparece". Cada elemento entra uma vez. ---------- */
  if (canReveal) {
    const revealIO = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        revealIO.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    $$('[data-reveal], .sec-head, .card, .project, .gallery__item, .partner, .about__text, .partners__cta, .contact__intro, .form').forEach((el) => revealIO.observe(el));
  }

  let lenis = null;
  const header = $('.site-header');
  const headerOffset = () => (header ? header.offsetHeight : 0) + 16;

  /* ---------- Rolagem até âncoras (com ou sem Lenis) ---------- */
  function scrollToTarget(target) {
    if (lenis) {
      lenis.scrollTo(target, { offset: -headerOffset(), duration: 1.1 });
    } else {
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    e.preventDefault();
    closeMenu();
    if (a.dataset.servico) prefillForm(a.dataset.area, a.dataset.servico);
    scrollToTarget(target);
    history.replaceState(null, '', '#' + id);
  });

  /* ---------- Menu mobile ---------- */
  const toggle = $('.nav-toggle');
  const nav = $('#menu');
  function closeMenu() {
    if (!toggle || toggle.getAttribute('aria-expanded') !== 'true') return;
    toggle.setAttribute('aria-expanded', 'false');
    nav.classList.remove('is-open');
  }
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
      if (open) nav.querySelector('a').focus();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { closeMenu(); toggle.focus(); }
    });
    window.matchMedia('(min-width: 900px)').addEventListener('change', closeMenu);
  }

  /* ---------- Header compacto, WhatsApp e item de menu ativo ---------- */
  const hero = $('.hero');
  const wa = $('.wa-float');
  if ('IntersectionObserver' in window) {
    const sentinel = document.createElement('div');
    sentinel.style.cssText = 'position:absolute;top:80px;left:0;width:1px;height:1px;pointer-events:none';
    sentinel.setAttribute('aria-hidden', 'true');
    document.body.prepend(sentinel);
    new IntersectionObserver(([entry]) => {
      header.classList.toggle('is-compact', !entry.isIntersecting);
    }).observe(sentinel);

    if (hero && wa) {
      new IntersectionObserver(([entry]) => {
        wa.classList.toggle('is-visible', !entry.isIntersecting);
      }, { threshold: 0.15 }).observe(hero);
    }

    const links = new Map($$('.nav a[href^="#"]:not(.btn)').map((a) => [a.getAttribute('href').slice(1), a]));
    const sectionToLink = { historia: 'sobre', parceiros: 'sobre' };
    const navIO = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const key = sectionToLink[entry.target.id] || entry.target.id;
        links.forEach((a, id) => (id === key ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('main section[id]').forEach((s) => navIO.observe(s));
  } else if (wa) {
    wa.classList.add('is-visible');
  }

  /* ---------- "Solicitar": pré-seleciona a área no formulário ---------- */
  const form = $('#form-contato');
  function prefillForm(area, servico) {
    if (!form) return;
    const select = form.elements.area;
    if (area && [...select.options].some((o) => o.value === area || o.text === area)) select.value = area;
    const msg = form.elements.mensagem;
    if (!msg.value.trim() || msg.dataset.prefilled === 'true') {
      msg.value = servico === 'Parceria'
        ? 'Olá! Gostaria de conversar sobre uma parceria com a Mech Jr.'
        : `Olá! Gostaria de solicitar: ${servico}.`;
      msg.dataset.prefilled = 'true';
    }
    clearError(select);
  }

  /* ---------- Projetos: visualização expandida ---------- */
  const modal = $('#modal-projeto');
  let lastOpener = null;
  function openProject(article, opener) {
    if (!modal) return;
    lastOpener = opener;
    const srcImg = $('.project__media img', article);
    const media = $('.modal__media', modal);
    media.innerHTML = '';
    const pic = $('.project__media picture', article).cloneNode(true);
    $$('source, img', pic).forEach((el) => el.setAttribute('sizes', '(min-width: 1100px) 1000px, 100vw'));
    const img = $('img', pic);
    img.loading = 'eager';
    media.appendChild(pic);
    $('.modal__tag', modal).textContent = $('.tag', article).textContent;
    $('.modal__title', modal).textContent = $('.project__title', article).textContent;
    const text = $('.modal__text', modal);
    text.innerHTML = '';
    $$('.project__full p', article).forEach((p) => text.appendChild(p.cloneNode(true)));

    if (typeof modal.showModal === 'function') modal.showModal(); else modal.setAttribute('open', '');
    modal.scrollTop = 0;
    root.classList.add('modal-open');
    if (lenis) lenis.stop();
    $('.modal__close', modal).focus();

    if (!canAnimate) return;
    // FLIP: a imagem parte da posição do card e o painel se abre a partir dela
    const s = srcImg.getBoundingClientRect();
    const t = img.getBoundingClientRect();
    const d = modal.getBoundingClientRect();
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.fromTo(modal,
      { clipPath: `inset(${Math.max(0, s.top - d.top)}px ${Math.max(0, d.right - s.right)}px ${Math.max(0, d.bottom - s.bottom)}px ${Math.max(0, s.left - d.left)}px)` },
      { clipPath: 'inset(0px 0px 0px 0px)', duration: 0.7, clearProps: 'clipPath' }, 0)
      .fromTo(img,
        { x: s.left - t.left, y: s.top - t.top, scale: s.width / t.width },
        { x: 0, y: 0, scale: 1, duration: 0.7, clearProps: 'transform' }, 0)
      .fromTo('.modal__body > *', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.06, clearProps: 'all' }, 0.25);
  }
  function closeProject() {
    if (!modal || !modal.open) return;
    const done = () => {
      modal.close();
      root.classList.remove('modal-open');
      if (lenis) lenis.start();
      if (lastOpener) lastOpener.focus();
    };
    if (canAnimate) gsap.to(modal, { opacity: 0, y: 8, duration: 0.25, ease: 'power2.in', onComplete: () => { gsap.set(modal, { clearProps: 'opacity,transform' }); done(); } });
    else done();
  }
  if (modal) {
    $$('.project').forEach((article) => {
      const btn = $('.project__open', article);
      btn.addEventListener('click', () => openProject(article, btn));
      $('.project__media', article).addEventListener('click', () => openProject(article, btn));
    });
    $('.modal__close', modal).addEventListener('click', closeProject);
    modal.addEventListener('cancel', (e) => { e.preventDefault(); closeProject(); });
    modal.addEventListener('click', (e) => { if (e.target === modal) closeProject(); });
  }

  /* ---------- Formulário de contato ---------- */
  const startedAt = Date.now();
  const RULES = {
    nome: (v) => (v.length < 2 ? 'Informe seu nome.' : v.length > 100 ? 'Use no máximo 100 caracteres.' : ''),
    email: (v) => (!v ? 'Informe seu e-mail.' : !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) || v.length > 254 ? 'Confira o e-mail. Exemplo: nome@empresa.com' : ''),
    telefone: (v) => (v && !/^[0-9()+\-.\s]{8,20}$/.test(v) ? 'Use só números, espaços, parênteses ou hífen. Exemplo: (66) 99999-0000' : ''),
    area: (v) => (!v ? 'Escolha uma área de interesse.' : ''),
    mensagem: (v) => (v.length < 10 ? 'Escreva sua mensagem com pelo menos 10 caracteres.' : v.length > 2000 ? 'Use no máximo 2.000 caracteres.' : ''),
  };
  function errorEl(field) { return document.getElementById('e-' + field.name); }
  function setError(field, msg) {
    const el = errorEl(field);
    if (el) el.textContent = msg;
    if (msg) field.setAttribute('aria-invalid', 'true'); else field.removeAttribute('aria-invalid');
  }
  function clearError(field) { setError(field, ''); }
  function validateField(field) {
    const rule = RULES[field.name];
    if (!rule) return true;
    const msg = rule(field.value.trim());
    setError(field, msg);
    return !msg;
  }

  if (form) {
    const status = $('.form__status', form);
    const submit = $('.form__submit', form);
    const label = $('.form__submit-label', form);
    let attempted = false;

    const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="/assets/img/icons.svg#i-${name}"></use></svg>`;
    function setStatus(kind, message) {
      status.className = 'form__status' + (kind ? ' is-' + kind : '');
      status.innerHTML = kind ? icon(kind === 'ok' ? 'check' : 'warning') + message : message;
      if (canAnimate && kind) gsap.fromTo(status, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out' });
    }
    function setBusy(busy) {
      submit.disabled = busy;
      submit.setAttribute('aria-busy', String(busy));
      label.textContent = busy ? 'Enviando' : 'Enviar mensagem';
    }

    Object.keys(RULES).forEach((name) => {
      const field = form.elements[name];
      field.addEventListener('blur', () => { if (attempted || field.value) validateField(field); });
      field.addEventListener('input', () => {
        if (name === 'mensagem') field.dataset.prefilled = 'false';
        if (field.getAttribute('aria-invalid') === 'true') validateField(field);
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      attempted = true;
      const invalid = Object.keys(RULES).map((n) => form.elements[n]).filter((f) => !validateField(f));
      if (invalid.length) {
        setStatus('err', 'Revise os campos destacados.');
        invalid[0].focus();
        return;
      }
      form.elements.t.value = String(Date.now() - startedAt);
      setBusy(true);
      setStatus('', 'Enviando sua mensagem.');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      try {
        const res = await fetch(form.action, {
          method: 'POST',
          body: new FormData(form),
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        let data = {};
        try { data = await res.json(); } catch (_) { /* resposta sem JSON */ }
        if (res.ok && data.ok) {
          form.reset();
          form.elements.mensagem.dataset.prefilled = 'false';
          attempted = false;
          setStatus('ok', 'Mensagem enviada. Obrigado! Vamos responder no e-mail informado.');
        } else if (res.status === 400 && data.errors) {
          Object.entries(data.errors).forEach(([name, msg]) => form.elements[name] && setError(form.elements[name], msg));
          setStatus('err', 'Revise os campos destacados.');
        } else if (res.status === 429) {
          setStatus('err', 'Muitas tentativas seguidas. Aguarde um minuto e envie de novo.');
        } else {
          setStatus('err', 'Não conseguimos enviar agora. Tente de novo em alguns minutos ou fale com a gente pelo WhatsApp (66) 99654-9345.');
        }
      } catch (_) {
        setStatus('err', 'Sem conexão com o servidor. Verifique sua internet e tente de novo, ou use o WhatsApp (66) 99654-9345.');
      } finally {
        clearTimeout(timer);
        setBusy(false);
      }
    });
  }

  /* ---------- Vídeo do hero: pausa manual, fora da tela e com movimento reduzido ---------- */
  const video = $('.hero__video');
  const vToggle = $('.hero__toggle');
  if (video && vToggle) {
    let userPaused = reduceMotion;
    const sync = () => {
      const paused = video.paused;
      vToggle.setAttribute('aria-pressed', String(paused));
      vToggle.setAttribute('aria-label', paused ? 'Reproduzir animação de fundo' : 'Pausar animação de fundo');
    };
    const play = () => { const r = video.play(); if (r && r.catch) r.catch(() => {}); };
    if (reduceMotion) { video.removeAttribute('autoplay'); video.pause(); }
    video.addEventListener('play', sync);
    video.addEventListener('pause', sync);
    vToggle.addEventListener('click', () => {
      userPaused = !video.paused;
      if (userPaused) video.pause(); else play();
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) video.pause();
        else if (!userPaused) play();
      }, { threshold: 0.1 }).observe(video);
    }
    sync();
  }

  /* ---------- Coreografia ---------- */
  if (!canAnimate) return;

  const { gsap: g, ScrollTrigger: ST } = window;
  g.registerPlugin(ST);
  const EASE = 'expo.out';

  // Lenis só com mouse/trackpad: no toque a rolagem nativa já é a mais natural
  if (typeof window.Lenis === 'function' && window.matchMedia('(pointer: fine)').matches) {
    lenis = new window.Lenis({ duration: 1.1, easing: (t) => 1 - Math.pow(1 - t, 3) });
    lenis.on('scroll', ST.update);
    g.ticker.add((time) => lenis.raf(time * 1000));
    g.ticker.lagSmoothing(0);
  }

  // Barra de progresso: só leitura de posição, neutra
  g.to('.progress__bar', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });

  // Hero: o título entra por animação CSS (sem esperar o GSAP).
  // Aqui só um parallax leve do vídeo de fundo, amarrado ao scroll.
  // Parallax só no desktop. O matchMedia reverte o tween ao sair do breakpoint,
  // e o mobile limpa qualquer transform residual: o vídeo volta ao fluxo normal.
  const mm = g.matchMedia();
  mm.add('(min-width: 900px)', () => {
    g.to('.hero__stage', { y: 60, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    g.to('.scroll-cue', { opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: '20% top', scrub: true } });
  });
  mm.add('(max-width: 899.98px)', () => { g.set('.hero__stage, .scroll-cue', { clearProps: 'all' }); });

  // Entradas de cards, seções e fotos ficam no CSS (ver "Revelação no scroll").

  // Quem somos: o texto ganha contraste conforme a leitura avança
  const statement = $('.about__statement');
  if (statement) {
    const words = statement.textContent.trim().split(/\s+/);
    const plain = document.createElement('span');
    plain.className = 'sr-only';
    plain.textContent = statement.textContent.trim();
    const visual = document.createElement('span');
    visual.setAttribute('aria-hidden', 'true');
    words.forEach((w, i) => {
      const span = document.createElement('span');
      span.className = 'word';
      span.textContent = w;
      visual.append(span, i < words.length - 1 ? ' ' : '');
    });
    statement.replaceChildren(plain, visual);
    g.fromTo($$('.word', statement), { color: '#7D8287' }, {
      color: '#1D2023', ease: 'none', stagger: 0.1,
      scrollTrigger: { trigger: statement, start: 'top 80%', end: 'bottom 50%', scrub: 0.4 },
    });
  }

  // História: sem pin. A linha preenche conforme a rolagem normal e cada marco
  // acende quando a linha chega nele (horizontal no desktop, vertical no mobile).
  const historyEl = $('.history');
  const milestones = $$('.milestone');
  const activate = (p) => milestones.forEach((m, i) => m.classList.toggle('is-active', p >= [0.05, 0.5, 0.95][i]));
  historyEl.classList.add('history--live');
  mm.add({ desk: '(min-width: 900px)', mob: '(max-width: 899.98px)' }, (ctx) => {
    const axis = ctx.conditions.desk ? 'scaleX' : 'scaleY';
    g.set('.timeline__fill', { clearProps: 'transform' });
    g.fromTo('.timeline__fill', { [axis]: 0 }, {
      [axis]: 1, ease: 'none',
      scrollTrigger: {
        trigger: '.timeline', start: ctx.conditions.desk ? 'top 85%' : 'top 75%', end: ctx.conditions.desk ? 'bottom 45%' : 'bottom 55%', scrub: 0.4,
        onUpdate: (self) => activate(self.progress),
        onRefresh: (self) => activate(self.progress),
      },
    });
  });

})();
