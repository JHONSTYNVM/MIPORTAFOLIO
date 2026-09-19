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


    function escapeAttribute(value) {

        return String(value ?? '')
            .replace(/"/g, '&quot;');

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

    function renderMaterials() {

        document
            .querySelectorAll(
                '.semana[data-course][data-week]'
            )
            .forEach(semana => {

                const course =
                    semana.dataset.course;

                const week =
                    Number(semana.dataset.week);


                const list = materiales.filter(
                    m =>
                        m.course_key === course &&
                        Number(m.week_number) === week &&
                        m.published !== false
                );


                const contador =
                    semana.querySelector(
                        '.archivo-contador'
                    );


                if (contador) {
                    contador.textContent =
                        list.length;
                }


                semana.dataset.files =
                    list.length;


                const contenido =
                    semana.querySelector(
                        '.materiales-contenido'
                    );


                if (!contenido) return;


                if (!list.length) {

                    contenido.innerHTML = isAdmin

                        ? `
                        <div class="materiales-vacios">
                            <span>＋</span>
                            No hay materiales todavía.
                            Usa “Agregar material”
                            para publicar el primero.
                        </div>
                        `

                        : `
                        <div class="materiales-vacios">
                            <span>＋</span>
                            Aún no hay materiales
                            publicados en esta semana.
                        </div>
                        `;

                    return;

                }


                contenido.innerHTML =
                    list.map(material => {

                        const viewUrl =
                            materialViewUrl(material);

                        const downloadUrl =
                            material.file_url ||
                            material.external_url ||
                            '';


                        const meta = [
                            material.material_type === 'url'
                                ? 'Enlace externo'
                                : 'Archivo',

                            material.file_size
                                ? formatBytes(
                                    material.file_size
                                )
                                : ''

                        ]
                        .filter(Boolean)
                        .join(' · ');


                        return `
                        <article class="material-item">

                            <div class="material-icono">
                                ${iconFor(material)}
                            </div>

                            <div class="material-info">

                                <strong>
                                    ${escapeHTML(
                                        material.name
                                    )}
                                </strong>

                                <span>
                                    ${escapeHTML(
                                        material.description ||
                                        meta ||
                                        'Material académico'
                                    )}
                                </span>

                            </div>


                            <div class="material-acciones">

                                ${
                                    viewUrl
                                    ? `
                                    <a
                                        href="${escapeAttribute(viewUrl)}"
                                        target="_blank"
                                        rel="noopener"
                                    >
                                        👁 Visualizar
                                    </a>
                                    `
                                    : ''
                                }


                               ${
    downloadUrl
    ? `
    <button
        type="button"
        class="material-download"
        data-url="${escapeAttribute(downloadUrl)}"
        data-name="${escapeAttribute(
            material.name || 'material'
        )}"
    >
        ↓ Descargar
    </button>
    `
    : ''
}


                                ${
                                    isAdmin
                                    ? `
                                    <button
                                        type="button"
                                        class="material-delete"
                                        data-id="${escapeAttribute(
                                            material.id
                                        )}"
                                    >
                                        🗑 Eliminar
                                    </button>
                                    `
                                    : ''
                                }

                            </div>

                        </article>
                        `;

                    })
                    .join('');

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


        dialog.showModal();

    }


    /* =====================================================
       CAMBIAR ENTRE ARCHIVO Y URL
       ===================================================== */

    typeSelect?.addEventListener(
        'change',
        () => {

            const url =
                typeSelect.value === 'url';


            fileField.hidden =
                url;


            urlField.hidden =
                !url;


            document.getElementById(
                'material-file'
            ).required = !url;


            document.getElementById(
                'material-url'
            ).required = url;

        }
    );


    /* =====================================================
       CERRAR DIALOG
       ===================================================== */

    document
        .getElementById(
            'dialog-close'
        )
        ?.addEventListener(
            'click',
            () => dialog.close()
        );


    document
        .getElementById(
            'dialog-cancel'
        )
        ?.addEventListener(
            'click',
            () => dialog.close()
        );


    /* =====================================================
       GUARDAR MATERIAL
       ===================================================== */

    form?.addEventListener(
        'submit',
        async event => {

            event.preventDefault();


            if (
                !isAdmin ||
                !supabaseClient
            ) {

                messageEl.textContent =
                    'Debes iniciar sesión como administrador y configurar Supabase.';

                return;

            }


            const save =
                document.getElementById(
                    'material-save'
                );


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


            const type =
                typeSelect.value;


            /* Obtener usuario */

            const {
                data: userData
            } = await supabaseClient
                .auth
                .getUser();


            const user =
                userData?.user;


            if (!user) {

                messageEl.textContent =
                    'La sesión administrativa ha terminado.';

                return;

            }


            save.disabled = true;


            messageEl.textContent =
                type === 'url'
                    ? 'Guardando enlace...'
                    : 'Subiendo material...';


            try {

                /* ======================================
                   GUARDAR ENLACE
                   ====================================== */

                if (type === 'url') {

                    const externalUrl =
                        document.getElementById(
                            'material-url'
                        ).value.trim();


                    if (!externalUrl) {

                        throw new Error(
                            'Coloca una URL válida.'
                        );

                    }


                    const insert =
                        await supabaseClient
                            .from('materials')
                            .insert({

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

                    const files =
                        Array.from(
                            document.getElementById(
                                'material-file'
                            ).files || []
                        );


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


                messageEl.textContent =
                    error.message ||
                    'No se pudo guardar el material.';

            } finally {

                save.disabled = false;

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
        material.title ||
        material.file_name ||
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
        // 1. ELIMINAR REGISTRO DE LA TABLA
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
        // 2. ELIMINAR ARCHIVO DEL STORAGE
        // =================================================

        if (
            material.file_path
        ) {

            console.log(
                '🗑 Eliminando archivo:',
                material.file_path
            );


            const {
                error: storageError
            } =
                await supabaseClient
                    .storage
                    .from('materiales')
                    .remove([
                        material.file_path
                    ]);


            if (storageError) {

                console.error(
                    '⚠️ El registro se eliminó, pero el archivo no:',
                    storageError
                );

                alert(
                    '⚠️ El material fue eliminado, ' +
                    'pero el archivo del almacenamiento ' +
                    'no pudo eliminarse.\n\n' +
                    storageError.message
                );

            } else {

                console.log(
                    '✅ Archivo eliminado del Storage.'
                );

            }

        }


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

                        behavior:
                            'smooth'

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
        .forEach(button => {

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


    /* =====================================================
       INICIALIZAR
       ===================================================== */

    renderMaterials();

    await comprobarAdministrador();

    await cargarMateriales();

});