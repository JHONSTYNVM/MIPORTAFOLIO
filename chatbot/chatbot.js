(() => {
    'use strict';
    function init() {
        const ns = window.PORTFOLIO_CHATBOT;
        if (!ns?.Assistant || document.getElementById('academic-chatbot')) return;
        const assistant = new ns.Assistant();
        const root = document.createElement('div');
        root.id = 'academic-chatbot';
        root.innerHTML = `
            <button class="ac-launcher" type="button" aria-label="Abrir asistente académico" aria-controls="ac-panel" aria-expanded="false">
                <span class="ac-invitation">¿Te ayudo?</span><img src="chatbot/mascota.png" alt="Mascota naranja del asistente" width="104" height="104">
            </button>
            <section id="ac-panel" class="ac-panel" role="dialog" aria-modal="false" aria-labelledby="ac-title" hidden>
                <header class="ac-header"><img src="chatbot/mascota.png" alt="" width="48" height="48"><div><span class="ac-eyebrow">TU COMPAÑERO DE ESTUDIO</span><h2 id="ac-title">Asistente académico</h2><p>Portafolio · UPLA</p></div><button class="ac-close" type="button" aria-label="Cerrar chat">×</button></header>
                <div class="ac-toolbar"><span><i aria-hidden="true"></i>Búsqueda académica gratuita</span><button class="ac-refresh" type="button" aria-label="Actualizar fuentes públicas" title="Actualizar fuentes públicas">↻</button></div>
                <div class="ac-messages" role="log" aria-label="Conversación" aria-live="polite" aria-relevant="additions"></div>
                <div class="ac-suggestions" aria-label="Preguntas sugeridas"></div>
                <p class="ac-status" role="status"></p>
                <form class="ac-form"><label class="ac-sr-only" for="ac-question">Tu pregunta académica</label><input id="ac-question" name="question" type="text" maxlength="600" autocomplete="off" placeholder="Pregunta por un tema o una semana…" required><button type="submit" aria-label="Enviar pregunta">➜</button></form>
                <p class="ac-footnote">Sílabos + publicaciones reales · Sin IA externa</p>
            </section>`;
        document.body.append(root);
        const launcher = root.querySelector('.ac-launcher');
        const panel = root.querySelector('.ac-panel');
        const form = root.querySelector('.ac-form');
        const input = root.querySelector('input');
        const log = root.querySelector('.ac-messages');
        const status = root.querySelector('.ac-status');
        const suggestions = root.querySelector('.ac-suggestions');
        const refresh = root.querySelector('.ac-refresh');
        let busy = false;
        let closeTimer;
        let placementFrame;
        const siteHeader = document.querySelector('.header');
        const siteFooter = document.querySelector('footer');
        function updatePlacement() {
            const footer = siteFooter?.getBoundingClientRect();
            const lift = footer && footer.top < innerHeight && footer.bottom > 0 ? innerHeight - Math.max(0, footer.top) + 10 : 0;
            root.style.setProperty('--ac-footer-lift', lift + 'px');
            root.style.setProperty('--ac-top-safe', Math.max(12, (siteHeader?.getBoundingClientRect().bottom || 0) + 12) + 'px');
        }
        function schedulePlacement() {
            cancelAnimationFrame(placementFrame);
            placementFrame = requestAnimationFrame(updatePlacement);
        }
        window.addEventListener('resize', schedulePlacement, {passive: true});
        window.addEventListener('scroll', schedulePlacement, {passive: true});
        if (window.ResizeObserver) {
            const observer = new ResizeObserver(schedulePlacement);
            if (siteHeader) observer.observe(siteHeader);
            if (siteFooter) observer.observe(siteFooter);
        }
        updatePlacement();
        function open(value) {
            clearTimeout(closeTimer);
            launcher.setAttribute('aria-expanded', String(value));
            launcher.setAttribute('aria-label', value ? 'Cerrar asistente académico' : 'Abrir asistente académico');
            panel.inert = !value;
            panel.setAttribute('aria-hidden', String(!value));
            if (value) {
                updatePlacement(); panel.hidden = false;
                panel.getBoundingClientRect(); // Establece el inicio de la transición CSS.
                root.classList.add('ac-open');
                input.focus({preventScroll: true});
            } else {
                root.classList.remove('ac-open');
                closeTimer = setTimeout(() => { panel.hidden = true; }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 200);
                launcher.focus({preventScroll: true});
            }
        }
        function link(data) {
            const anchor = document.createElement('a');
            const url = data.url && ns.safeURL(data.url);
            anchor.textContent = data.label;
            if (!url) return anchor;
            anchor.href = url;
            const parsed = new URL(url);
            if (parsed.origin !== location.origin || /\.pdf(?:$|\?)/i.test(parsed.pathname) || /\/storage\/v1\//.test(parsed.pathname)) {
                anchor.target = '_blank';
                anchor.rel = 'noopener noreferrer';
            }
            anchor.addEventListener('click', event => {
                if (parsed.pathname === location.pathname && parsed.hash) {
                    if (parsed.hash === location.hash) { event.preventDefault(); followCourseLink(); }
                    if (matchMedia('(max-width: 600px)').matches) open(false);
                }
            });
            return anchor;
        }
        function addMessage(data, user = false) {
            const message = document.createElement('article');
            message.className = 'ac-message' + (user ? ' ac-user' : '');
            if (!user) {
                const avatar = document.createElement('img');
                avatar.src = 'chatbot/mascota.png'; avatar.alt = 'Asistente'; avatar.width = 30; avatar.height = 30;
                message.append(avatar);
            }
            const bubble = document.createElement('div'); bubble.className = 'ac-bubble';
            if (data.sections?.length) {
                const heading = document.createElement('h3'); heading.className = 'ac-answer-title'; heading.textContent = data.heading || 'Explicación académica'; bubble.append(heading);
                data.sections.forEach(section => {
                    const block = document.createElement('section'); block.className = 'ac-answer-section';
                    const title = document.createElement('strong'); title.textContent = section.title;
                    const text = document.createElement('p'); text.textContent = section.text; block.append(title, text);
                    if (section.code) { const pre = document.createElement('pre'); pre.className = 'ac-example'; const code = document.createElement('code'); code.textContent = section.code; pre.append(code); block.append(pre); }
                    bubble.append(block);
                });
            } else {
                String(data.text || '').split(/\n\n+/).forEach(paragraph => { const p = document.createElement('p'); p.textContent = paragraph; bubble.append(p); });
            }
            if (data.items?.length) {
                const list = document.createElement('ul');
                data.items.forEach(item => {
                    const li = document.createElement('li');
                    if (item.badge) { const badge = document.createElement('span'); badge.className = 'ac-item-badge'; badge.textContent = item.badge; li.append(badge); }
                    li.append(link(item));
                    if (item.meta) { const meta = document.createElement('p'); meta.className = 'ac-item-meta'; meta.textContent = item.meta; li.append(meta); }
                    if (item.summary || item.detail) { const p = document.createElement('p'); p.textContent = item.summary || item.detail; li.append(p); }
                    if (item.secondary) li.append(link(item.secondary));
                    list.append(li);
                });
                bubble.append(list);
            }
            if (data.links?.length) {
                const links = document.createElement('div'); links.className = 'ac-source-links';
                data.links.forEach(item => links.append(link(item))); bubble.append(links);
            }
            if (data.note) { const note = document.createElement('p'); note.className = 'ac-note'; note.textContent = data.note; bubble.append(note); }
            message.append(bubble); log.append(message);
            while (log.children.length > 60) log.firstElementChild.remove();
            log.scrollTop = user ? log.scrollHeight : log.scrollTop + message.getBoundingClientRect().top - log.getBoundingClientRect().top - 12;
            if (!user && data.suggestions) setSuggestions(data.suggestions);
        }
        function setSuggestions(questions) {
            suggestions.replaceChildren();
            questions.forEach(question => {
                const button = document.createElement('button'); button.type = 'button'; button.textContent = question;
                button.addEventListener('click', () => { if (!busy) { input.value = question; form.requestSubmit(); } });
                suggestions.append(button);
            });
        }
        function setBusy(value) {
            busy = value;
            root.querySelectorAll('.ac-form button, .ac-suggestions button, .ac-refresh').forEach(button => { button.disabled = value; });
            log.setAttribute('aria-busy', String(value));
        }
        launcher.addEventListener('click', () => open(launcher.getAttribute('aria-expanded') !== 'true'));
        root.querySelector('.ac-close').addEventListener('click', () => open(false));
        root.addEventListener('keydown', event => { if (event.key === 'Escape' && launcher.getAttribute('aria-expanded') === 'true') { event.preventDefault(); open(false); } });
        form.addEventListener('submit', async event => {
            event.preventDefault();
            const question = input.value.trim();
            if (busy || !question) return;
            input.value = ''; addMessage({text: question}, true); setBusy(true); status.textContent = 'Consultando las fuentes…';
            try { addMessage(await assistant.ask(question)); status.textContent = ''; }
            catch (_) { addMessage({text: 'No pude completar la consulta. Inténtalo otra vez o explora los cursos.', links: [{label: 'Mis cursos', url: 'cursos.html'}]}); status.textContent = ''; }
            finally { setBusy(false); }
        });
        refresh.addEventListener('click', async () => {
            if (busy) return;
            setBusy(true); status.textContent = 'Actualizando publicaciones…';
            try {
                const result = await assistant.refresh();
                status.textContent = result.materials && result.galleries ? 'Fuentes públicas actualizadas.' : 'No se pudieron verificar todas las fuentes. Puedes reintentar.';
            } finally { setBusy(false); }
        });
        addMessage({text: '¡Hola! Te ayudo a explorar tus cursos. Puedo encontrar actividades publicadas, consultar los sílabos y explicar conceptos. ¿Qué aprendemos hoy?'});
        setSuggestions(['¿Qué cursos hay?', 'Actividades publicadas', 'Explícame las pilas']);

        // Enlaces propios del asistente: usa los controles existentes del curso.
        let routeObserver;
        let routeTimer;
        function followCourseLink() {
            routeObserver?.disconnect(); clearTimeout(routeTimer);
            const params = new URLSearchParams(location.hash.slice(1));
            const course = params.get('asistente');
            if (!ns.courses[course] || !document.querySelector('.curso-panel')) return;
            const selector = [...document.querySelectorAll('.curso-selector')].find(el => el.dataset.course === course);
            selector?.click();
            const week = Number(params.get('semana'));
            const section = document.getElementById(course);
            const target = [...section.querySelectorAll('.semana')].find(el => Number(el.dataset.week) === week);
            if (!target) return;
            const unit = target.closest('.unidad');
            if (!unit.classList.contains('abierta')) unit.querySelector('.unidad-cabecera')?.click();
            document.querySelectorAll('.ac-destination').forEach(el => el.classList.remove('ac-destination'));
            target.classList.add('ac-destination');
            target.scrollIntoView({block: 'center', behavior: 'instant'});
            const gallery = params.get('galeria');
            if (gallery) {
                const locate = () => {
                    const el = [...target.querySelectorAll('[data-gallery-id]')].find(g => g.dataset.galleryId === gallery);
                    if (!el) return false;
                    el.classList.add('ac-destination'); el.scrollIntoView({block: 'center', behavior: 'instant'});
                    routeObserver?.disconnect(); clearTimeout(routeTimer); return true;
                };
                if (!locate()) { routeObserver = new MutationObserver(locate); routeObserver.observe(target, {subtree: true, childList: true}); routeTimer = setTimeout(() => routeObserver.disconnect(), 15000); }
            }
        }
        window.addEventListener('hashchange', followCourseLink);
        document.addEventListener('DOMContentLoaded', followCourseLink, {once: true});
        followCourseLink();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
    else init();
})();
