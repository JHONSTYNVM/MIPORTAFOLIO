/* Búsqueda local + fuentes públicas. Sin SDK, sesión de usuario ni proveedor de IA. */
(() => {
    'use strict';
    const ns = window.PORTFOLIO_CHATBOT;
    const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const stop = new Set(('a al algo algun alguna algunos ante aqui archivo archivos actividad actividades publicado publicados publicada publicadas material materiales galeria galerias evidencia evidencias trabajo trabajos curso cursos de del el en es esta estan este estos la las lo los un una unos unas y o u que cual cuales como donde cuando cuanto cuantos cuantas por para con sin sobre hay tiene tienen ver muestra muestrame dame dime quiero quisiera necesito puedo puedes podria favor me mi mis se su sus sus te tu tus hola buenas explicame explica explicacion ejemplo ejemplos diferencia diferencias entre funciona funcionan usar usa buscar busca encuentra buscarlo encontrar informacion semana semanas unidad unidades tema temas silabo silabos temario temarios segun programado programados saber conocer todos todas nuevo nuevos ultimo ultimos reciente recientes subido subidos descargar descarga descargarlo pdf imagen imagenes foto fotos video videos publicado publicacion publicaciones dos ambos dos portafolio').split(' '));
    'todo toda disponible disponibles nuevas nueva ultimas ultima subidas subida recursos recurso documentos documento enlaces enlace practicas practica ejercicios ejercicio total cantidad listado listo mostrar ensename ensenar tienen tenemos ven estudia estudiar trata hablan contiene contenido favor porfa del mismo esa ese este esta ahi'.split(' ').forEach(w => stop.add(w));
    const words = value => normalize(value).match(/[a-z0-9]+/g) || [];
    const terms = value => [...new Set(words(value).filter(w => w.length > 1 && !stop.has(w) && !/^\d+$/.test(w)))];
    function similar(a, b) {
        if (a === b) return 1;
        if (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a))) return .82;
        if (a.length < 6 || b.length < 6 || Math.abs(a.length - b.length) > 1) return 0;
        let previous = Array.from({length: b.length + 1}, (_, i) => i);
        for (let i = 1; i <= a.length; i++) {
            const next = [i];
            for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] !== b[j - 1]));
            previous = next;
        }
        return previous[b.length] <= 1 ? .65 : 0;
    }
    const score = (query, text) => {
        const haystack = words(text);
        return query.reduce((sum, term) => sum + Math.max(0, ...haystack.map(word => similar(term, word))), 0);
    };
    const safeURL = value => {
        try {
            const url = new URL(value, location.href);
            const localRelative = location.protocol === 'file:' && !/^(?:[a-z][a-z0-9+.-]*:|[/\\])|\.\./i.test(value);
            return /^(https?:)$/.test(url.protocol) || url.protocol === 'file:' && localRelative ? url.href : '';
        }
        catch (_) { return ''; }
    };
    const courseLink = (course, week, gallery) => 'cursos.html#' + new URLSearchParams({asistente: course, ...(week ? {semana: week} : {}), ...(gallery ? {galeria: gallery} : {})});
    function extractNumber(query, kind) {
        const nums = {primera:1, primero:1, uno:1, segunda:2, segundo:2, dos:2, tercera:3, tercero:3, tres:3, cuarta:4, cuarto:4, cuatro:4, quinta:5, quinto:5, cinco:5, sexta:6, sexto:6, seis:6, septima:7, septimo:7, siete:7, octava:8, octavo:8, ocho:8, novena:9, noveno:9, nueve:9, decima:10, diez:10, once:11, doce:12, trece:13, catorce:14, quince:15, dieciseis:16, i:1, ii:2, iii:3, iv:4, v:5, vi:6, vii:7, viii:8, ix:9, x:10, xi:11, xii:12, xiii:13, xiv:14, xv:15, xvi:16};
        const before = query.match(new RegExp('\\b(' + Object.keys(nums).join('|') + ')\\s+' + kind + '\\b'));
        const after = query.match(new RegExp('\\b' + kind + '(?:\\s+(?:numero|nro|n|la|el))?[\\s.:°º#-]+(\\d+|[a-z]+)\\b'));
        return after ? (/^\d+$/.test(after[1]) ? Number(after[1]) : nums[after[1]] ?? null) : before ? nums[before[1]] : null;
    }
    class Assistant {
        constructor({responder = null} = {}) {
            this.responder = responder; // Punto de extensión futuro. No hay integración externa activada.
            this.context = {};
            this.catalog = [];
            this.materials = [];
            this.galleries = [];
            this.available = {materials: false, galleries: false};
            this.catalogReady = false;
        }
        async loadCatalog() {
            if (this.catalogReady) return;
            let doc = document;
            if (!doc.querySelector('.curso-panel')) {
                try {
                    const response = await fetch('cursos.html', {signal: AbortSignal.timeout(6000)});
                    if (response.ok) doc = new DOMParser().parseFromString(await response.text(), 'text/html');
                } catch (_) { /* El sílabo también permite usar el asistente al abrir un HTML local. */ }
            }
            this.catalog = Object.entries(ns.courses).flatMap(([course, data]) => data.weeks.map((row, index) => {
                const week = index + 1;
                const existing = doc.querySelector(`.semana[data-course="${course}"][data-week="${String(week).padStart(2, '0')}"]`);
                return {course, week, unit: Math.ceil(week / 4), title: row[0], program: row[1], aliases: row[2], explanation: row[3],
                    portfolioTitle: existing?.querySelector('h3')?.textContent.trim() || '',
                    portfolioDescription: existing?.querySelector(':scope > div > p')?.textContent.trim() || ''};
            }));
            this.catalogReady = true;
        }
        async readTable(table) {
            const cfg = window.PORTAFOLIO_SUPABASE || {};
            if (!cfg.url || !cfg.anonKey) throw new Error('Fuente pública no configurada');
            const fields = table === 'materials'
                ? 'id,course_key,week_number,name,description,material_type,file_url,external_url,gallery_id,created_at'
                : 'id,course_key,week_number,name,description,created_at';
            const rows = [];
            // Paginación estable para incluir también publicaciones futuras, sin límite de 1000 filas.
            for (let offset = 0; ; offset += 500) {
                const url = new URL('/rest/v1/' + table, cfg.url);
                url.search = new URLSearchParams({select: fields, order: 'id.asc', limit: 500, offset,
                    ...(table === 'materials' ? {published: 'eq.true'} : {})});
                const response = await fetch(url, {headers: {apikey: cfg.anonKey}, credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(10000)});
                if (!response.ok) throw new Error('No se pudo consultar ' + table);
                const batch = await response.json();
                if (!Array.isArray(batch)) throw new Error('Respuesta inválida');
                rows.push(...batch);
                if (batch.length < 500) return rows.filter(r => ns.courses[r.course_key] && Number(r.week_number) >= 1 && Number(r.week_number) <= 16);
            }
        }
        async refresh() {
            if (this.pending) return this.pending;
            this.pending = (async () => {
                const results = await Promise.allSettled(['materials', 'galleries'].map(table => this.readTable(table)));
                ['materials', 'galleries'].forEach((table, i) => {
                    this.available[table] = results[i].status === 'fulfilled';
                    this[table] = this.available[table] ? results[i].value : [];
                });
                return {...this.available};
            })();
            try { return await this.pending; } finally { this.pending = null; }
        }
        resolve(question) {
            const query = normalize(question).replace(/^[¿¡\s]+/, '').trim();
            const algorithm = /algoritm|estructuras? de datos|curso\s*(?:0?1|uno)|primer curso/.test(query);
            const development = /desarrollo|taller|aplicaciones\s+i\b|curso\s+(?:de\s+)?aplicaciones|curso\s*(?:0?2|dos)|segundo curso|^(?:de\s+)?aplicaciones[?!.\s]*$/.test(query);
            let course = algorithm && !development ? 'algoritmos' : development && !algorithm ? 'desarrollo' : null;
            const explicitBoth = (algorithm && development) || /ambos|los dos|los cursos|mis cursos|que cursos|cuales.*cursos/.test(query);
            const explicitWeek = extractNumber(query, 'semana');
            let unit = extractNumber(query, 'unidad');
            const followup = query.match(/^(?:y\s+)?(?:en\s+)?(?:la|el)\s+(\d+)\s*[?!.]*$/);
            const week = explicitWeek ?? (followup ? Number(followup[1]) : null);
            if (!course && !explicitBoth && /^(y\b|tambien\b)|\b(ese curso|esa semana|esta semana|del mismo|de ese|ahi)\b/.test(query)) course = this.context.course || null;
            // Una semana/unidad sin curso se aclara, salvo que la conversación ya fijara uno.
            if (!course && !explicitBoth && (week !== null || unit !== null)) course = this.context.course || null;
            let effectiveWeek = week;
            if (effectiveWeek === null && /esa semana|esta semana|ahi/.test(query)) effectiveWeek = this.context.week || null;
            const continueScope = /^(?:[¿?\s]*)?(y\b|tambien\b)|\b(esa unidad|esta unidad|sus materiales)\b/.test(query);
            if (!explicitBoth && continueScope && !week && !unit && !/completo|todos|todas|todo el curso/.test(query)) {
                effectiveWeek = this.context.week || null;
                unit = effectiveWeek ? null : this.context.unit || null;
            }
            const filtered = this.catalog.filter(row => (!course || row.course === course) && (effectiveWeek === null || row.week === effectiveWeek) && (unit === null || row.unit === unit));
            const queryTerms = terms(query).filter(term => !['algoritmos','algoritmo','estructuras','estructura','datos','desarrollo','aplicaciones','aplicacion','taller'].includes(term));
            const ranked = filtered.map(row => ({...row, score: score(queryTerms, row.title + ' ' + row.program + ' ' + row.aliases + ' ' + row.portfolioTitle)})).sort((a, b) => b.score - a.score);
            return {query, course, week: effectiveWeek, unit, explicitBoth, queryTerms, ranked};
        }
        async ask(question) {
            if (/^¿?\s*cuanto me mide el tilin[?!.]*$/.test(normalize(question).trim().replace(/\s+/g, ' '))) {
                return {text: 'Mira, lamento informarte que la ciencia acaba de confirmar que tu "tilín" es tan microscópico que los físicos cuánticos todavía están usando tecnología de punta solo para intentar encontrar el diminuto átomo que lo conforma; en cambio, al dueño de este chat le mide tanto que hace rato dejó en ridículo a la Torre Eiffel, atravesó la estratosfera sin frenos y ahorita mismo la NASA está considerando seriamente usarlo como puente espacial para mandar satélites más allá de la atmósfera terrestre.'};
            }
            await this.loadCatalog();
            const q = this.resolve(question);
            const {query, course, week, unit} = q;
            if (week !== null && (week < 1 || week > 16) || unit !== null && (unit < 1 || unit > 4)) return {text: 'Cada curso tiene 16 semanas y 4 unidades. Indica una semana entre 1 y 16 o una unidad entre I y IV.'};
            if (course) this.context = {course, week, unit};
            if (/esa semana|esta semana/.test(query) && week === null) return {text: '¿Qué semana quieres consultar? Indica un número entre 1 y 16' + (course ? ' de ' + ns.courses[course].name : ' y el curso') + '.'};
            if ((week !== null || unit !== null) && !course && !q.explicitBoth) {
                const scope = week !== null ? 'Semana ' + week : 'Unidad ' + unit;
                return {text: '¿De qué curso: Algoritmos y Estructuras de Datos o Desarrollo de Aplicaciones I?', suggestions: [scope + ' de Algoritmos', scope + ' de Desarrollo']};
            }
            if (/^(hola|buenas|buenos dias|buenas tardes|buenas noches|gracias|muchas gracias)[\s!?.]*$/.test(query)) return {text: /gracias/.test(query) ? '¡Con gusto! Puedes seguir preguntándome sobre tus cursos.' : '¡Hola! Soy tu asistente académico. Busco actividades reales, consulto los sílabos y explico conceptos de tus dos cursos.', suggestions: ['¿Qué cursos hay?', 'Actividades publicadas', 'Explícame las pilas']};
            if (/\bmis?\s+(notas?|calificaciones?|contrasenas?|claves?|credenciales?|asistencias?)\b/.test(query)) return {text: 'No tengo acceso a datos personales, notas ni credenciales. Consulta tu información en la Intranet oficial de UPLA.', links: [{label: 'Intranet UPLA', url: 'https://intranet.upla.edu.pe/sesion'}]};
            if (/intranet|outlook|correo|accesos upla/.test(query)) return {text: 'Estos accesos abren las páginas oficiales en una pestaña nueva. El portafolio solo redirige; no recibe credenciales.', links: [{label: 'Intranet UPLA', url: 'https://intranet.upla.edu.pe/sesion'}, {label: 'Correo Outlook', url: 'https://outlook.cloud.microsoft/mail/'}]};
            if (/\b(login|administrador|administracion|subir|publicar)\b/.test(query) && !/publicad/.test(query)) return {text: 'El acceso LOGIN permite al administrador autorizado gestionar los materiales y las galerías de cada semana. Para consultar lo publicado no necesitas iniciar sesión.', links: [{label: 'Acceso de administrador', url: 'login.html'}]};
            const published = /actividades?|publicad|material|galeri|archivos?|evidenci|trabajos?|pdf|imagen|foto|video|descarg|subid|publicacion|ejercicios?|practic|proyecto|documento|enlace|recurso/.test(query);
            const explain = /explic|que (?:es|son|significa|aplicaciones|usos)|como (?:funcion|se |usar|crear|hacer)|diferencia|compara|ejemplo|para que/.test(query);
            const thematic = /silabo|temario|programad|previsto/.test(query);
            if (explain) {
                const concept = ns.concepts.filter(r => (!course || r.course === course) && (!week || r.week === week))
                    .map(r => ({...r, score: score(terms(query), r.title + ' ' + r.aliases)})).sort((a,b) => b.score-a.score)[0];
                if (concept && concept.score > 0 && concept.score >= (q.ranked[0]?.score || 0) && !/actividad|publicad|galeri|material|archivo/.test(query)) return this.academicAnswer([concept]);
            }
            if (published && !thematic && !(explain && q.ranked[0]?.score > 0 && !/actividad|publicad|galeri|material|evidenci/.test(query))) {
                await this.refresh();
                return this.publishedAnswer(q);
            }
            if (/quien|autor|pertenece|organiza|portafolio|estudia|carrera|universidad/.test(query) && !/docente|profesor/.test(query) && !course && !week && !unit && !q.ranked[0]?.score) return {text: `Este portafolio pertenece a ${ns.author}, estudiante de ${ns.degree}.\n\nInicio presenta al estudiante. Mis cursos organiza los dos cursos en 4 unidades y 16 semanas cada uno; dentro de las semanas están las galerías y los materiales publicados. Los sílabos describen la programación académica.`, links: [{label: 'Inicio', url: 'index.html'}, {label: 'Explorar los cursos', url: 'cursos.html'}]};
            if (explain && q.ranked[0]?.score > 0) {
                // El lenguaje contextualiza la explicación; el concepto determina el tema.
                const topicTerms = q.queryTerms.filter(term => term !== 'java');
                const academicRows = topicTerms.length ? q.ranked.map(r => ({...r, score: score(topicTerms, r.title + ' ' + r.program + ' ' + r.aliases + ' ' + r.portfolioTitle)})).sort((a,b) => b.score-a.score) : q.ranked;
                const selected = academicRows.filter(r => r.score > 0 && r.score >= academicRows[0].score * .75).slice(0, /diferencia|compara/.test(query) ? 3 : 2);
                if (!selected.length) return this.unknown(course);
                if (selected.every(r => r.course === selected[0].course)) this.context = {course: selected[0].course, week: selected.length === 1 ? selected[0].week : null, unit: null};
                const result = this.academicAnswer(selected);
                return this.respond(question, result, selected);
            }
            const extras = ns.extra.filter(r => (!course || r.course === course) && (!unit || !r.unit || r.unit === unit))
                .map(r => ({...r, score: score(q.queryTerms, r.title + ' ' + r.text)})).filter(r => r.score > 0).sort((a,b) => b.score-a.score);
            if (/investigacion|responsabilidad|social|rsu/.test(query) && extras.length) return {text: 'Según los sílabos (actividades programadas):\n\n' + extras.slice(0,4).map(r => ns.courses[r.course].name + ' — ' + r.title + ': ' + r.text).join('\n\n'), links: this.syllabusLinks(course), note: 'Esto no acredita su entrega o publicación en el portafolio.'};
            if (/docente|profesor|creditos|horas?|codigo|periodo|semestre|fecha/.test(query)) return {text: `Según los sílabos: docente ${ns.teacher}. Período ${ns.period}.\n\n` + Object.entries(ns.courses).filter(([key]) => !course || key === course).map(([,data]) => `${data.name}: código ${data.code}, ${data.credits} crédito(s), ${data.hours}.`).join('\n'), links: this.syllabusLinks(course)};
            if (week || unit || thematic || /\b(temas?|unidades?|semanas?)\b/.test(query) || q.ranked[0]?.score > 0) {
                const ranked = q.queryTerms.length && q.ranked[0]?.score > 0 ? q.ranked.filter(r => r.score > 0).slice(0,8) : q.ranked;
                if (!ranked.length) return this.unknown(course);
                const result = {text: 'Programación académica según los sílabos adjuntos:',
                    items: ranked.map(r => ({label: `${ns.courses[r.course].name} · Unidad ${r.unit} · Semana ${r.week}: ${r.title}`, detail: r.program, url: courseLink(r.course, r.week)})),
                    links: this.syllabusLinks(course), note: 'Temas previstos, no actividades confirmadas como publicadas. Pregunta por «actividades publicadas» para verificarlas.'};
                return this.respond(question, result, ranked);
            }
            if (course || /cursos?|ayuda|puedes|ayudar/.test(query)) return {text: Object.entries(ns.courses).filter(([key]) => !course || key === course).map(([,data]) => `${data.name}\n${data.summary}\n4 unidades: ${data.units.map((u,i) => `${i+1}. ${u}`).join('; ')}.\n16 semanas.`).join('\n\n'), links: Object.keys(ns.courses).filter(key => !course || key === course).map(key => ({label: 'Ver ' + ns.courses[key].name, url: courseLink(key)})), suggestions: ['Actividades publicadas' + (course ? ' de ' + ns.courses[course].name : ''), 'Temario' + (course ? ' de ' + ns.courses[course].name : '')]};
            // Un nombre nuevo puede existir en Supabase sin figurar en el temario local.
            if (q.queryTerms.length) {
                await this.refresh();
                const found = this.publishedAnswer(q);
                if (found.items.length) return found;
                if (!this.available.materials || !this.available.galleries) return {...this.unknown(course), note: 'No pude verificar todas las fuentes públicas en este momento.'};
            }
            return this.unknown(course);
        }
        syllabusLinks(course) {
            return Object.entries(ns.courses).filter(([key]) => !course || key === course).map(([,data]) => ({label: 'Sílabo: ' + data.name + ' (PDF)', url: data.syllabus}));
        }
        academicAnswer(rows) {
            const sections = rows.flatMap(row => {
                const sentences = (row.explanation || row.text).split(/(?<=[.!?])\s+(?=[\p{L}¿])/u);
                const guide = (row.text ? ns.studyGuides.concepts[row.title] : ns.studyGuides[row.course]?.[row.week - 1]) || [];
                return [
                    {title: rows.length > 1 ? row.title + ' · Qué es' : 'Qué es', text: sentences[0]},
                    ...(sentences.length > 1 ? [{title: 'Cómo funciona', text: sentences.slice(1).join(' ')}] : []),
                    ...(guide[0] ? [{title: 'Ejemplo práctico', text: guide[0], code: guide[2]}] : []),
                    ...(guide[1] ? [{title: 'Para qué sirve', text: guide[1]}] : [])
                ];
            });
            return {heading: rows.map(r => r.title).join(' y '), sections,
                text: sections.map(s => s.title + '\n' + s.text + (s.code ? '\n' + s.code : '')).join('\n\n'),
                items: rows.map(r => ({label: ns.courses[r.course].name + ' · Semana ' + r.week, url: courseLink(r.course, r.week), detail: r.program || ns.courses[r.course].weeks[r.week - 1][1], badge: 'REFERENCIA DEL SÍLABO'})),
                note: 'Ejemplos didácticos, no entregas publicadas. El sílabo programa el tema; las actividades publicadas se verifican por separado.'};
        }
        publishedAnswer(q) {
            const {course, week, unit, queryTerms} = q;
            const scope = r => (!course || r.course_key === course) && (!week || Number(r.week_number) === week) && (!unit || Math.ceil(Number(r.week_number) / 4) === unit);
            const materials = this.materials.filter(scope);
            const galleries = this.galleries.filter(scope);
            const galleryById = new Map(galleries.map(g => [String(g.id), g]));
            const specific = queryTerms.filter(w => !['publico','publicos','lista','actividades'].includes(w));
            const activityNumber = q.query.match(/\bactividad\s*(\d+)\b/)?.[1];
            const galleryScore = g => score(specific, g.name + ' ' + (g.description || ''));
            const matches = g => (!specific.length || galleryScore(g) > 0) && (!activityNumber || new RegExp('actividad\\s*0?' + activityNumber + '\\b').test(normalize(g.name)));
            const foundGalleries = galleries.filter(matches);
            let foundMaterials = materials.filter(m => {
                const gallery = galleryById.get(String(m.gallery_id));
                return (!specific.length || score(specific, m.name + ' ' + (m.description || '') + ' ' + (gallery?.name || '') + ' ' + (gallery?.description || '')) > 0)
                    && (!activityNumber || (gallery && matches(gallery)) || new RegExp('actividad\\s*0?' + activityNumber + '\\b').test(normalize(m.name)));
            });
            const recent = /recient|ultim|nuevo/.test(q.query);
            const rank = (a,b) => recent ? String(b.created_at || '').localeCompare(String(a.created_at || '')) : score(specific, b.name + ' ' + (b.description || '')) - score(specific, a.name + ' ' + (a.description || ''));
            foundGalleries.sort(rank);
            foundMaterials.sort(rank);
            const wantFiles = /archivo|material|pdf|imagen|foto|video|descarg/.test(q.query);
            if (/\bpdf\b/.test(q.query)) foundMaterials = foundMaterials.filter(m => /\.pdf(?:$|\?)/i.test(m.file_url || m.external_url || '') || /\bpdf\b/i.test(m.name));
            if (/imagen|foto/.test(q.query)) foundMaterials = foundMaterials.filter(m => /\.(png|jpe?g|webp|gif)(?:$|\?)/i.test(m.file_url || m.external_url || '') || /imagen|foto|captura/i.test(m.name));
            const sourceRows = wantFiles ? foundMaterials : [...foundGalleries, ...foundMaterials.filter(m => !foundGalleries.some(g => String(g.id) === String(m.gallery_id)))];
            if (recent) sourceRows.sort(rank);
            const items = sourceRows.slice(0,8).map(row => {
                const isGallery = !('material_type' in row);
                const publicURL = !isGallery && safeURL(row.external_url || row.file_url);
                const count = isGallery ? materials.filter(m => String(m.gallery_id) === String(row.id)).length : 0;
                const meta = `${ns.courses[row.course_key].name} · Semana ${row.week_number}${isGallery && this.available.materials ? ' · ' + count + ' materiales' : ''}`;
                return {label: row.name, detail: `${meta}${row.description ? '\n' + row.description : ''}`, meta, summary: row.description || 'Esta publicación no incluye una descripción. Abre el enlace para consultar su contenido.', badge: isGallery ? 'GALERÍA / ACTIVIDAD PUBLICADA' : 'MATERIAL PUBLICADO',
                    url: publicURL || courseLink(row.course_key, Number(row.week_number), isGallery ? row.id : row.gallery_id),
                    secondary: publicURL ? {label: 'Ver en su semana', url: courseLink(row.course_key, Number(row.week_number), row.gallery_id)} : null};
            });
            const failures = [];
            if (!this.available.materials) failures.push('No pude verificar los materiales de Supabase.');
            if (!this.available.galleries) failures.push('No pude verificar las galerías de Supabase.');
            const scopeText = (course ? ' de ' + ns.courses[course].name : '') + (week ? ', semana ' + week : '') + (unit ? ', unidad ' + unit : '');
            const counts = [this.available.galleries ? foundGalleries.length + ' galerías/actividades' : '', this.available.materials ? foundMaterials.length + ' materiales' : ''].filter(Boolean).join(' y ');
            return {text: items.length ? `Publicaciones verificadas ahora${scopeText}: ${counts}${specific.length ? ' coincidentes' : ''}.` : failures.length ? 'No puedo confirmar todas las publicaciones en este momento.' : `No encontré publicaciones${scopeText}${specific.length ? ' que coincidan con tu búsqueda' : ''}. Esto no significa que el tema no esté programado.`, items,
                note: [...failures, sourceRows.length > 8 ? `Muestro 8 de ${sourceRows.length} resultados; precisa una semana o un nombre para acotar la búsqueda.` : '', 'Se consultan nombres, descripciones y enlaces públicos; no se analiza el contenido interno de los archivos.'].filter(Boolean).join(' '),
                links: [{label: 'Explorar publicaciones en los cursos', url: course ? courseLink(course, week) : 'cursos.html'}]};
        }
        async respond(question, result, evidence) {
            // Un adaptador futuro recibirá solo evidencia seleccionada y la pregunta, nunca claves o sesiones.
            if (!this.responder) return result;
            try { return await this.responder({question, evidence: evidence.slice(0,8), localAnswer: result}); }
            catch (_) { return result; }
        }
        unknown(course) {
            return {text: 'No tengo información suficiente para responder eso con seguridad. Puedo buscar publicaciones por nombre, curso o semana, consultar los temarios y explicar conceptos incluidos en estos cursos.', links: this.syllabusLinks(course), suggestions: ['¿Qué cursos hay?', 'Actividades publicadas']};
        }
    }
    Object.assign(ns, {Assistant, normalize, safeURL, courseLink});
})();
