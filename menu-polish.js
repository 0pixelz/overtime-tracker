// menu-polish.js
// Badges sobres pour le hamburger menu, sans observer agressif.
(() => {
  if (window.__menuPolishLoaded) return;
  window.__menuPolishLoaded = true;

  const BADGES = [
    { keys: ['accueil', 'home'], badge: 'ACC' },
    { keys: ['statistique', 'stats'], badge: 'STAT' },
    { keys: ['calendrier de paie', 'paie'], badge: 'PAY' },
    { keys: ['parametre', 'paramètres'], badge: 'SET' },
    { keys: ['simulation'], badge: 'SIM' },
    { keys: ['assistant', 'ai'], badge: 'AI' }
  ];

  let running = false;

  function normalize(text) {
    return String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  function badgeFor(text) {
    const t = normalize(text);
    const found = BADGES.find(item => item.keys.some(k => t.includes(normalize(k))));
    return found ? found.badge : 'APP';
  }

  function ensureStyles() {
    if (document.getElementById('menuPolishStyles')) return;
    const st = document.createElement('style');
    st.id = 'menuPolishStyles';
    st.textContent = `
      #sideMenu .side-nav-icon,.side-menu .side-nav-icon,.drawer .side-nav-icon,.menu-panel .side-nav-icon{
        display:inline-flex!important;align-items:center!important;justify-content:center!important;
        min-width:34px!important;width:34px!important;height:24px!important;border-radius:999px!important;
        border:1px solid var(--border)!important;background:var(--bg-elev-2)!important;color:var(--text-dim)!important;
        font-family:var(--font-mono,ui-monospace,monospace)!important;font-size:9px!important;font-weight:800!important;
        letter-spacing:.08em!important;line-height:1!important;flex:0 0 auto!important;
      }
      #sideMenu button.active .side-nav-icon,.side-menu button.active .side-nav-icon,.drawer button.active .side-nav-icon,.menu-panel button.active .side-nav-icon,
      #sideMenu [aria-current="page"] .side-nav-icon,.side-menu [aria-current="page"] .side-nav-icon,.drawer [aria-current="page"] .side-nav-icon,.menu-panel [aria-current="page"] .side-nav-icon{
        border-color:var(--accent)!important;background:var(--accent-soft)!important;color:var(--accent-text)!important;
      }
    `;
    document.head.appendChild(st);
  }

  function polishMenu() {
    if (running) return;
    running = true;
    ensureStyles();
    document.querySelectorAll('#sideMenu,.side-menu,.drawer,.menu-panel').forEach(menu => {
      menu.querySelectorAll('button, a, [role="button"]').forEach(item => {
        let label = item.querySelector('.side-nav-label')?.textContent || '';
        if (!label) {
          const clone = item.cloneNode(true);
          clone.querySelectorAll('.side-nav-icon').forEach(n => n.remove());
          label = clone.textContent || item.textContent || '';
        }
        let icon = item.querySelector('.side-nav-icon');
        if (!icon) {
          icon = document.createElement('span');
          icon.className = 'side-nav-icon';
          item.prepend(icon);
        }
        const next = badgeFor(label);
        if (icon.textContent !== next) icon.textContent = next;
        icon.setAttribute('aria-hidden', 'true');
      });
    });
    running = false;
  }

  function schedulePolish() {
    requestAnimationFrame(polishMenu);
  }

  function init() {
    schedulePolish();
    const menu = document.getElementById('sideMenu') || document.querySelector('.side-menu,.drawer,.menu-panel');
    if (menu) {
      const observer = new MutationObserver(schedulePolish);
      observer.observe(menu, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
