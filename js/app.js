// ============================================================
// PORTAFOLIO ACADÉMICO
// ADMINISTRACIÓN DE MATERIALES
// ============================================================

document.addEventListener("DOMContentLoaded", async function () {

    console.log("=================================");
    console.log("PORTAFOLIO ACADÉMICO");
    console.log("Iniciando sistema...");
    console.log("=================================");

    // ========================================================
    // 1. CONFIGURACIÓN DE SUPABASE
    // ========================================================

    const cfg = window.PORTAFOLIO_SUPABASE || {};

    if (!cfg.url || !cfg.anonKey) {

        console.error(
            "❌ Supabase no está configurado."
        );

        return;
    }

    const supabaseClient =
        window.supabase.createClient(
            cfg.url,
            cfg.anonKey
        );

    // Guardamos el cliente globalmente
    window.portafolioSupabase =
        supabaseClient;

    console.log(
        "✅ Supabase conectado correctamente."
    );


    // ========================================================
    // 2. VERIFICAR SESIÓN
    // ========================================================

    const {
        data: {
            session
        }
    } = await supabaseClient.auth.getSession();


    if (!session) {

        console.log(
            "No hay una sesión iniciada."
        );

        return;
    }


    console.log(
        "👤 Usuario conectado:",
        session.user.email
    );


    // ========================================================
    // 3. VERIFICAR ADMINISTRADOR
    // ========================================================

    const {
        data: admin,
        error: adminError
    } = await supabaseClient
        .from("admin_users")
        .select("user_id")
        .eq(
            "user_id",
            session.user.id
        )
        .maybeSingle();


    if (adminError) {

        console.error(
            "❌ Error verificando administrador:",
            adminError
        );

        return;
    }


    if (!admin) {

        console.log(
            "⚠️ El usuario no es administrador."
        );

        return;
    }


    console.log(
        "🟢 ADMINISTRADOR VERIFICADO."
    );


    // ========================================================
    // 4. MOSTRAR ESTADO ADMINISTRADOR
    // ========================================================

    const adminIndicator =
        document.getElementById(
            "admin-status"
        );


    if (adminIndicator) {

        adminIndicator.textContent =
            "🟢 Modo administrador activo";
    }


    // ========================================================
    // 5. FORMULARIO DE MATERIAL
    // ========================================================

    const materialForm =
        document.getElementById(
            "material-form"
        );


    if (materialForm) {

        materialForm.addEventListener(
            "submit",
            async function (event) {

                event.preventDefault();

                await guardarMaterial(
                    supabaseClient,
                    session.user
                );

            }
        );
    }


    // ========================================================
    // 6. BOTONES ELIMINAR
    // ========================================================

 // ============================================================
// DETECTAR BOTÓN ELIMINAR MATERIAL
// ============================================================

document.addEventListener("click", function (event) {

    const boton = event.target.closest("button");

    if (!boton) {
        return;
    }

    // Detectar si es un botón de eliminar
    const texto =
        boton.textContent
            .trim()
            .toLowerCase();

    const esEliminar =
        texto.includes("eliminar") ||
        texto.includes("🗑");

    if (!esEliminar) {
        return;
    }

    console.log("🗑 Botón eliminar presionado.");

    // Buscar el ID del material
    let materialId =
        boton.dataset.materialId ||
        boton.dataset.id ||
        boton.getAttribute("data-material-id") ||
        boton.getAttribute("data-id");

    console.log(
        "ID encontrado:",
        materialId
    );

    if (!materialId) {

        console.error(
            "❌ El botón eliminar no tiene data-material-id ni data-id."
        );

        alert(
            "❌ El botón eliminar no tiene asociado el ID del material."
        );

        return;
    }

    eliminarMaterial(
        supabaseClient,
        materialId
    );

});


    console.log(
        "✅ Sistema de administración listo."
    );

});


// ============================================================
// FUNCIÓN: GUARDAR MATERIAL
// ============================================================

