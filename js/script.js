
(() => {
  const root = document.documentElement;
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const qs = (selector, scope = document) => scope.querySelector(selector);
  const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  const applyTheme = (theme) => {
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
    qsa('[data-theme-icon]').forEach((el) => el.textContent = theme === 'dark' ? '☾' : '☀');
    qsa('[data-theme-label]').forEach((el) => el.textContent = theme === 'dark' ? 'Dark' : 'Light');
    try { localStorage.setItem('deppmeyer-theme-v2', theme); } catch (error) {}
  };
  applyTheme(root.getAttribute('data-theme') || 'dark');
  qsa('[data-theme-toggle]').forEach((button) => {
    button.addEventListener('click', () => applyTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));
  });

  const topbar = qs('[data-topbar]');
  const progress = qs('.scroll-progress');
  const mobileToggle = qs('[data-mobile-toggle]');
  const mobilePanel = qs('[data-mobile-panel]');
  const updateScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const progressValue = max > 0 ? (window.scrollY / max) * 100 : 0;
    if (progress) progress.style.width = `${Math.min(100, progressValue)}%`;
    if (topbar) topbar.classList.toggle('scrolled', window.scrollY > 10);
  };
  updateScroll();
  window.addEventListener('scroll', updateScroll, { passive: true });

  if (mobileToggle && mobilePanel) {
    const closeMenu = () => {
      mobilePanel.classList.remove('open');
      topbar?.classList.remove('menu-open');
      document.body.classList.remove('menu-open');
      mobileToggle.setAttribute('aria-expanded', 'false');
    };
    mobileToggle.addEventListener('click', () => {
      const open = !mobilePanel.classList.contains('open');
      mobilePanel.classList.toggle('open', open);
      topbar?.classList.toggle('menu-open', open);
      document.body.classList.toggle('menu-open', open);
      mobileToggle.setAttribute('aria-expanded', String(open));
    });
    qsa('a', mobilePanel).forEach((link) => link.addEventListener('click', closeMenu));
    window.addEventListener('resize', () => { if (window.innerWidth > 1080) closeMenu(); });
  }

  const revealItems = qsa('.reveal');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -40px' });
    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add('visible'));
  }

  const glow = qs('.cursor-glow');
  if (glow && !prefersReduced && window.matchMedia('(pointer:fine)').matches) {
    window.addEventListener('pointermove', (event) => {
      glow.style.transform = `translate(${event.clientX - 180}px, ${event.clientY - 180}px)`;
    }, { passive: true });
  }

  if (!prefersReduced && window.matchMedia('(pointer:fine)').matches) {
    qsa('[data-tilt]').forEach((card) => {
      card.addEventListener('pointermove', (event) => {
        const rect = card.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) - 0.5;
        const y = ((event.clientY - rect.top) / rect.height) - 0.5;
        card.style.transform = `perspective(1000px) rotateX(${(-y * 8).toFixed(2)}deg) rotateY(${(x * 10).toFixed(2)}deg) translateY(-2px)`;
      });
      card.addEventListener('pointerleave', () => {
        card.style.transform = '';
      });
    });

    qsa('.magnetic').forEach((button) => {
      button.addEventListener('pointermove', (event) => {
        const rect = button.getBoundingClientRect();
        const x = event.clientX - rect.left - rect.width / 2;
        const y = event.clientY - rect.top - rect.height / 2;
        button.style.transform = `translate(${x * 0.08}px, ${y * 0.14}px)`;
      });
      button.addEventListener('pointerleave', () => { button.style.transform = ''; });
    });
  }

  qsa('[data-prefill-topic]').forEach((button) => {
    button.addEventListener('click', () => {
      const payload = {
        topic: button.getAttribute('data-prefill-topic') || '',
        message: button.getAttribute('data-prefill-message') || ''
      };
      try { sessionStorage.setItem('deppmeyer-contact-prefill-v2', JSON.stringify(payload)); } catch (error) {}
      window.location.href = 'kontakt.html#kontaktformular';
    });
  });

  const config = window.siteConfig || {};
  const setText = (key, value) => {
    qsa(`[data-config="${key}"]`).forEach((node) => {
      if (node.tagName === 'A' && key === 'email') node.href = value ? `mailto:${value}` : '#';
      if (node.tagName === 'A' && key === 'phone') node.href = value ? `tel:${String(value).replace(/\s+/g, '')}` : '';
      node.textContent = value || '';
      if (key === 'phone' && !value) node.hidden = true;
    });
  };
  ['companyName', 'email', 'phone', 'location', 'legalName', 'street', 'cityZip', 'domain'].forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(config, key)) setText(key, config[key]);
  });
  qsa('[data-year]').forEach((node) => { node.textContent = new Date().getFullYear(); });

  const form = qs('[data-contact-form]');
  if (form) {
    const fields = {
      gender: form.elements.gender,
      firstName: form.elements.firstName,
      name: form.elements.name,
      company: form.elements.company,
      email: form.elements.email,
      phone: form.elements.phone,
      topic: form.elements.topic,
      message: form.elements.message,
      callbackRequested: form.elements.callbackRequested,
      consent: form.elements.consent,
      website: form.elements.website,
      assessment: form.elements.assessment
    };
    const submit = qs('[data-contact-submit]', form);
    const note = qs('[data-contact-note]', form);
    const summary = qs('[data-contact-summary]', form);
    const prefillBox = qs('[data-contact-prefill]', form);
    const prefillText = qs('[data-contact-prefill-text]', form);
    const assessmentField = qs('[data-assessment-field]', form);

    const getPrefill = () => {
      try { return JSON.parse(sessionStorage.getItem('deppmeyer-contact-prefill-v2') || 'null'); } catch (error) { return null; }
    };
    const prefill = getPrefill();
    if (prefill) {
      if (fields.topic && prefill.topic) fields.topic.value = prefill.topic;
      if (fields.message && prefill.message && !fields.message.value) fields.message.value = prefill.message;
      if (assessmentField) assessmentField.value = `Schnellcheck: ${prefill.topic || ''}`.trim();
      if (prefillBox && prefillText) {
        prefillText.textContent = `Aus dem Schnellcheck übernommen: ${prefill.topic}`;
        prefillBox.hidden = false;
      }
    }
    qs('[data-contact-prefill-clear]', form)?.addEventListener('click', () => {
      try { sessionStorage.removeItem('deppmeyer-contact-prefill-v2'); } catch (error) {}
      if (prefillBox) prefillBox.hidden = true;
      if (assessmentField) assessmentField.value = '';
    });

    const emailIsValid = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());
    const phoneIsValid = (value) => String(value || '').replace(/[^\d+]/g, '').length >= 7;
    const mark = (field, ok) => {
      const wrapper = field?.closest('.field');
      if (wrapper) wrapper.classList.toggle('invalid', !ok);
      return ok;
    };
    const validate = () => {
      const okFirst = mark(fields.firstName, fields.firstName.value.trim().length > 1);
      const okName = mark(fields.name, fields.name.value.trim().length > 1);
      const okEmail = mark(fields.email, emailIsValid(fields.email.value));
      const okTopic = mark(fields.topic, !!fields.topic.value);
      const okMessage = mark(fields.message, fields.message.value.trim().length >= 20);
      const okPhone = !fields.callbackRequested.checked || phoneIsValid(fields.phone.value);
      mark(fields.phone, okPhone);
      const okConsent = fields.consent.checked;
      const ready = okFirst && okName && okEmail && okTopic && okMessage && okPhone && okConsent;
      if (submit) {
        submit.disabled = !ready;
        submit.setAttribute('aria-disabled', String(!ready));
      }
      if (note) note.textContent = ready ? 'Alles bereit. Die Anfrage kann abgesendet werden.' : 'Bitte fülle alle Pflichtfelder aus und bestätige den Datenschutz.';
      if (summary) {
        const parts = [];
        if (fields.topic.value) parts.push(`Thema: ${fields.topic.value}`);
        if (fields.company.value) parts.push(`Firma: ${fields.company.value}`);
        if (fields.callbackRequested.checked) parts.push('Rückruf gewünscht');
        if (fields.message.value.trim()) parts.push(`Beschreibung: ${fields.message.value.trim().slice(0, 130)}${fields.message.value.trim().length > 130 ? '…' : ''}`);
        summary.textContent = parts.length ? parts.join(' · ') : 'Fülle das Formular aus. Die Zusammenfassung aktualisiert sich automatisch.';
      }
      return ready;
    };
    qsa('input, select, textarea', form).forEach((input) => input.addEventListener('input', validate));
    qsa('input, select, textarea', form).forEach((input) => input.addEventListener('change', validate));
    validate();

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!validate()) return;
      const payload = {
        gender: fields.gender.value,
        firstName: fields.firstName.value,
        name: fields.name.value,
        company: fields.company.value,
        email: fields.email.value,
        phone: fields.phone.value,
        topic: fields.topic.value,
        message: fields.message.value,
        callbackRequested: fields.callbackRequested.checked,
        consent: fields.consent.checked,
        website: fields.website.value,
        assessment: fields.assessment.value
      };
      submit.disabled = true;
      if (note) note.textContent = 'Anfrage wird gesendet …';
      try {
        const response = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok === false) throw new Error(data.message || 'Die Anfrage konnte nicht gesendet werden.');
        if (note) note.textContent = data.message || 'Anfrage erfolgreich abgesendet.';
        form.reset();
        try { sessionStorage.removeItem('deppmeyer-contact-prefill-v2'); } catch (error) {}
        if (prefillBox) prefillBox.hidden = true;
        validate();
      } catch (error) {
        if (note) note.textContent = error.message || 'Das Formular konnte aktuell nicht gesendet werden. Bitte später erneut versuchen.';
        validate();
      }
    });
  }
})();
