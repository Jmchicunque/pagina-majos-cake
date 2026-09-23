const PASSWORD_CONFIG = {
  iterations: 1000,
  saltLength: 32,
  keyLength: 32,
};

/* GENERAR SALT */
function generateSalt() {
  const uuid1 = Utilities.getUuid().replace(/-/g, "");
  const uuid2 = Utilities.getUuid().replace(/-/g, "");
  return uuid1 + uuid2;
}

/* BYTES -> HEX */
function bytesToHex(bytes) {
  return bytes
    .map((byte) => {
      const value = byte < 0 ? byte + 256 : byte;
      return value.toString(16).padStart(2, "0");
    })
    .join("");
}

/* HEX -> BYTES */
function hexToBytes(hex) {
  if (!hex || hex.length % 2 !== 0) {
    throw new Error("El valor hexadecimal no es válido.");
  }

  const bytes = [];

  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substring(i, i + 2), 16));
  }
  return bytes;
}

/* XOR DE ARRAYS DE BYTES */
function xorBytes(a, b) {

  if (a.length !== b.length) {
    throw new Error("Los arrays deben tener la misma longitud.");
  }

  const result = [];

  for (let i = 0; i < a.length; i++) {

    const byteA = a[i] & 0xff;
    const byteB = b[i] & 0xff;

    const xor = byteA ^ byteB;

    result.push(xor > 127 ? xor - 256 : xor);
  }

  return result;
}

/* PBKDF2-HMAC-SHA256 */
function pbkdf2(password, saltBytes, iterations, keyLength) {
  if (!password) {
    throw new Error("La contraseña es obligatoria.");
  }

  if (!Array.isArray(saltBytes)) {
    throw new Error("El salt debe ser un array de bytes.");
  }

  if (!Number.isInteger(iterations) || iterations <= 0) {
    throw new Error("El número de iteraciones no es válido.");
  }

  if (!Number.isInteger(keyLength) || keyLength <= 0) {
    throw new Error("La longitud de la clave no es válida.");
  }

  /* Convertimos la contraseña a bytes.*/
  const passwordBytes = Utilities.newBlob(password).getBytes();

  const blockNumber = [0x00, 0x00, 0x00, 0x01];

  let u = Utilities.computeHmacSha256Signature(
    saltBytes.concat(blockNumber),
    passwordBytes,
  );

  let result = u.slice();

  for (let i = 1; i < iterations; i++) {
    u = Utilities.computeHmacSha256Signature(u, passwordBytes);
    result = xorBytes(result, u);
  }

  return result.slice(0, keyLength);
}

function hashPassword(password) {
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("La contraseña es obligatoria.");
  }

  const saltHex = generateSalt();
  const saltBytes = hexToBytes(saltHex);
  const hashBytes = pbkdf2(
    password,
    saltBytes,
    PASSWORD_CONFIG.iterations,
    PASSWORD_CONFIG.keyLength,
  );
  const hashHex = bytesToHex(hashBytes);

  return {
    hash: hashHex,
    salt: saltHex,
  };
}

function verifyPassword(password, storedHash, storedSalt) {
  if (typeof password !== "string" || !password) {
    return false;
  }

  if (typeof storedHash !== "string" || !storedHash) {
    return false;
  }

  if (typeof storedSalt !== "string" || !storedSalt) {
    return false;
  }

  let saltBytes;

  try {
    saltBytes = hexToBytes(storedSalt);
  } catch (error) {
    return false;
  }

  const calculatedHashBytes = pbkdf2(
    password,
    saltBytes,
    PASSWORD_CONFIG.iterations,
    PASSWORD_CONFIG.keyLength,
  );
  let storedHashBytes;

  try {
    storedHashBytes = hexToBytes(storedHash);
  } catch (error) {
    return false;
  }
  return constantTimeCompare(calculatedHashBytes, storedHashBytes);
}

function constantTimeCompare(a, b) {

  if (!Array.isArray(a) || !Array.isArray(b)) {
    return false;
  }

  if (a.length !== b.length) {
    return false;
  }

  let difference = 0;

  for (let i = 0; i < a.length; i++) {
    const byteA = a[i] & 0xff;
    const byteB = b[i] & 0xff;
    difference |= byteA ^ byteB;
  }

  return difference === 0;
}

/* AUTENTICACIÓN LOGIN */

