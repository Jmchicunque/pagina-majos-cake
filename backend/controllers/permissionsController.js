/* PERMISOS DEL PANEL ADMINISTRATIVO */

const PERMISSION_MODULES = {
    stats:      { label: "Estadísticas y ventas",   section: "estadisticas",  actions: ["view"] },
    products:   { label: "Productos",               section: "productos",     actions: ["view", "create", "edit", "delete"] },
    orders:     { label: "Gestión de pedidos",      section: "pedidos",       actions: ["view", "create", "edit", "delete"] },
    deliveries: { label: "Seguimiento de entregas", section: "entregas",      actions: ["view", "edit"] },
    agenda:     { label: "Agenda de pedidos",       section: "agenda",        actions: ["view"] },
    users:      { label: "Usuarios y permisos",     section: "usuarios",      actions: ["view", "create", "edit", "delete"], locked: true },
    settings:   { label: "Configuración",           section: "configuracion", actions: ["view", "edit"], locked: true }
};

function buildPermissionList_() {
    const list = {};

    Object.keys(PERMISSION_MODULES).forEach(function (moduleKey) {
        const moduleConfig = PERMISSION_MODULES[moduleKey];

        moduleConfig.actions.forEach(function (action) {
            list[moduleKey + "." + action] = {
                module: moduleKey,
                action: action,
                delegable: !moduleConfig.locked
            };
        });
    });

    return list;
}

const PERMISSIONS = buildPermissionList_();

const ROLE_PERMISSIONS = {
    subadmin: [
        "stats.view",
        "products.view", "products.create", "products.edit", "products.delete",
        "orders.view", "orders.create", "orders.edit", "orders.delete",
        "deliveries.view", "deliveries.edit",
        "agenda.view"
    ],
    employee: [
        "stats.view",
        "products.view",
        "orders.view", "orders.create", "orders.edit",
        "deliveries.view",
        "agenda.view"
    ],
    messenger: [
        "orders.view",
        "deliveries.view", "deliveries.edit",
        "agenda.view"
    ]
};

function getRolePermissions_(role) {
    const normalizedRole = String(role).trim().toLowerCase();

    if (normalizedRole === "admin") {
        return Object.keys(PERMISSIONS);
    }

    if (!Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS, normalizedRole)) {
        return [];
    }

    return ROLE_PERMISSIONS[normalizedRole].slice();
}

function getUserExtraPermissions_(userId) {
    const sheet = obtainSheet(config_().SH_USER_PERMISSIONS);

    if (!sheet || sheet.getLastRow() < 2) {
        return [];
    }

    const rows = sheet
        .getRange(2, 1, sheet.getLastRow() - 1, 9)
        .getValues();

    const now = new Date();
    const result = [];

    rows.forEach(function (row) {
        const rowUserId = String(row[1]).trim();
        const permission = String(row[2]).trim();
        const expiresAt = row[5];
        const status = String(row[6]).trim().toLowerCase();

        if (rowUserId !== String(userId).trim()) return;
        if (status !== "active") return;

        if (expiresAt !== "") {
            if (!(expiresAt instanceof Date)) return;
            if (expiresAt.getTime() <= now.getTime()) return;
        }

        if (!Object.prototype.hasOwnProperty.call(PERMISSIONS, permission)) return;
        if (!PERMISSIONS[permission].delegable) return;

        if (result.indexOf(permission) === -1) {
            result.push(permission);
        }
    });

    return result;
}

function getEffectivePermissions_(user) {
    const rolePermissions = getRolePermissions_(user.role);

    if (String(user.role).trim().toLowerCase() === "admin") {
        return rolePermissions;
    }

    const extraPermissions = getUserExtraPermissions_(user.id);

    extraPermissions.forEach(function (permission) {
        if (rolePermissions.indexOf(permission) === -1) {
            rolePermissions.push(permission);
        }
    });

    return rolePermissions;
}

function userHasPermission_(user, permission) {
    if (!permission) return true;

    return getEffectivePermissions_(user).indexOf(permission) !== -1;
}

function requirePermission(token, permission) {

    const authorization = requireRole(token, ADMIN_PANEL_ROLES);

    if (!authorization.success) {
        return authorization;
    }

    if (!userHasPermission_(authorization.user, permission)) {
        return {
            success: false,
            message: "No tienes permisos para realizar esta acción."
        };
    }

    return {
        success: true,
        user: authorization.user
    };
}