async function guardarMaterial(
    supabaseClient,
    user
) {

    // ========================================================
    // OBTENER DATOS DEL FORMULARIO
    // ========================================================

    const nombre =
        document
            .getElementById("material-name")
            ?.value
            .trim();


    const descripcion =
        document
            .getElementById("material-description")
            ?.value
            .trim();


    const tipo =
        document
            .getElementById("material-type")
            ?.value;


    const archivoInput =
        document.getElementById(
            "material-file"
        );


    const urlExterna =
        document
            .getElementById("material-url")
            ?.value
            .trim();


    // ========================================================
    // OBTENER WEEK_ID
    // ========================================================

    /*
       IMPORTANTE:

       La tabla materials NO usa:
       - course_key
       - week_number

       Usa:
       - week_id

       Por eso buscamos primero un campo
       hidden llamado material-week-id.
    */

    let weekId =
        document
            .getElementById(
                "material-week-id"
            )
            ?.value;


    // También aceptamos week-id por si
    // tu HTML utiliza ese nombre.

    if (!weekId) {

        weekId =
            document
                .getElementById(
                    "week-id"
                )
                ?.value;
    }


    // También intentamos obtenerlo
    // desde el formulario.

    if (!weekId) {

        const weekInput =
            document.querySelector(
                "[name='week_id']"
            );

        if (weekInput) {
            weekId = weekInput.value;
        }
    }


    // Convertir a número

    if (weekId) {
        weekId = Number(weekId);
    }


    // ========================================================
    // VALIDACIONES
    // ========================================================

    if (!nombre) {

        alert(
            "❌ Escribe el nombre del material."
        );

        return;
    }


    if (!weekId || Number.isNaN(weekId)) {

        alert(
            "❌ No se encontró el ID de la semana."
        );

        console.error(
            "No se encontró material-week-id."
        );

        return;
    }


    // ========================================================
    // BOTÓN GUARDAR
    // ========================================================

    const saveButton =
        document.getElementById(
            "save-material"
        );


    if (saveButton) {

        saveButton.disabled = true;

        saveButton.textContent =
            "Guardando...";
    }


    try {

        // ====================================================
        // VARIABLES
        // ====================================================

        let filePath = null;

        let fileSize = null;

        let fileName = null;


        // ====================================================
        // SUBIR ARCHIVO
        // ====================================================

        if (
            tipo === "archivo" &&
            archivoInput &&
            archivoInput.files.length > 0
        ) {

            const archivo =
                archivoInput.files[0];


            console.log(
                "📁 Archivo seleccionado:",
                archivo.name
            );


            // ------------------------------------------------
            // NOMBRE SEGURO
            // ------------------------------------------------

            const nombreSeguro =
                archivo.name
                    .normalize("NFD")
                    .replace(
                        /[\u0300-\u036f]/g,
                        ""
                    )
                    .replace(
                        /[^a-zA-Z0-9._-]/g,
                        "_"
                    );


            // ------------------------------------------------
            // RUTA DEL ARCHIVO
            // ------------------------------------------------

            filePath =
                `semana-${weekId}/${Date.now()}-${nombreSeguro}`;


            console.log(
                "📤 Subiendo archivo:",
                filePath
            );


            // ------------------------------------------------
            // SUBIR A BUCKET
            // ------------------------------------------------

            const {
                error: uploadError
            } =
                await supabaseClient
                    .storage
                    .from("materiales")
                    .upload(
                        filePath,
                        archivo,
                        {
                            cacheControl: "3600",
                            upsert: false
                        }
                    );


            if (uploadError) {

                console.error(
                    "❌ Error subiendo archivo:",
                    uploadError
                );

                throw new Error(
                    "No se pudo subir el archivo: " +
                    uploadError.message
                );
            }


            console.log(
                "✅ Archivo subido correctamente."
            );


            // ------------------------------------------------
            // DATOS DEL ARCHIVO
            // ------------------------------------------------

            fileName =
                archivo.name;


            fileSize =
                archivo.size;
        }


        // ====================================================
        // GUARDAR REGISTRO EN MATERIALS
        // ====================================================

        const datosMaterial = {

            week_id:
                weekId,

            title:
                nombre,

            description:
                descripcion || null,

            material_type:
                tipo || "archivo",

            file_name:
                fileName,

            file_path:
                filePath,

            file_size:
                fileSize,

            external_url:
                tipo === "enlace"
                    ? urlExterna || null
                    : null,

            can_preview:
                true,

            can_download:
                true,

            display_order:
                0,

            published:
                true,

            created_by:
                user.id
        };


        console.log(
            "📝 Guardando material:",
            datosMaterial
        );


        const {
            data,
            error
        } =
            await supabaseClient
                .from("materials")
                .insert(
                    datosMaterial
                )
                .select()
                .single();


        // ====================================================
        // ERROR AL GUARDAR
        // ====================================================

        if (error) {

            console.error(
                "❌ Error guardando material:",
                error
            );


            // Si el registro falló,
            // eliminamos el archivo que acabamos
            // de subir.

            if (filePath) {

                await supabaseClient
                    .storage
                    .from("materiales")
                    .remove([
                        filePath
                    ]);
            }


            throw new Error(
                "No se pudo guardar el material: " +
                error.message
            );
        }


        // ====================================================
        // ÉXITO
        // ====================================================

        console.log(
            "✅ Material guardado:",
            data
        );


        alert(
            "✅ Material guardado correctamente."
        );


        // Recargar página

        window.location.reload();


    } catch (error) {

        console.error(
            "❌ ERROR:",
            error
        );


        alert(
            "❌ " + error.message
        );


    } finally {

        if (saveButton) {

            saveButton.disabled =
                false;

            saveButton.textContent =
                "Guardar material";
        }
    }
}


