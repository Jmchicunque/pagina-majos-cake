/* SECCIONES DEL PANEL ADMINISTRATIVO */

const ADMIN_SECTIONS = {
    resumen: {
        title: "Resumen general",
        file: "frontend/views/admin/sections/resumen",
        permission: null
    },
    estadisticas: {
        title: "Estadísticas y ventas",
        file: "frontend/views/admin/sections/estadisticas",
        permission: "stats.view"
    },
    productos: {
        title: "Productos",
        file: "frontend/views/admin/sections/productos",
        permission: "products.view"
    },
    pedidos: {
        title: "Gestión de pedidos",
        file: "frontend/views/admin/sections/pedidos",
        permission: "orders.view"
    },
    entregas: {
        title: "Seguimiento de entregas",
        file: "frontend/views/admin/sections/entregas",
        permission: "deliveries.view"
    },
    usuarios: {
        title: "Usuarios y permisos",
        file: "frontend/views/admin/sections/usuarios",
        permission: "users.view"
    },
    configuracion: {
        title: "Configuración",
        file: "frontend/views/admin/sections/configuracion",
        permission: "settings.view"
    },
    agenda: {
        title: "Agenda de pedidos",
        file: "frontend/views/admin/sections/agenda",
        permission: "agenda.view"
    }
};

function getAdminSection(token, section) {

    if (
        typeof section !== "string" ||
        !Object.prototype.hasOwnProperty.call(ADMIN_SECTIONS, section)
    ) {
        return {
            success: false,
            message: "Sección no permitida."
        };
    }

    const sectionConfig = ADMIN_SECTIONS[section];

    /* const authorization = requireRole(token, sectionConfig.roles); */
    const authorization = requirePermission(token, sectionConfig.permission);

    if (!authorization.success) {
        return authorization;
    }

    return {
        success: true,
        section: section,
        title: sectionConfig.title,
        html: getFileContent(sectionConfig.file)
    };
}