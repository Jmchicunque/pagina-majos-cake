
function createUser (userData) {

    const sheetUsers = obtainSheet(config_().SH_USER_REGISTRATION);
    const lock = LockService.getScriptLock();

    lock.waitLock(10000);

    try {

        if (!userData) {
            throw new Error("No se recibe datos de usuario");
        }

        if (!userData.password) {
            throw new Error("La contraseña es obligatoria");
        }

        const properties = PropertiesService.getScriptProperties();
        const lastRow = sheetUsers.getLastRow();
        let userId;

        if (lastRow <= 1) {
            userId = 1
        } else {
            const lastUserId = Number(
                properties.getProperty("lastUserId") || 0
            );
    
            userId = lastUserId + 1;
        }

        /* Seguridad generamos hash y salt */

        const passwordData = hashPassword(userData.password);
        const now = new Date();

        properties.setProperty("lastUserId", userId);

        /* INsertamos el usuario */
        sheetUsers.appendRow([
            userId, 
            userData.name,
            userData.phone,
            userData.email,
            passwordData.hash,
            passwordData.salt,
            0,
            "",
            "active",
            lastRow <= 1 ? "Admin" : "cliente",
            now,
            now,
            "",
            now,
            false
        ]);

        return {
            success: true,
            message: "El usuario se ha creado correctamente"
        }
    } finally {
        lock.releaseLock();
    }
}