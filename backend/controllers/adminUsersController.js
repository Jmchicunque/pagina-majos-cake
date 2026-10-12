function createSystemUser(token, userData) {

    const authorization = requireRole(token, ["admin"]);

    if (!authorization.success) {
        return authorization;
    }

    if (!isPrimaryAdministrator(authorization.user.id)) {
        return {
            success: false,
            message: "Solo el administrador principal puede crear usuarios del sistema."
        };
    }

    if (!userData) {
        return {
            success: false,
            message: "No se recibieron datos del usuario."
        };
    }

    if (!userData.name || !userData.password) {
        return {
            success: false,
            message: "El nombre y la contraseña son obligatorios."
        };
    }

    const allowedRoles = [
        "subadmin",
        "employee",
        "messenger",
        "client"
    ];

    const requestedRole = String(userData.role || "")
        .trim()
        .toLowerCase();

    if (!allowedRoles.includes(requestedRole)) {
        return {
            success: false,
            message: "El rol solicitado no está permitido."
        };
    }

    return {
        success: true,
        message: "La validación del usuario del sistema fue correcta.",
        role: requestedRole
    };
}


// Pruebas

