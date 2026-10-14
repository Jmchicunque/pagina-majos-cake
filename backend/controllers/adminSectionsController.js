/* SECCIONES DEL PANEL ADMINISTRATIVO */

const ADMIN_SECTIONS = {
    resumen: {
        title: "Resumen general",
        file: "frontend/views/admin/sections/resumen",
        roles: ["admin", "employee", "messenger"]
    },
    estadisticas: {
        title: "Estadísticas y ventas",
        file: "frontend/views/admin/sections/estadisticas",
        roles: ["admin", "employee"]
    },
    productos: {
        title: "Productos",
        file: "frontend/views/admin/sections/productos",
        roles: ["admin", "employee"]
    },
    pedidos: {
        title: "Gestión de pedidos",
        file: "frontend/views/admin/sections/pedidos",
        roles: ["admin", "employee", "messenger"]
    },
    entregas: {
        title: "Seguimiento de entregas",
        file: "frontend/views/admin/sections/entregas",
        roles: ["admin", "employee", "messenger"]
    },
    usuarios: {
        title: "Usuarios y permisos",
        file: "frontend/views/admin/sections/usuarios",
        roles: ["admin"]
    },
    configuracion: {
        title: "Configuración",
        file: "frontend/views/admin/sections/configuracion",
        roles: ["admin"]
    },
    agenda: {
        title: "Agenda de pedidos",
        file: "frontend/views/admin/sections/agenda",
        roles: ["admin", "employee", "messenger"]
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

    const authorization = requireRole(token, sectionConfig.roles);

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