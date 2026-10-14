/* AUTORIZACIÓN Y USUARIO AUTENTICADO */

function getAuthenticatedUser(token) {

  if (!token || typeof token !== "string") {
    return null;
  }


  const userId = getRequesterFromToken(token);

  if (!userId) {
    return null;
  }


  const sheetUsers = obtainSheet(config_().SH_USER_REGISTRATION);

  if (!sheetUsers) {
    return null;
  }


  const lastRow = sheetUsers.getLastRow();

  if (lastRow < 2) {
    return null;
  }


  const values = sheetUsers
    .getRange(2, 1, lastRow - 1, 1)
    .getValues();

  for (let i = 0; i < values.length; i++) {

    const currentUserId = String(values[i][0]);

    if (currentUserId === String(userId)) {

      const userRow = i + 2;

      const row = sheetUsers
        .getRange(userRow, 1, 1, 15)
        .getValues()[0];

      const status = String(row[8]).trim().toLowerCase();

      if (status !== "active") {
        return null;
      }

      /* Devolver únicamente información necesaria */

      return {
        id: row[0],
        name: row[1],
        phone: row[2],
        email: row[3],
        role: row[9],
        status: row[8]
      };
    }
  }

  return null;
}

/*AUTORIZACIÓN POR ROL */

function requireRole(token, allowedRoles) {

  if (!token || typeof token !== "string") {
    return {
      success: false,
      message: "Sesión no válida."
    };
  }


  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
    return {
      success: false,
      message: "No se han definido roles permitidos."
    };
  }


  const user = getAuthenticatedUser(token);

  if (!user) {
    return {
      success: false,
      message: "Usuario no autenticado."
    };
  }

  const userRole = String(user.role).trim().toLowerCase();

  const normalizedRoles = allowedRoles.map(function (role) {
    return String(role).trim().toLowerCase();
  });


  if (!normalizedRoles.includes(userRole)) {
    return {
      success: false,
      message: "No tienes permisos para realizar esta acción."
    };
  }

  return {
    success: true,
    user: user
  };
}

function isPrimaryAdministrator(userId) {

    if (!userId) {
        return false;
    }

    const primaryAdministrator = getPrimaryAdministrator();

    if (!primaryAdministrator) {
        return false;
    }

    return String(primaryAdministrator.id) === String(userId);
}

function hasPrimaryAdministrator() {

    const primaryAdministrator = getPrimaryAdministrator();

    return primaryAdministrator !== null;
}

function getPrimaryAdministrator() {

    const sheetUsers = obtainSheet(config_().SH_USER_REGISTRATION);

    if (!sheetUsers) {
        return null;
    }

    const lastRow = sheetUsers.getLastRow();

    if (lastRow < 2) {
        return null;
    }

    const values = sheetUsers.getRange(2, 1, lastRow - 1, 10).getValues();
    let primaryAdministrator = null;
    let administratorCount = 0;

    for (let i = 0; i < values.length; i++) {

        const userId = values[i][0];
        const status = String(values[i][8]).trim().toLowerCase();
        const role = String(values[i][9]).trim().toLowerCase();

        if (status === "active" &&role === "admin") {

            administratorCount++;

            primaryAdministrator = {
                id: userId,
                name: values[i][1],
                phone: values[i][2],
                email: values[i][3],
                role: role,
                status: status
            };
        }
    }

    if (administratorCount === 0) {
        return null;
    }

    if (administratorCount > 1) {
        throw new Error("ERROR DE SEGURIDAD: existen múltiples administradores principales.");
    }

    return primaryAdministrator;
}

/* ACCESO TEMPORAL AL PANEL ADMINISTRATIVO */

function createAdminPanelAccess(token) {

  const authorization = requireRole(
    token,
    ["admin", "employee", "messenger"]
  );

  if (!authorization.success) {
    return authorization;
  }

  const accessKey = Utilities.getUuid() + Utilities.getUuid();
  const cache = CacheService.getScriptCache();

  cache.put("ADMIN_ACCESS_" + accessKey, String(authorization.user.id),300);

  return {
    success: true,
    accessKey: accessKey
  };
}

function getAdminPanelUrl(token) {

 const access = createAdminPanelAccess(token);

  if (!access.success) {
    return access;
  }

  const webAppUrl = ScriptApp.getService().getUrl();
  const panelUrl = webAppUrl + "?page=admin&accessKey=" + encodeURIComponent(access.accessKey);

  return {
    success: true,
    url: panelUrl
  };
}

function getFileContent(path) {
    return HtmlService
        .createHtmlOutputFromFile(path)
        .getContent();
}

const ADMIN_JS_MODULES = [
    "frontend/js/admin/adminSession",
    "frontend/js/admin/adminCharts",
    "frontend/js/admin/adminLayout",
    "frontend/js/admin/adminCalendar"
];

function buildAdminJavaScript() {
    const code = ADMIN_JS_MODULES
        .map(function (path) {
            return removeScriptTags(getFileContent(path));
        })
        .join("\n\n");

    return "(() => {\n" + code + "\n})();";
}

function getAdminFiles() {

    const files = {
        css: "frontend/css/adminStyles",
        header: "frontend/views/admin/components/adminHeader",
        navigation: "frontend/views/admin/components/adminNavigation",
        content: "frontend/views/admin/components/adminContent",
        app: "frontend/views/admin/adminApp",
        /* js: "frontend/js/admin" */
    };

    return {
        css: getFileContent(files.css),
        navigation: getFileContent(files.navigation),
        content: getFileContent(files.content),
        app: getFileContent(files.app),
        /* js: getFileContent(files.js) */
        js: buildAdminJavaScript()
    };

}

function getAdminApplication(token) {

    const authorization = requireRole(token, ["admin", "employee", "messenger"]);

    if (!authorization.success) {
        return authorization;
    }

    const files = getAdminFiles();
    let html = files.app;

    html = html.replace("{{ADMIN_NAVIGATION}}", files.navigation);
    html = html.replace("{{ADMIN_CONTENT}}", files.content);

    /* const adminJavaScript = removeScriptTags(files.js); */
    const adminJavaScript = files.js;

    return {
        success: true,
        html: files.css + html,
        js: adminJavaScript,
        user: authorization.user
    };

}

function removeScriptTags(script) {

    return script
        .replace(/<script\b[^>]*>/i, "")
        .replace(/<\/script>/i, "");

}
