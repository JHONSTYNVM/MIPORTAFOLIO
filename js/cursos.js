document.addEventListener('DOMContentLoaded', async () => {

    const selectors = document.querySelectorAll('.curso-selector');
    const panels = document.querySelectorAll('.curso-panel');
    const searchInput = document.getElementById('busqueda-materiales');
    const filterButtons = document.querySelectorAll('.filtro');
    const adminBar = document.getElementById('admin-bar');
    const dialog = document.getElementById('material-dialog');
    const form = document.getElementById('material-form');
    const typeSelect = document.getElementById('material-type');
    const fileField = document.getElementById('file-field');
    const urlField = document.getElementById('url-field');
    const messageEl = document.getElementById('material-message');

    const cfg = window.PORTAFOLIO_SUPABASE || {};

    const configured = Boolean(
        cfg.url &&
        cfg.anonKey &&
        window.supabase
    );

    const supabaseClient = configured
        ? window.supabase.createClient(
            cfg.url,
            cfg.anonKey
        )
        : null;


    let filtroActual = 'todos';
    let isAdmin = false;
    let materiales = [];
    let galerias = [];
    let galleriesReady = false;
    let galleriesError = 'Las galerías todavía no están disponibles.';


    /* =====================================================
       FUNCIONES GENERALES
       ===================================================== */

    function normalizar(texto) {

        return (texto || '')
            .toString()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();

    }


    function escapeHTML(value) {

        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');

    }


    function formatBytes(bytes) {

        if (!bytes) return '';

        const units = [
            'B',
            'KB',
            'MB',
            'GB'
        ];

        let value = Number(bytes);
        let i = 0;

        while (
            value >= 1024 &&
            i < units.length - 1
        ) {
            value /= 1024;
            i++;
        }

        return `${value.toFixed(
            value >= 10 || i === 0 ? 0 : 1
        )} ${units[i]}`;

    }


    function iconFor(material) {

        if (
            material.material_type === 'url'
        ) {
            return '🔗';
        }

        const mime = material.mime_type || '';
        const name = (
            material.name || ''
        ).toLowerCase();


        if (
            mime.includes('pdf') ||
            name.endsWith('.pdf')
        ) {
            return '📕';
        }


        if (
            mime.includes('word') ||
            /\.docx?$/.test(name)
        ) {
            return '📝';
        }


        if (
            mime.includes('sheet') ||
            /\.xlsx?$/.test(name)
        ) {
            return '📊';
        }


        if (
            mime.includes('presentation') ||
            /\.pptx?$/.test(name)
        ) {
            return '📽️';
        }


        if (
            mime.startsWith('image/')
        ) {
            return '🖼️';
        }


        if (
            mime.startsWith('video/')
        ) {
            return '🎥';
        }


        if (
            mime.includes('zip') ||
            mime.includes('rar') ||
            /\.(zip|rar|7z)$/.test(name)
        ) {
            return '🗜️';
        }


        if (
            mime.includes('javascript') ||
            mime.includes('java') ||
            mime.includes('text/')
        ) {
            return '💻';
        }


        return '📄';

    }


    function materialViewUrl(material) {

        const url =
            material.external_url ||
            material.file_url;

        if (!url) return '';

        return url;

    }


    /* =====================================================
       MOSTRAR MATERIALES
       ===================================================== */

    function renderMaterial(material) {
        const viewUrl = materialViewUrl(material);
        const downloadUrl = material.file_url || material.external_url || '';
        const meta = [material.material_type === 'url' ? 'Enlace externo' : 'Archivo',
            formatBytes(material.file_size)].filter(Boolean).join(' · ');
        return '<article class="material-item">' +
            '<div class="material-icono" aria-hidden="true">' + iconFor(material) + '</div>' +
            '<div class="material-info"><h5>' + escapeHTML(material.name) + '</h5>' +
            (material.description ? '<p class="material-description">' + escapeHTML(material.description) + '</p>' : '') +
            '<span class="material-meta">' + escapeHTML(meta) + '</span></div>' +
            '<div class="material-acciones">' +
            (viewUrl ? '<a href="' + escapeHTML(viewUrl) + '" target="_blank" rel="noopener">👁 Visualizar</a>' : '') +
            (downloadUrl ? '<button type="button" class="material-download" data-url="' + escapeHTML(downloadUrl) + '" data-name="' + escapeHTML(material.name || 'material') + '">↓ Descargar</button>' : '') +
            (isAdmin ? '<button type="button" data-gallery-action="assign" data-id="' + escapeHTML(material.id) + '" ' + (galleriesReady ? '' : 'disabled') + '>Cambiar galería</button>' +
                '<button type="button" class="material-delete" data-id="' + escapeHTML(material.id) + '">🗑 Eliminar</button>' : '') +
            '</div></article>';
    }

    function renderGallery(gallery, items) {
        return '<section class="gallery-block" data-gallery-id="' + escapeHTML(gallery.id) + '">' +
            '<header class="gallery-heading"><span class="gallery-kicker">GALERÍA / ACTIVIDAD</span>' +
            '<h4>' + escapeHTML(gallery.name) + '</h4>' +
            (gallery.description ? '<p>' + escapeHTML(gallery.description) + '</p>' : '') +
            '<span class="gallery-count">' + items.length + ' materiales</span>' +
            (isAdmin && galleriesReady ? '<div class="gallery-admin-actions">' +
                '<button type="button" data-gallery-action="edit" data-id="' + escapeHTML(gallery.id) + '">Editar galería</button>' +
                '<button type="button" data-gallery-action="delete" data-id="' + escapeHTML(gallery.id) + '">Eliminar galería</button></div>' : '') +
            '</header><div class="gallery-materials">' + (items.length ? items.map(renderMaterial).join('') :
                '<p class="materiales-vacios">Aún no hay materiales en esta galería.</p>') + '</div></section>';
    }

    function renderMaterials() {
        document.querySelectorAll('.semana[data-course][data-week]').forEach(semana => {
            const course = semana.dataset.course;
            const week = Number(semana.dataset.week);
            const list = materiales.filter(m => m.course_key === course &&
                Number(m.week_number) === week && m.published !== false);
            const weekGalleries = galerias.filter(g => g.course_key === course && Number(g.week_number) === week);
            const ids = new Set(weekGalleries.map(g => String(g.id)));
            // Conservar visibles los registros antiguos y asignaciones aún no disponibles.
            const unassigned = list.filter(m => !m.gallery_id || !ids.has(String(m.gallery_id)));
            const counter = semana.querySelector('.archivo-contador');
            if (counter) counter.textContent = list.length;
            semana.dataset.files = list.length;
            const content = semana.querySelector('.materiales-contenido');
            if (!content) return;
            content.innerHTML = weekGalleries.map(g => renderGallery(g,
                list.filter(m => String(m.gallery_id) === String(g.id)))).join('');
            if (unassigned.length) {
                content.innerHTML += '<section class="gallery-block gallery-unassigned">' +
                    '<header class="gallery-heading"><h4>Materiales sin galería</h4></header>' +
                    '<div class="gallery-materials">' + unassigned.map(renderMaterial).join('') + '</div></section>';
            } else if (!weekGalleries.length) {
                content.innerHTML = '<p class="materiales-vacios">' + (isAdmin
                    ? 'No hay materiales todavía. Usa “Agregar material” para publicar el primero.'
                    : 'Aún no hay materiales publicados en esta semana.') + '</p>';
            }
        });

        const totalEl =
            document.getElementById(
                'total-archivos'
            );


        if (totalEl) {
            totalEl.textContent =
                materiales.length;
        }


        document
            .querySelectorAll(
                '.material-delete'
            )
            .forEach(btn => {

                btn.addEventListener(
                    'click',
                    () =>
                        eliminarMaterial(
                            btn.dataset.id
                        )
                );

            });
            document
    .querySelectorAll('.material-download')
    .forEach(btn => {

        btn.addEventListener(
            'click',
            async () => {

                const url =
                    btn.dataset.url;

                const fileName =
                    btn.dataset.name ||
                    'material';

                if (!url) {

                    alert(
                        '❌ No se encontró el archivo.'
                    );

                    return;
                }

                const textoOriginal =
                    btn.textContent;

                btn.disabled = true;

                btn.textContent =
                    '⏳ Descargando...';

                try {

                    const response =
                        await fetch(url);

                    if (!response.ok) {

                        throw new Error(
                            'No se pudo obtener el archivo.'
                        );

                    }

                    const blob =
                        await response.blob();

                    const blobUrl =
                        window.URL.createObjectURL(
                            blob
                        );

                    const enlace =
                        document.createElement(
                            'a'
                        );

                    enlace.href =
                        blobUrl;

                    enlace.download =
                        fileName;

                    document.body.appendChild(
                        enlace
                    );

                    enlace.click();

                    enlace.remove();

                    window.URL.revokeObjectURL(
                        blobUrl
                    );

                } catch (error) {

                    console.error(
                        'Error descargando:',
                        error
                    );

                    alert(
                        '❌ No se pudo descargar el archivo.'
                    );

                } finally {

                    btn.disabled = false;

                    btn.textContent =
                        textoOriginal;

                }

            }
        );

    });

    }


    /* =====================================================
       BUSCADOR Y FILTROS
       ===================================================== */

    function aplicarBusqueda() {

        const termino =
            normalizar(
                searchInput?.value || ''
            );


        const panelActivo =
            document.querySelector(
                '.curso-panel.activo'
            );


        if (!panelActivo) return;


        let resultados = 0;


        panelActivo
            .querySelectorAll('.unidad')
            .forEach(unidad => {

                let unidadTieneResultado =
                    false;


                unidad
                    .querySelectorAll('.semana')
                    .forEach(semana => {

                        const course =
                            semana.dataset.course;

                        const week =
                            Number(
                                semana.dataset.week
                            );


                        const list =
                            materiales.filter(
                                m =>
                                    m.course_key === course &&
                                    Number(m.week_number) === week
                            );


                        const texto =
                            normalizar(
                                `${semana.textContent}
                                ${list.map(
                                    m =>
                                        `${m.name}
                                        ${m.description || ''}`
                                ).join(' ')}`
                            );


                        const coincideTexto =
                            !termino ||
                            texto.includes(termino);


                        const coincideFiltro =
                            filtroActual === 'todos' ||

                            (
                                filtroActual ===
                                'con-materiales' &&
                                list.length > 0
                            ) ||

                            (
                                filtroActual ===
                                'sin-materiales' &&
                                list.length === 0
                            );


                        const mostrar =
                            coincideTexto &&
                            coincideFiltro;


                        semana.classList.toggle(
                            'oculta-por-busqueda',
                            !mostrar
                        );


                        if (mostrar) {

                            unidadTieneResultado =
                                true;

                            resultados++;

                        }

                    });


                unidad.classList.toggle(
                    'oculta-por-busqueda',
                    !unidadTieneResultado
                );

            });


        let aviso =
            panelActivo.querySelector(
                '.sin-resultados'
            );


        if (!aviso) {

            aviso =
                document.createElement(
                    'div'
                );

            aviso.className =
                'sin-resultados';

            aviso.textContent =
                'No encontramos semanas o materiales que coincidan con tu búsqueda.';


            panelActivo
                .querySelector('.unidades')
                ?.after(aviso);

        }


        aviso.classList.toggle(
            'visible',
            resultados === 0
        );

    }


    /* =====================================================
       CARGAR MATERIALES DESDE SUPABASE
       ===================================================== */

    async function cargarMateriales() {

        if (!supabaseClient) {

            renderMaterials();
            aplicarBusqueda();

            return;

        }


        const {
            data,
            error
        } = await supabaseClient
            .from('materials')
            .select('*')
            .eq('published', true)
            .order(
                'sort_order',
                {
                    ascending: true
                }
            )
            .order(
                'created_at',
                {
                    ascending: true
                }
            );


        if (!error) {

            materiales =
                data || [];

        } else {

            console.error(
                'Error cargando materiales:',
                error
            );

        }


        renderMaterials();
        aplicarBusqueda();

    }


    /* =====================================================
       COMPROBAR ADMINISTRADOR
       
       IMPORTANTE:
       Ahora usamos la función RPC
       is_portfolio_admin()
       ===================================================== */

    async function comprobarAdministrador() {

        if (!supabaseClient) {

            console.warn(
                'Supabase no está configurado.'
            );

            return;

        }


        /* Obtener sesión */

        const {
            data: sessionData,
            error: sessionError
        } = await supabaseClient.auth.getSession();


        if (sessionError) {

            console.error(
                'Error obteniendo sesión:',
                sessionError
            );

            return;

        }


        const session =
            sessionData?.session;


        if (!session) {

            console.log(
                'No existe una sesión administrativa.'
            );

            return;

        }


        console.log(
            'Usuario conectado:',
            session.user.email
        );


        console.log(
            'ID del usuario:',
            session.user.id
        );


        /* ==========================================
           COMPROBAR ADMINISTRADOR MEDIANTE RPC
           ========================================== */

        const {
            data: adminResult,
            error: adminError
        } = await supabaseClient.rpc(
            'is_portfolio_admin'
        );


        if (adminError) {

            console.error(
                'Error verificando administrador:',
                adminError
            );

            return;

        }


        console.log(
            'Resultado administrador:',
            adminResult
        );


        /* ==========================================
           SI NO ES ADMINISTRADOR
           ========================================== */

        if (!adminResult) {

            console.log(
                'El usuario no es administrador.'
            );

            return;

        }


        /* ==========================================
           ADMINISTRADOR CONFIRMADO
           ========================================== */

        isAdmin = true;
        document.querySelectorAll('.week-admin-actions').forEach(el => { el.hidden = false; });


        document.body.classList.add(
            'modo-admin'
        );


        /* Mostrar barra de administrador */

        if (adminBar) {

            adminBar.hidden = false;


            adminBar.innerHTML = `

                <div>

                    <span class="admin-dot"></span>

                    <strong>
                        Modo administrador activo
                    </strong>

                    <small>
                        Los cambios se guardan
                        en la base de datos.
                    </small>

                </div>


                <button type="button" data-gallery-action="create" disabled>＋ Crear galería</button>
                <p id="galleries-status" class="galleries-status" role="status"></p>
                <button
                    id="admin-logout"
                    type="button"
                >
                    Cerrar sesión
                </button>

            `;

        }


        /* ==========================================
           BOTONES AGREGAR MATERIAL
           ========================================== */

        document
            .querySelectorAll(
                '.admin-add-material'
            )
            .forEach(btn => {

                btn.hidden = false;


                btn.addEventListener(
                    'click',
                    () =>
                        abrirDialog(
                            btn.dataset.course,
                            btn.dataset.week
                        )
                );

            });


        /* Actualizar pantalla */

        renderMaterials();
        aplicarBusqueda();


        /* ==========================================
           CERRAR SESIÓN ADMINISTRATIVA
           ========================================== */

        document
            .getElementById(
                'admin-logout'
            )
            ?.addEventListener(
                'click',
                async () => {

                    await supabaseClient
                        .auth
                        .signOut();


                    window.location.reload();

                }
            );

    }


    /* =====================================================
       ABRIR VENTANA PARA AGREGAR MATERIAL
       ===================================================== */

    function abrirDialog(course, week) {

        if (!dialog) return;


        form.reset();


        document.getElementById(
            'material-course'
        ).value = course;


        document.getElementById(
            'material-week'
        ).value = week;


        const semana =
            document.querySelector(
                `.semana[data-course="${course}"][data-week="${week}"]`
            );


        const titulo =
            semana?.querySelector('h3')
                ?.textContent ||
            `Semana ${week}`;


        document.getElementById(
            'material-location'
        ).textContent =

            `${
                course === 'algoritmos'
                ? 'Algoritmos y Estructuras de Datos'
                : 'Desarrollo de Aplicaciones I'
            }
            · Semana ${String(week).padStart(2, '0')}
            · ${titulo}`;


        messageEl.textContent = '';


        typeSelect.value =
            'archivo';


        fileField.hidden =
            false;


        urlField.hidden =
            true;


        syncMaterialLocation(course, week);
        syncMaterialType();
        dialog.showModal();

    }


    /* =====================================================
       CAMBIAR ENTRE ARCHIVO Y URL
       ===================================================== */

    function syncMaterialType() {
        const url = typeSelect.value === 'url';
        fileField.hidden = url;
        urlField.hidden = !url;
        document.getElementById('material-file').required = !url;
        document.getElementById('material-file').disabled = url;
        document.getElementById('material-url').required = url;
        document.getElementById('material-url').disabled = !url;
    }
    typeSelect?.addEventListener('change', syncMaterialType);
    dialog.addEventListener('cancel', event => {
        if (form.dataset.busy === 'true') event.preventDefault();
    });

    /* =====================================================
       CERRAR DIALOG
       ===================================================== */

    document
        .getElementById(
            'dialog-close'
        )
        ?.addEventListener(
            'click',
            () => { if (form.dataset.busy !== 'true') dialog.close(); }
        );


    document
        .getElementById(
            'dialog-cancel'
        )
        ?.addEventListener(
            'click',
            () => { if (form.dataset.busy !== 'true') dialog.close(); }
        );


    /* =====================================================
       GUARDAR MATERIAL
       ===================================================== */

    form?.addEventListener(
        'submit',
        async event => {

            event.preventDefault();
            if (form.dataset.busy === 'true') return;


            if (
                !isAdmin ||
                !supabaseClient
            ) {

                messageEl.textContent =
                    'Debes iniciar sesión como administrador y configurar Supabase.';

                return;

            }


const course =
                document.getElementById(
                    'material-course'
                ).value;


            const week =
                Number(
                    document.getElementById(
                        'material-week'
                    ).value
                );


            const name =
                document.getElementById(
                    'material-name'
                ).value.trim();


            const description =
                document.getElementById(
                    'material-description'
                ).value.trim();


            const type = typeSelect.value;
            const galleryId = document.getElementById('material-gallery').value || null;
            if (galleryId && (!galleriesReady || !galerias.some(g => g.id === galleryId && g.course_key === course && Number(g.week_number) === week))) {
                messageEl.textContent = 'Selecciona una galería válida para este curso y semana.';
                return;
            }
            const galleryFields = galleriesReady ? { gallery_id: galleryId } : {};


            // Capturar la selección antes de cualquier espera y bloquear cambios durante la subida.
            const selectedFiles = Array.from(document.getElementById('material-file').files || []);
            const selectedUrl = document.getElementById('material-url').value.trim();
            const controls = Array.from(form.elements).map(el => [el, el.disabled]);
            form.dataset.busy = 'true';
            controls.forEach(([el]) => { el.disabled = true; });
            messageEl.textContent = type === 'url' ? 'Guardando enlace...' : 'Subiendo material...';

            try {
                const { data: userData, error: userError } = await supabaseClient.auth.getUser();
                const user = userData?.user;
                if (userError || !user) throw new Error('La sesión administrativa ha terminado.');

                /* ======================================
                   GUARDAR ENLACE
                   ====================================== */

                if (type === 'url') {

                    const externalUrl = selectedUrl;


                    if (!externalUrl) {

                        throw new Error(
                            'Coloca una URL válida.'
                        );

                    }


                    const insert =
                        await supabaseClient
                            .from('materials')
                            .insert({
                                ...galleryFields,

                                course_key:
                                    course,

                                week_number:
                                    week,

                                name:
                                    name,

                                description:
                                    description || null,

                                material_type:
                                    'url',

                                external_url:
                                    externalUrl,

                                created_by:
                                    user.id

                            })
                            .select()
                            .single();


                    if (insert.error) {

                        throw insert.error;

                    }


                    materiales.push(
                        insert.data
                    );

                }


                /* ======================================
                   SUBIR ARCHIVOS
                   ====================================== */

                else {

                    const files = selectedFiles;


                    if (!files.length) {

                        throw new Error(
                            'Selecciona al menos un archivo.'
                        );

                    }


                    for (
                        let i = 0;
                        i < files.length;
                        i++
                    ) {

                        const file =
                            files[i];


                        messageEl.textContent =
                            `Subiendo ${i + 1} de ${files.length}: ${file.name}`;


                        const safeName =
                            file.name
                                .normalize('NFD')
                                .replace(
                                    /[\u0300-\u036f]/g,
                                    ''
                                )
                                .replace(
                                    /[^a-zA-Z0-9._-]+/g,
                                    '-'
                                );


                        const storagePath =

                            `${course}/semana-${String(
                                week
                            ).padStart(2, '0')}/${
                                Date.now()
                            }-${
                                Math.random()
                                    .toString(36)
                                    .slice(2, 8)
                            }-${safeName}`;


                        /* Subir archivo */

                        const upload =
                            await supabaseClient
                                .storage
                                .from('materiales')
                                .upload(
                                    storagePath,
                                    file,
                                    {
                                        upsert: false,
                                        contentType:
                                            file.type ||
                                            'application/octet-stream'
                                    }
                                );


                        if (upload.error) {

                            throw upload.error;

                        }


                        /* Obtener URL pública */

                        const publicData =
                            supabaseClient
                                .storage
                                .from('materiales')
                                .getPublicUrl(
                                    storagePath
                                );


                        const fileUrl =
                            publicData
                                .data
                                .publicUrl;


                        const itemName =

                            files.length === 1 &&
                            name

                                ? name

                                : (
                                    name
                                        ? `${name} — ${file.name}`
                                        : file.name
                                );


                        /* Registrar archivo en materials */

                        const insert =
                            await supabaseClient
                                .from('materials')
                                .insert({
                                ...galleryFields,

                                    course_key:
                                        course,

                                    week_number:
                                        week,

                                    name:
                                        itemName,

                                    description:
                                        description ||
                                        null,

                                    material_type:
                                        'archivo',

                                    file_url:
                                        fileUrl,

                                    storage_path:
                                        storagePath,

                                    file_size:
                                        file.size,

                                    mime_type:
                                        file.type ||
                                        null,

                                    created_by:
                                        user.id,

                                    sort_order:
                                        i

                                })
                                .select()
                                .single();


                        if (insert.error) {

                            await supabaseClient
                                .storage
                                .from('materiales')
                                .remove([
                                    storagePath
                                ]);


                            throw insert.error;

                        }


                        materiales.push(
                            insert.data
                        );

                    }

                }


                /* Actualizar pantalla */

                renderMaterials();

                aplicarBusqueda();

                dialog.close();


            } catch (error) {

                console.error(
                    'Error guardando material:',
                    error
                );


                renderMaterials();
                aplicarBusqueda();
                messageEl.textContent =
                    error.message ||
                    'No se pudo guardar el material.';

            } finally {

                controls.forEach(([el, disabled]) => { el.disabled = disabled; });
                delete form.dataset.busy;

            }

        }
    );


   /* =====================================================
   ELIMINAR MATERIAL
   ===================================================== */

async function eliminarMaterial(id) {

    console.log(
        '🗑 Intentando eliminar material:',
        id
    );


    // -----------------------------------------------------
    // Verificar administrador
    // -----------------------------------------------------

    if (
        !isAdmin ||
        !supabaseClient
    ) {

        alert(
            '❌ Debes estar conectado como administrador.'
        );

        return;
    }


    // -----------------------------------------------------
    // Buscar material
    // -----------------------------------------------------

    const material =
        materiales.find(
            m =>
                String(m.id) ===
                String(id)
        );


    if (!material) {

        console.error(
            '❌ No se encontró el material con ID:',
            id
        );

        console.log(
            'Materiales disponibles:',
            materiales
        );

        alert(
            '❌ No se encontró el material.'
        );

        return;
    }


    // -----------------------------------------------------
    // Nombre correcto de la tabla actual
    // -----------------------------------------------------

    const nombre =
        material.name ||
        'este material';


    // -----------------------------------------------------
    // Confirmación
    // -----------------------------------------------------

    const confirmar =
        confirm(
            `¿Eliminar "${nombre}"?\n\n` +
            'El material y su archivo serán eliminados.'
        );


    if (!confirmar) {

        return;
    }


    try {

        // =================================================
        // 1. ELIMINAR ARCHIVO DEL STORAGE
        // =================================================

        if (
            material.storage_path
        ) {

            console.log(
                '🗑 Eliminando archivo:',
                material.storage_path
            );


            const {
                error: storageError
            } =
                await supabaseClient
                    .storage
                    .from('materiales')
                    .remove([
                        material.storage_path
                    ]);


            if (storageError) {

                console.error(
                    '❌ Error eliminando archivo:',
                    storageError
                );

                alert(
                    '❌ No se pudo eliminar el archivo del almacenamiento:\n' +
                    storageError.message
                );

                return;
            }


            console.log(
                '✅ Archivo eliminado del Storage.'
            );

        }


        // =================================================
        // 2. ELIMINAR REGISTRO DE LA TABLA
        // =================================================

        const {
            error: deleteError
        } =
            await supabaseClient
                .from('materials')
                .delete()
                .eq(
                    'id',
                    id
                );


        if (deleteError) {

            console.error(
                '❌ Error eliminando registro:',
                deleteError
            );

            alert(
                '❌ No se pudo eliminar el material:\n' +
                deleteError.message
            );

            return;
        }


        console.log(
            '✅ Registro eliminado de materials.'
        );


        // =================================================
        // 3. ACTUALIZAR ARRAY LOCAL
        // =================================================

        materiales =
            materiales.filter(
                m =>
                    String(m.id) !==
                    String(id)
            );


        // =================================================
        // 4. ACTUALIZAR PANTALLA
        // =================================================

        renderMaterials();

        aplicarBusqueda();


        console.log(
            '✅ Material eliminado completamente.'
        );


        alert(
            '✅ Material eliminado correctamente.'
        );


    } catch (error) {

        console.error(
            '❌ Error eliminando material:',
            error
        );


        alert(
            '❌ Error al eliminar:\n' +
            (
                error.message ||
                error
            )
        );

    }

}

    /* =====================================================
       CAMBIO DE CURSO
       ===================================================== */

    selectors.forEach(
        selector => {

            selector.addEventListener(
                'click',
                () => {

                    const id =
                        selector.dataset.course;


                    selectors.forEach(
                        item =>
                            item.classList.remove(
                                'activo'
                            )
                    );


                    panels.forEach(
                        panel =>
                            panel.classList.remove(
                                'activo'
                            )
                    );


                    selector.classList.add(
                        'activo'
                    );


                    document
                        .getElementById(id)
                        ?.classList.add(
                            'activo'
                        );


                    if (searchInput) {

                        searchInput.value =
                            '';

                    }


                    filtroActual =
                        'todos';


                    filterButtons.forEach(
                        btn =>
                            btn.classList.toggle(
                                'activo',
                                btn.dataset.filter ===
                                'todos'
                            )
                    );


                    aplicarBusqueda();


                    window.scrollTo({

                        top:
                            document
                                .querySelector(
                                    '.selector-cursos'
                                )
                                .offsetTop - 90,

                        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'

                    });

                }
            );

        }
    );


    /* =====================================================
       UNIDADES DESPLEGABLES
       ===================================================== */

    document
        .querySelectorAll(
            '.unidad-cabecera'
        )
        .forEach((button, index) => {
            const weeks = button.closest('.unidad').querySelector('.semanas');
            weeks.id ||= 'unit-weeks-' + index;
            button.setAttribute('aria-controls', weeks.id);

            button.setAttribute(
                'aria-expanded',
                'false'
            );


            button.addEventListener(
                'click',
                () => {

                    const unidad =
                        button.closest(
                            '.unidad'
                        );


                    const abierta =
                        unidad.classList.toggle(
                            'abierta'
                        );


                    button.setAttribute(
                        'aria-expanded',
                        abierta
                            ? 'true'
                            : 'false'
                    );

                }
            );

        });


    /* =====================================================
       FILTROS
       ===================================================== */

    filterButtons.forEach(
        button => {

            button.addEventListener(
                'click',
                () => {

                    filtroActual =
                        button.dataset.filter ||
                        'todos';


                    filterButtons.forEach(
                        btn =>
                            btn.classList.remove(
                                'activo'
                            )
                    );


                    button.classList.add(
                        'activo'
                    );


                    aplicarBusqueda();

                }
            );

        }
    );


    /* =====================================================    
       BUSCADOR
       ===================================================== */

    searchInput?.addEventListener(
        'input',
        aplicarBusqueda
    );


    /* Galerías: usa el mismo cliente, sesión y comprobación de administrador. */
    function courseName(course) {
        return Array.from(selectors).find(s => s.dataset.course === course)
            ?.querySelector('strong')?.textContent.trim() || course;
    }

    function fillCourses(select, selected) {
        select.replaceChildren(...Array.from(selectors, s =>
            new Option(courseName(s.dataset.course), s.dataset.course)));
        if (selected) select.value = selected;
    }

    function fillWeeks(select, course, selected = 1) {
        const weeks = Array.from(document.querySelectorAll('.semana'))
            .filter(w => w.dataset.course === course);
        select.replaceChildren(...weeks.map(w => new Option(
            'Semana ' + w.dataset.week + ' · ' + w.querySelector('h3').textContent.trim(),
            String(Number(w.dataset.week)))));
        select.value = String(Number(selected));
        if (!select.value && select.options.length) select.selectedIndex = 0;
    }

    function fillGalleries(select, course, week, selected = '') {
        select.replaceChildren(new Option('Materiales sin galería', ''));
        galerias.filter(g => g.course_key === course && Number(g.week_number) === Number(week))
            .forEach(g => select.add(new Option(g.name, g.id)));
        select.value = selected || '';
        if (select.selectedIndex < 0) select.value = '';
        select.disabled = !galleriesReady;
    }

    function updateMaterialGalleryOptions() {
        const course = document.getElementById('material-course').value;
        const week = document.getElementById('material-week').value;
        const select = document.getElementById('material-gallery');
        fillGalleries(select, course, week, select.value);
        document.getElementById('material-gallery-help').textContent = galleriesReady
            ? 'Puedes dejar el material sin galería y asignarlo después.'
            : galleriesError + ' Puedes seguir subiendo materiales sin galería.';
        const selectedWeek = document.getElementById('material-week').selectedOptions[0];
        document.getElementById('material-location').textContent = courseName(course) +
            ' · ' + (selectedWeek?.textContent || '');
    }

    function syncMaterialLocation(course, week) {
        fillCourses(document.getElementById('material-course'), course);
        fillWeeks(document.getElementById('material-week'), course, week);
        document.getElementById('material-gallery').value = '';
        updateMaterialGalleryOptions();
    }

    document.getElementById('material-course').addEventListener('change', event => {
        fillWeeks(document.getElementById('material-week'), event.target.value);
        updateMaterialGalleryOptions();
    });
    document.getElementById('material-week').addEventListener('change', updateMaterialGalleryOptions);
    document.getElementById('gallery-course').addEventListener('change', event => {
        fillWeeks(document.getElementById('gallery-week'), event.target.value);
    });

    async function cargarGalerias() {
        galleriesReady = false;
        try {
            if (!supabaseClient) throw new Error('No se pudo conectar con Supabase.');
            const result = await supabaseClient.from('galleries').select('*')
                .order('sort_order', { ascending: true }).order('created_at', { ascending: true })
                .order('id', { ascending: true });
            if (result.error) throw result.error;
            const probe = await supabaseClient.from('materials').select('gallery_id').limit(0);
            if (probe.error) throw probe.error;
            galerias = result.data || [];
            galleriesReady = true;
            galleriesError = '';
        } catch (error) {
            const missingSchema = ['PGRST205', 'PGRST204', '42P01', '42703'].includes(error.code);
            galleriesError = missingSchema
                ? 'Las galerías requieren ejecutar la migración SQL y recargar esta página.'
                : 'No se pudieron cargar las galerías. Recarga la página para reintentar.';
            console.warn('Galerías no disponibles:', error.message);
        }
        document.querySelectorAll('[data-gallery-action="create"]').forEach(button => {
            button.disabled = !galleriesReady || !isAdmin;
        });
        const status = document.getElementById('galleries-status');
        if (status) status.textContent = galleriesError;
        if (dialog.open && form.dataset.busy !== 'true') updateMaterialGalleryOptions();
        renderMaterials();
        aplicarBusqueda();
    }

    async function requireGalleryAdmin() {
        if (!isAdmin || !supabaseClient || !galleriesReady) {
            throw new Error('Debes estar conectado como administrador y tener las galerías disponibles.');
        }
        const { data, error } = await supabaseClient.auth.getUser();
        if (error || !data?.user) throw new Error('La sesión administrativa ha terminado. Vuelve a iniciar sesión.');
        return data.user;
    }

    function openGalleryDialog(course, week, gallery = null) {
        if (!isAdmin || !galleriesReady) return;
        const galleryForm = document.getElementById('gallery-form');
        galleryForm.reset();
        document.getElementById('gallery-id').value = gallery?.id || '';
        document.getElementById('gallery-dialog-title').textContent = gallery ? 'Editar galería' : 'Crear galería';
        const courseSelect = document.getElementById('gallery-course');
        const weekSelect = document.getElementById('gallery-week');
        fillCourses(courseSelect, course);
        fillWeeks(weekSelect, course, week);
        courseSelect.disabled = Boolean(gallery);
        weekSelect.disabled = Boolean(gallery);
        document.getElementById('gallery-name').value = gallery?.name || '';
        document.getElementById('gallery-description').value = gallery?.description || '';
        document.getElementById('gallery-message').textContent = '';
        document.getElementById('gallery-dialog').showModal();
    }

    function openAssignmentDialog(id) {
        const material = materiales.find(m => String(m.id) === String(id));
        if (!material || !isAdmin || !galleriesReady) return;
        document.getElementById('assignment-material').value = id;
        document.getElementById('assignment-location').textContent = material.name + ' · ' +
            courseName(material.course_key) + ' · Semana ' + material.week_number;
        fillGalleries(document.getElementById('assignment-gallery'), material.course_key,
            material.week_number, material.gallery_id);
        document.getElementById('assignment-message').textContent = '';
        document.getElementById('assignment-dialog').showModal();
    }

    // Bloquear cierres y envíos dobles mientras se confirma una operación.
    async function galleryFormAction(formElement, message, action) {
        if (formElement.dataset.busy === 'true') return;
        formElement.dataset.busy = 'true';
        const controls = Array.from(formElement.elements).map(el => [el, el.disabled]);
        controls.forEach(([el]) => { el.disabled = true; });
        message.textContent = 'Guardando...';
        try {
            await action();
            renderMaterials();
            aplicarBusqueda();
            formElement.closest('dialog').close();
        } catch (error) {
            message.textContent = error.message || 'No se pudo guardar. Inténtalo de nuevo.';
        } finally {
            controls.forEach(([el, disabled]) => { el.disabled = disabled; });
            delete formElement.dataset.busy;
        }
    }

    document.getElementById('gallery-form').addEventListener('submit', async event => {
        event.preventDefault();
        const id = document.getElementById('gallery-id').value;
        const name = document.getElementById('gallery-name').value.trim();
        const description = document.getElementById('gallery-description').value.trim();
        const course = document.getElementById('gallery-course').value;
        const week = Number(document.getElementById('gallery-week').value);
        await galleryFormAction(event.currentTarget, document.getElementById('gallery-message'), async () => {
            if (!name) throw new Error('Escribe el nombre de la galería.');
            const user = await requireGalleryAdmin();
            let result;
            if (id) {
                result = await supabaseClient.from('galleries').update({ name, description: description || null })
                    .eq('id', id).select().single();
            } else {
                const orders = galerias.filter(g => g.course_key === course && Number(g.week_number) === week)
                    .map(g => Number(g.sort_order) || 0);
                result = await supabaseClient.from('galleries').insert({
                    course_key: course, week_number: week, name, description: description || null,
                    sort_order: Math.max(-1, ...orders) + 1, created_by: user.id
                }).select().single();
            }
            if (result.error) throw result.error;
            const index = galerias.findIndex(g => g.id === result.data.id);
            if (index < 0) galerias.push(result.data);
            else galerias[index] = result.data;
        });
    });

    document.getElementById('assignment-form').addEventListener('submit', async event => {
        event.preventDefault();
        const id = document.getElementById('assignment-material').value;
        const galleryId = document.getElementById('assignment-gallery').value || null;
        await galleryFormAction(event.currentTarget, document.getElementById('assignment-message'), async () => {
            await requireGalleryAdmin();
            const material = materiales.find(m => String(m.id) === id);
            if (!material) throw new Error('No se encontró el material. Recarga la página.');
            if (galleryId && !galerias.some(g => g.id === galleryId && g.course_key === material.course_key &&
                Number(g.week_number) === Number(material.week_number))) {
                throw new Error('La galería debe pertenecer al mismo curso y semana.');
            }
            const result = await supabaseClient.from('materials')
                .update({ gallery_id: galleryId, updated_at: new Date().toISOString() })
                .eq('id', id).select('id, gallery_id').single();
            if (result.error) throw result.error;
            material.gallery_id = result.data.gallery_id;
        });
    });

    document.querySelectorAll('#gallery-dialog, #assignment-dialog').forEach(el => {
        el.addEventListener('cancel', event => {
            if (el.querySelector('form').dataset.busy === 'true') event.preventDefault();
        });
    });

    document.addEventListener('click', async event => {
        const close = event.target.closest('[data-close-dialog]');
        if (close) {
            const target = document.getElementById(close.dataset.closeDialog);
            if (target?.querySelector('form').dataset.busy !== 'true') target?.close();
            return;
        }
        const button = event.target.closest('[data-gallery-action]');
        if (!button || button.disabled || !isAdmin || !galleriesReady) return;
        const action = button.dataset.galleryAction;
        const gallery = galerias.find(g => String(g.id) === button.dataset.id);
        if (action === 'create') {
            openGalleryDialog(button.dataset.course || document.querySelector('.curso-panel.activo').id,
                button.dataset.week || 1);
        } else if (action === 'edit' && gallery) {
            openGalleryDialog(gallery.course_key, gallery.week_number, gallery);
        } else if (action === 'assign') {
            openAssignmentDialog(button.dataset.id);
        } else if (action === 'delete' && gallery) {
            if (!confirm('¿Eliminar la galería "' + gallery.name + '"?\n\nSus materiales y archivos se conservarán en “Materiales sin galería”.')) return;
            button.disabled = true;
            try {
                await requireGalleryAdmin();
                const result = await supabaseClient.from('galleries').delete().eq('id', gallery.id).select('id').single();
                if (result.error) throw result.error;
                // La clave foránea hace SET NULL en la base de datos; nunca borrar materiales ni archivos.
                galerias = galerias.filter(g => g.id !== gallery.id);
                materiales.forEach(m => { if (m.gallery_id === gallery.id) m.gallery_id = null; });
                renderMaterials();
                aplicarBusqueda();
            } catch (error) {
                alert('No se pudo eliminar la galería: ' + error.message);
            } finally {
                button.disabled = false;
            }
        }
    });

    /* =====================================================
       INICIALIZAR
       ===================================================== */

    renderMaterials();

    await comprobarAdministrador();

    await Promise.all([cargarMateriales(), cargarGalerias()]);

});
