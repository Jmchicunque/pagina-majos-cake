/**
 * Verificación de correo por código de 6 dígitos.
 * Guardar como: backend/controllers/verificationController.js
 *
 * Funciones que llama el frontend (google.script.run):
 *   - verifyRegistrationCode(verificationId, code)
 *   - resendRegistrationCode(verificationId)
 *
 * Función interna que usa createUser:
 *   - createVerificationRequest_({ name, email })
 */

const VERIFICATION_CONFIG = {
    CODE_MINUTES: 10,       // vigencia del código (coincide con el texto de verify-email.html)
    MAX_ATTEMPTS: 5,        // intentos fallidos por código
    RESEND_SECONDS: 60,     // espera mínima entre reenvíos
    MAX_RESENDS: 5,         // reenvíos máximos por solicitud
    CACHE_SECONDS: 21600    // el registro vive 6 h (máximo de CacheService)
};

/* ---------- Utilidades internas ---------- */

function verificationKey_(verificationId) {
    return "verify:" + verificationId;
}

function generateVerificationCode_() {
    const n = parseInt(Utilities.getUuid().replace(/-/g, "").substring(0, 8), 16);
    return String(100000 + (n % 900000));
}

function hashVerificationCode_(code, verificationId) {
    const bytes = Utilities.computeDigest(
        Utilities.DigestAlgorithm.SHA_256,
        verificationId + ":" + code
    );
    return bytes
        .map(function (b) { return ("0" + (b & 0xff).toString(16)).slice(-2); })
        .join("");
}