/* Configuración de seguridad del login. */
const LOGIN_CONFIG = {
  maxFailedAttempts: 5,
  blockMinutes: 15,
};

/* LOGIN */

function loginUser(username, password) {
  const sheetUsers = obtainSheet(config_().SH_USER_REGISTRATION);

  const lock = LockService.getScriptLock();

  /* Validaciones básicas */

  if (typeof username !== "string" || !username.trim()) {
    return {
      success: false,
      message: "Correo o celular incorrectos.",
    };
  }

  if (typeof password !== "string" || !password) {
    return {
      success: false,
      message: "Correo o celular incorrectos.",
    };
  }

  username = username.trim().toLowerCase();

  lock.waitLock(10000);

  try {
    /* Obtener usuarios */

    const values = sheetUsers.getDataRange().getValues();

    if (values.length <= 1) {
      return {
        success: false,
        message: "Correo o celular incorrectos.",
      };
    }

    /* Buscar usuario */

    let userRow = -1;
    let user = null;

    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const rowPhone = String(row[2]).trim();
      const rowEmail = String(row[3]).trim().toLowerCase();

      if (rowEmail === username || rowPhone === username) {
        userRow = i + 1;

        user = {
          id: row[0],
          name: row[1],
          phone: row[2],
          email: row[3],
          password: row[4],
          salt: row[5],
          failedAttempts: Number(row[6]) || 0,
          blockedUntil: row[7],
          status: row[8],
          role: row[9],
          createdAt: row[10],
          updatedAt: row[11],
          lastLogin: row[12],
          passwordChangedAt: row[13],
          emailVerified: row[14],
        };
        break;
      }
    }

    /* Usuario no encontrado */

    if (!user) {
      return {
        success: false,
        message: "Correo o celular incorrectos.",
      };
    }

    /* Estado de cuenta */

    if (String(user.status).toLowerCase() !== "active") {
      return {
        success: false,
        message: "La cuenta no está disponible.",
      };
    }

    /* Comprobar bloqueo */

    if (user.blockedUntil) {
      const blockedUntil = new Date(user.blockedUntil);
      const now = new Date();

      if (blockedUntil.getTime() > now.getTime()) {
        return {
          success: false,
          message:
            "La cuenta está temporalmente bloqueada. Intenta nuevamente más tarde.",
        };
      }

      user.failedAttempts = 0;

      sheetUsers.getRange(userRow, 7).setValue(0);
      sheetUsers.getRange(userRow, 8).clearContent();
    }

    /* Verificar contraseña */

    const passwordCorrect = verifyPassword(password, user.password, user.salt);

    /* CONTRASEÑA INCORRECTA */

    if (!passwordCorrect) {
      const failedAttempts = user.failedAttempts + 1;

      if (failedAttempts >= LOGIN_CONFIG.maxFailedAttempts) {
        const blockedUntil = new Date(
          Date.now() + LOGIN_CONFIG.blockMinutes * 60 * 1000,
        );

        sheetUsers.getRange(userRow, 7).setValue(failedAttempts);
        sheetUsers.getRange(userRow, 8).setValue(blockedUntil);
        sheetUsers.getRange(userRow, 12).setValue(new Date());

        return {
          success: false,
          message:
            "Demasiados intentos fallidos. La cuenta ha sido bloqueada temporalmente.",
        };
      }

      sheetUsers.getRange(userRow, 7).setValue(failedAttempts);

      return {
        success: false,
        message: "Correo o celular incorrectos.",
      };
    }

    /* LOGIN CORRECTO */

    const now = new Date();

    sheetUsers.getRange(userRow, 7).setValue(0);
    sheetUsers.getRange(userRow, 8).clearContent();
    sheetUsers.getRange(userRow, 13).setValue(now);
    sheetUsers.getRange(userRow, 12).setValue(now);

    /* Se genera el token de sesión */
    const token = createSession(user.id);

    /* RESPUESTA */

    return {
      success: true,
      message: "Inicio de sesión exitoso.",
      token: token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    };
  } finally {
    lock.releaseLock();
  }
}

/* Sessiones */

function createSession (userId) {
  const token = Utilities.getUuid() + Utilities.getUuid();
  const cache = CacheService.getScriptCache();
  cache.put(token, String(userId), 21600);
  return token;
}

function getRequesterFromToken (token) {
  if(!token) return null;
  const cache = CacheService.getScriptCache();
  const userId = cache.get(token);
  if(!userId) return null;
  return userId;
}
