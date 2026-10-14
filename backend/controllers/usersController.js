function getPublicRegistrationRole() {

    if (hasPrimaryAdministrator()) {
        return "client";
    }

    return "admin";
}

    
function createUser(userData) {
  if (!userData) {
    throw new Error("No se recibieron los datos del usuario.");
  }

  const name = String(userData.name || "").trim();
  const phone = String(userData.phone || "").trim();
  const email = String(userData.email || "").trim().toLowerCase();
  const password = userData.password;

  if (!name || !phone || !email) {
    throw new Error("Nombre, teléfono y correo son obligatorios.");
  }

  if (typeof password !== "string" || password.length === 0) {
    throw new Error("La contraseña es obligatoria.");
  }

  const hashStart = Date.now();
  const passwordData = hashPassword(password);
  const hashDuration = Date.now() - hashStart;

  console.log("Tiempo de hash: " + hashDuration + " ms");

  const sheetUsers = obtainSheet(config_().SH_USER_REGISTRATION);
  const lock = LockService.getScriptLock();

  lock.waitLock(10000);

  try {
    const lastRow = sheetUsers.getLastRow();
    let maxId = 0;

    if (lastRow > 1) {
      const rows = sheetUsers
        .getRange(2, 1, lastRow - 1, 4)
        .getValues();

      for (const row of rows) {
        const existingId = Number(row[0]) || 0;
        const existingPhone = String(row[2] || "").trim();
        const existingEmail = String(row[3] || "")
          .trim()
          .toLowerCase();

        if (existingId > maxId) {
          maxId = existingId;
        }

        if (existingEmail === email) {
          return {
            success: false,
            message: "Ya existe una cuenta con ese correo."
          };
        }

        if (existingPhone === phone) {
          return {
            success: false,
            message: "Ya existe una cuenta con ese teléfono."
          };
        }
      }
    }

    const userId = maxId + 1;
    const now = new Date();

    sheetUsers.appendRow([
      userId,
      name,
      phone,
      email,
      passwordData.hash,
      passwordData.salt,
      0,
      "",
      "active",
      getPublicRegistrationRole(),
      now,
      now,
      "",
      now,
      false,
      ""
    ]);

    PropertiesService.getScriptProperties()
      .setProperty("lastUserId", String(userId));

     const verificationId = createVerificationRequest_({ name, email });

    return {
      success: true,
      message: "Te enviamos un código de verificación a tu correo.",
      verificationId
    };

  } finally {
    lock.releaseLock();
  }
}