function escapeHtml_(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// URL pública del logo (opcional). Si se deja vacía, el correo muestra el nombre en texto.
const EMAIL_LOGO_URL = "";

function buildVerificationEmailHtml_(name, code, minutes) {
    // Paleta tomada de css/styles.html (body.main-mode)
    const softCoral = "#FF8593";   // --soft-coral
    const softPink = "#F4BEC4";    // --soft-pink
    const lightPink = "#F2D9DC";   // --light-pink
    const palePink = "#F5EAEC";    // --pale-pink
    const babyPink = "#F6EEEF";    // --baby-pink
    const borderGray = "#D1D1D1";  // --cultured-darker
    const dark = "#2B2B2B";        // --onyx-darker
    const black = "#0D0D0D";       // --onyx-black
    const gray = "#787878";        // --sonic-silver
    const font = "'Poppins', Arial, Helvetica, sans-serif";

    const brand = EMAIL_LOGO_URL
        ? `<img src="${EMAIL_LOGO_URL}" alt="Majos Cake Medellín" width="140" style="display:block;margin:0 auto;border:0;">`
        : `<span style="font-size:24px;font-weight:600;letter-spacing:3px;color:${dark};">MAJOS CAKE</span><br>` +
          `<span style="font-size:11px;font-weight:500;letter-spacing:6px;color:${dark};">MEDELLÍN</span>`;

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap" rel="stylesheet">
<title>Verificar cuenta</title>
</head>
<body style="margin:0;padding:0;background:${babyPink};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${babyPink};">
Tu código de verificación es ${code}. Caduca en ${minutes} minutos.
</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${babyPink};padding:28px 12px;">
<tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid ${borderGray};border-radius:10px;overflow:hidden;">

    <tr>
      <td align="center" style="background:${lightPink};border-bottom:3px solid ${softCoral};padding:26px 24px;font-family:${font};line-height:1.3;">
        ${brand}
      </td>
    </tr>

    <tr>
      <td align="center" style="padding:36px 36px 0;font-family:${font};">
        <h1 style="margin:0 0 12px;font-size:18px;font-weight:400;letter-spacing:1px;text-transform:uppercase;color:${dark};">Verificar cuenta</h1>
        <table role="presentation" align="center" cellpadding="0" cellspacing="0">
          <tr><td width="60" height="2" style="width:60px;height:2px;line-height:2px;font-size:0;background:${softCoral};">&nbsp;</td></tr>
        </table>
      </td>
    </tr>

    <tr>
      <td align="center" style="padding:24px 36px 0;font-family:${font};font-size:14px;font-weight:300;line-height:1.6;color:${dark};">
        <p style="margin:0 0 10px;">Hola <b style="font-weight:600;">${escapeHtml_(name)}</b>,</p>
        <p style="margin:0;">
          Para completar tu registro en <b style="font-weight:600;">MAJOS CAKE MEDELLÍN</b>,
          ingresa este código de seis dígitos en la página.
        </p>
      </td>
    </tr>

    <tr>
      <td align="center" style="padding:26px 36px 8px;font-family:${font};">
        <p style="margin:0 0 10px;font-size:11px;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:${gray};">Tu código de verificación</p>
        <table role="presentation" align="center" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="background:${palePink};border:1px solid ${softPink};border-radius:10px;padding:16px 32px 16px 42px;font-family:${font};font-size:32px;font-weight:600;letter-spacing:10px;color:${black};">
              ${code}
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td align="center" style="padding:16px 36px 24px;font-family:${font};font-size:13px;font-weight:300;line-height:1.6;color:${dark};">
        <p style="margin:0 0 6px;">Este código caduca en <b style="font-weight:600;">${minutes} minutos</b>.</p>
        <p style="margin:0;color:${gray};">Si no creaste esta cuenta, puedes ignorar este mensaje.</p>
      </td>
    </tr>

    <tr>
      <td style="padding:0 36px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="background:${babyPink};border-radius:10px;padding:12px 16px;font-family:${font};font-size:12px;font-weight:300;line-height:1.6;color:${gray};">
              Por tu seguridad, no compartas este código con nadie.
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td align="center" style="background:${lightPink};padding:18px 32px;font-family:${font};font-size:12px;font-weight:300;letter-spacing:1.2px;color:${dark};">
        &copy; Majos Cake Medellín
      </td>
    </tr>

  </table>
</td></tr>
</table>
</body>
</html>`;
}

function sendVerificationEmail_(email, name, code) {
    const minutes = VERIFICATION_CONFIG.CODE_MINUTES;

    MailApp.sendEmail({
        to: email,
        name: "Majos Cake Medellín",
        subject: "Tu código de verificación | Majos Cake Medellín",
        body:
            "Hola " + name + ",\n\n" +
            "Tu código de verificación para Majos Cake Medellín es: " + code + "\n\n" +
            "Caduca en " + minutes + " minutos. Si no creaste esta cuenta, ignora este mensaje.",
        htmlBody: buildVerificationEmailHtml_(name, code, minutes)
    });
}

function markEmailAsVerified_(email) {
    const sheet = obtainSheet(config_().SH_USER_REGISTRATION);
    const lastRow = sheet.getLastRow();

    if (lastRow < 2) return false;

    const emails = sheet.getRange(2, 4, lastRow - 1, 1).getValues();

    for (let i = 0; i < emails.length; i++) {
        if (String(emails[i][0]).trim().toLowerCase() === email) {
            const row = i + 2;
            sheet.getRange(row, 12).setValue(new Date()); // updatedAt
            sheet.getRange(row, 15).setValue(true);       // emailVerified
            return true;
        }
    }

    return false;
}

/* ---------- Usada por createUser ---------- */

function createVerificationRequest_(user) {
    const verificationId = Utilities.getUuid();
    const code = generateVerificationCode_();
    const now = Date.now();

    const record = {
        email: user.email,
        name: user.name,
        codeHash: hashVerificationCode_(code, verificationId),
        expiresAt: now + VERIFICATION_CONFIG.CODE_MINUTES * 60 * 1000,
        attempts: 0,
        resends: 0,
        lastSentAt: now
    };

    CacheService.getScriptCache().put(
        verificationKey_(verificationId),
        JSON.stringify(record),
        VERIFICATION_CONFIG.CACHE_SECONDS
    );

    try {
        sendVerificationEmail_(user.email, user.name, code);
    } catch (error) {
        // Si falla el correo, el usuario aún puede usar "Reenviar código".
        console.error("No se pudo enviar el correo de verificación:", error);
    }

    return verificationId;
}

/* ---------- Llamadas desde el frontend ---------- */

function verifyRegistrationCode(verificationId, code) {
    const cache = CacheService.getScriptCache();
    const key = verificationKey_(verificationId);
    const lock = LockService.getScriptLock();

    lock.waitLock(10000);

    try {
        const raw = cache.get(key);

        if (!raw) {
            return {
                success: false,
                message: "La solicitud de verificación expiró. Intenta iniciar sesión o registrarte de nuevo."
            };
        }

        const record = JSON.parse(raw);

        if (record.attempts >= VERIFICATION_CONFIG.MAX_ATTEMPTS) {
            return {
                success: false,
                message: "Demasiados intentos. Solicita un código nuevo."
            };
        }

        if (Date.now() > record.expiresAt) {
            return {
                success: false,
                message: "El código expiró. Solicita uno nuevo."
            };
        }

        const submitted = String(code || "").trim();

        if (!/^\d{6}$/.test(submitted)) {
            return {
                success: false,
                message: "El código debe tener 6 dígitos."
            };
        }

        if (hashVerificationCode_(submitted, verificationId) !== record.codeHash) {
            record.attempts += 1;
            cache.put(key, JSON.stringify(record), VERIFICATION_CONFIG.CACHE_SECONDS);

            const left = VERIFICATION_CONFIG.MAX_ATTEMPTS - record.attempts;

            return {
                success: false,
                message: "Código incorrecto. Intentos restantes: " + left + "."
            };
        }

        if (!markEmailAsVerified_(record.email)) {
            return {
                success: false,
                message: "No se encontró el usuario a verificar."
            };
        }

        cache.remove(key);

        return {
            success: true,
            message: "Tu correo fue verificado. Ya puedes iniciar sesión."
        };

    } finally {
        lock.releaseLock();
    }
}

function resendRegistrationCode(verificationId) {
    const cache = CacheService.getScriptCache();
    const key = verificationKey_(verificationId);
    const lock = LockService.getScriptLock();

    lock.waitLock(10000);

    try {
        const raw = cache.get(key);

        if (!raw) {
            return {
                success: false,
                message: "La solicitud de verificación expiró. Intenta iniciar sesión o registrarte de nuevo."
            };
        }

        const record = JSON.parse(raw);
        const now = Date.now();

        const waitSeconds = Math.ceil(
            (record.lastSentAt + VERIFICATION_CONFIG.RESEND_SECONDS * 1000 - now) / 1000
        );

        if (waitSeconds > 0) {
            return {
                success: false,
                message: "Espera " + waitSeconds + " segundos antes de pedir otro código."
            };
        }

        if (record.resends >= VERIFICATION_CONFIG.MAX_RESENDS) {
            return {
                success: false,
                message: "Alcanzaste el máximo de reenvíos. Inténtalo más tarde."
            };
        }

        const code = generateVerificationCode_();

        record.codeHash = hashVerificationCode_(code, verificationId);
        record.expiresAt = now + VERIFICATION_CONFIG.CODE_MINUTES * 60 * 1000;
        record.attempts = 0;
        record.resends += 1;
        record.lastSentAt = now;

        sendVerificationEmail_(record.email, record.name, code);

        cache.put(key, JSON.stringify(record), VERIFICATION_CONFIG.CACHE_SECONDS);

        return {
            success: true,
            message: "Te enviamos un código nuevo a tu correo."
        };

    } finally {
        lock.releaseLock();
    }
}