// ============================================================
// FUNCIÓN: ELIMINAR MATERIAL
// ============================================================

async function eliminarMaterial(
    supabaseClient,
    materialId
) {

    console.log(
        "🗑 Intentando eliminar material:",
        materialId
    );


    // ========================================================
    // CONFIRMAR
    // ========================================================

    const confirmar =
        confirm(
            "¿Estás seguro de eliminar este material?\n\n" +
            "El registro y el archivo serán eliminados."
        );


    if (!confirmar) {
        return;
    }


    try {

        // ====================================================
        // 1. OBTENER MATERIAL
        // ====================================================

        const {
            data: material,
            error: findError
        } =
            await supabaseClient
                .from("materials")
                .select(
                    "id, file_path, file_name"
                )
                .eq(
                    "id",
                    materialId
                )
                .single();


        if (findError) {

            console.error(
                "❌ Error buscando material:",
                findError
            );

            throw new Error(
                "No se pudo encontrar el material: " +
                findError.message
            );
        }


        console.log(
            "📄 Material encontrado:",
            material
        );


        // ====================================================
        // 2. ELIMINAR ARCHIVO DEL STORAGE
        // ====================================================

        if (material.file_path) {

            console.log(
                "🗑 Eliminando archivo:",
                material.file_path
            );


            const {
                error: storageError
            } =
                await supabaseClient
                    .storage
                    .from("materiales")
                    .remove([
                        material.file_path
                    ]);


            if (storageError) {

                console.error(
                    "❌ Error eliminando archivo:",
                    storageError
                );

                throw new Error(
                    "No se pudo eliminar el archivo: " +
                    storageError.message
                );
            }


            console.log(
                "✅ Archivo eliminado del Storage."
            );
        }


        // ====================================================
        // 3. ELIMINAR REGISTRO DE MATERIALS
        // ====================================================

        const {
            error: deleteError
        } =
            await supabaseClient
                .from("materials")
                .delete()
                .eq(
                    "id",
                    materialId
                );


        if (deleteError) {

            console.error(
                "❌ Error eliminando registro:",
                deleteError
            );

            throw new Error(
                "No se pudo eliminar el registro: " +
                deleteError.message
            );
        }


        // ====================================================
        // 4. ÉXITO
        // ====================================================

        console.log(
            "✅ Material eliminado correctamente."
        );


        alert(
            "✅ Material eliminado correctamente."
        );


        // Recargar

        window.location.reload();


    } catch (error) {

        console.error(
            "❌ ERROR ELIMINANDO:",
            error
        );


        alert(
            "❌ " + error.message
        );
    }
}


// ============================================================
// HACER FUNCIONES DISPONIBLES GLOBALMENTE
// ============================================================

window.guardarMaterial =
    guardarMaterial;

window.eliminarMaterial =
    eliminarMaterial;