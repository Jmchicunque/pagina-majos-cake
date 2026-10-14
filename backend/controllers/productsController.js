/**
 * Productos (desayunos) del panel administrativo.
 * Guardar como: backend/controllers/productsController.js
 *
 * Hojas que usa (definidas en config.js):
 *   - products         -> catálogo
 *   - product_history  -> historial de cambios (solo se agregan filas)
 *
 * Funciones que llama el frontend (google.script.run):
 *   - createProduct(token, productData)
 *   - updateProduct(token, productId, productData)
 *   - setProductStatus(token, productId, status)
 *   - uploadProductImage(token, productId, fileData)
 *   - listProductsAdmin(token)
 *   - getPublicProducts()            (sin token, solo productos activos)
 */

const PRODUCT_ROLES = ["admin", "subadmin"];

const PRODUCT_COLUMNS = [
    "id", "name", "description", "price", "category", "imageId",
    "status", "createdBy", "createdAt", "updatedBy", "updatedAt"
];

const HISTORY_COLUMNS = [
    "id", "productId", "action", "field", "oldValue", "newValue", "userId", "createdAt"
];

const PRODUCT_RULES = {
    NAME_MAX: 80,
    DESCRIPTION_MAX: 500,
    CATEGORY_MAX: 40,
    PRICE_MIN: 1000,                  // ajusta estos límites a tu negocio
    PRICE_MAX: 5000000,
    PRICE_CHANGE_CONFIRM_RATIO: 0.5,  // cambios de precio mayores al 50 % piden confirmación
    IMAGE_MAX_BYTES: 3 * 1024 * 1024
};

/* ---------- Utilidades internas ---------- */

function formatProductDate_(value) {
    if (value instanceof Date) {
        return Utilities.formatDate(value, "America/Bogota", "dd/MM/yyyy HH:mm");
    }
    return value ? String(value) : "";
}

function formatProductPrice_(number) {
    return "$" + String(number).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function headersMatch_(sheet, expected) {
    if (sheet.getLastColumn() < expected.length) return false;

    const headers = sheet.getRange(1, 1, 1, expected.length).getValues()[0];

    return expected.every(function (name, i) {
        return String(headers[i]).trim() === name;
    });
}

function getProductSheets_() {
    const products = obtainSheet(config_().SH_PRODUCTS);
    const history = obtainSheet(config_().SH_PRODUCT_HISTORY);

    if (!products || !history) {
        return {
            success: false,
            message: "No se encontraron las hojas products y product_history."
        };
    }

    if (!headersMatch_(products, PRODUCT_COLUMNS) || !headersMatch_(history, HISTORY_COLUMNS)) {
        return {
            success: false,
            message: "Los encabezados de las hojas de productos no coinciden con los esperados."
        };
    }

    return { success: true, products: products, history: history };
}

function nextSheetId_(sheet) {
    const lastRow = sheet.getLastRow();

    if (lastRow < 2) return 1;

    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    let max = 0;

    ids.forEach(function (row) {
        const n = Number(row[0]) || 0;
        if (n > max) max = n;
    });

    return max + 1;
}

function rowToProduct_(row) {
    const product = {};
    PRODUCT_COLUMNS.forEach(function (column, i) {
        product[column] = row[i];
    });
    return product;
}

function productToRow_(product) {
    return PRODUCT_COLUMNS.map(function (column) {
        return product[column] === undefined ? "" : product[column];
    });
}

function findProductRow_(sheet, productId) {
    const lastRow = sheet.getLastRow();

    if (lastRow < 2) return null;

    const values = sheet.getRange(2, 1, lastRow - 1, PRODUCT_COLUMNS.length).getValues();

    for (let i = 0; i < values.length; i++) {
        if (String(values[i][0]) === String(productId)) {
            return { rowNumber: i + 2, product: rowToProduct_(values[i]) };
        }
    }

    return null;
}

function buildProductImageUrl_(imageId) {
    if (!imageId) return "";
    return "https://drive.google.com/thumbnail?id=" + encodeURIComponent(imageId) + "&sz=w1000";
}

// Las fechas (Date) no se pueden devolver al navegador: se convierten a texto.
function toAdminProduct_(product) {
    return {
        id: product.id,
        name: product.name,
        description: product.description,
        price: Number(product.price) || 0,
        category: product.category,
        status: product.status,
        imageUrl: buildProductImageUrl_(product.imageId),
        createdBy: product.createdBy,
        createdAt: formatProductDate_(product.createdAt),
        updatedBy: product.updatedBy,
        updatedAt: formatProductDate_(product.updatedAt)
    };
}

function toPublicProduct_(product) {
    return {
        id: product.id,
        name: product.name,
        description: product.description,
        price: Number(product.price) || 0,
        category: product.category,
        imageUrl: buildProductImageUrl_(product.imageId)
    };
}

function validateProductData_(data) {
    if (!data || typeof data !== "object") {
        return { valid: false, message: "No se recibieron los datos del producto." };
    }

    const name = String(data.name || "").trim();
    const description = String(data.description || "").trim();
    const category = String(data.category || "").trim();
    const price = Number(data.price);

    if (!name) return { valid: false, message: "El nombre es obligatorio." };
    if (!description) return { valid: false, message: "La descripción es obligatoria." };
    if (!category) return { valid: false, message: "La categoría es obligatoria." };

    if (name.length > PRODUCT_RULES.NAME_MAX) {
        return { valid: false, message: "El nombre no puede superar " + PRODUCT_RULES.NAME_MAX + " caracteres." };
    }

    if (description.length > PRODUCT_RULES.DESCRIPTION_MAX) {
        return { valid: false, message: "La descripción no puede superar " + PRODUCT_RULES.DESCRIPTION_MAX + " caracteres." };
    }

    if (category.length > PRODUCT_RULES.CATEGORY_MAX) {
        return { valid: false, message: "La categoría no puede superar " + PRODUCT_RULES.CATEGORY_MAX + " caracteres." };
    }

    // Un texto que empieza con = + - @ se interpretaría como fórmula en Google Sheets.
    const texts = [name, description, category];

    for (let i = 0; i < texts.length; i++) {
        if (/^[=+\-@]/.test(texts[i])) {
            return { valid: false, message: "Los textos no pueden comenzar con los símbolos = + - @." };
        }
    }

    if (!Number.isInteger(price)) {
        return { valid: false, message: "El precio debe ser un número entero, sin puntos ni decimales." };
    }

    if (price < PRODUCT_RULES.PRICE_MIN || price > PRODUCT_RULES.PRICE_MAX) {
        return {
            valid: false,
            message: "El precio debe estar entre " + formatProductPrice_(PRODUCT_RULES.PRICE_MIN) +
                " y " + formatProductPrice_(PRODUCT_RULES.PRICE_MAX) + "."
        };
    }

    return {
        valid: true,
        values: { name: name, description: description, category: category, price: price }
    };
}

function appendProductHistory_(historySheet, entries, userId) {
    if (!entries.length) return;

    let id = nextSheetId_(historySheet);
    const now = new Date();

    const rows = entries.map(function (entry) {
        return [
            id++,
            entry.productId,
            entry.action,
            entry.field,
            entry.oldValue === undefined ? "" : entry.oldValue,
            entry.newValue === undefined ? "" : entry.newValue,
            userId,
            now
        ];
    });

    historySheet
        .getRange(historySheet.getLastRow() + 1, 1, rows.length, HISTORY_COLUMNS.length)
        .setValues(rows);
}

function detectImageType_(bytes) {
    const b = bytes.map(function (value) { return value & 0xff; });

    if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
        return { mimeType: "image/jpeg", extension: "jpg" };
    }

    if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
        return { mimeType: "image/png", extension: "png" };
    }

    if (b.length > 12 &&
        b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
        b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
        return { mimeType: "image/webp", extension: "webp" };
    }

    return null;
}

/* ---------- Funciones del panel (requieren rol admin o subadmin) ---------- */

function createProduct(token, productData) {
    const authorization = requireRole(token, PRODUCT_ROLES);
    if (!authorization.success) return authorization;

    const validation = validateProductData_(productData);
    if (!validation.valid) return { success: false, message: validation.message };

    const sheets = getProductSheets_();
    if (!sheets.success) return sheets;

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
        const userId = authorization.user.id;
        const values = validation.values;
        const now = new Date();
        const id = nextSheetId_(sheets.products);

        // Nace "inactive": se publica cuando tenga imagen y el admin la active.
        const product = {
            id: id,
            name: values.name,
            description: values.description,
            price: values.price,
            category: values.category,
            imageId: "",
            status: "inactive",
            createdBy: userId,
            createdAt: now,
            updatedBy: userId,
            updatedAt: now
        };

        sheets.products.appendRow(productToRow_(product));

        appendProductHistory_(sheets.history, [{
            productId: id,
            action: "create",
            field: "product",
            oldValue: "",
            newValue: values.name
        }], userId);

        return {
            success: true,
            message: "El producto se creó correctamente.",
            product: toAdminProduct_(product)
        };

    } finally {
        lock.releaseLock();
    }
}

function updateProduct(token, productId, productData) {
    const authorization = requireRole(token, PRODUCT_ROLES);
    if (!authorization.success) return authorization;

    const validation = validateProductData_(productData);
    if (!validation.valid) return { success: false, message: validation.message };

    const sheets = getProductSheets_();
    if (!sheets.success) return sheets;

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
        const found = findProductRow_(sheets.products, productId);

        if (!found) return { success: false, message: "El producto no existe." };

        const current = found.product;
        const values = validation.values;
        const oldPrice = Number(current.price) || 0;

        if (oldPrice > 0 && values.price !== oldPrice) {
            const ratio = Math.abs(values.price - oldPrice) / oldPrice;

            if (ratio > PRODUCT_RULES.PRICE_CHANGE_CONFIRM_RATIO && productData.confirmPriceChange !== true) {
                return {
                    success: false,
                    requiresConfirmation: true,
                    message: "El precio cambia de " + formatProductPrice_(oldPrice) + " a " +
                        formatProductPrice_(values.price) + ". Confirma para guardar."
                };
            }
        }

        const changes = [];

        ["name", "description", "category", "price"].forEach(function (field) {
            const before = field === "price" ? oldPrice : String(current[field] || "");
            const after = values[field];

            if (before !== after) {
                changes.push({
                    productId: current.id,
                    action: "update",
                    field: field,
                    oldValue: before,
                    newValue: after
                });
                current[field] = after;
            }
        });

        if (!changes.length) {
            return {
                success: true,
                message: "No hay cambios para guardar.",
                product: toAdminProduct_(current)
            };
        }

        const userId = authorization.user.id;

        current.updatedBy = userId;
        current.updatedAt = new Date();

        sheets.products
            .getRange(found.rowNumber, 1, 1, PRODUCT_COLUMNS.length)
            .setValues([productToRow_(current)]);

        appendProductHistory_(sheets.history, changes, userId);

        return {
            success: true,
            message: "El producto se actualizó correctamente.",
            product: toAdminProduct_(current)
        };

    } finally {
        lock.releaseLock();
    }
}

function setProductStatus(token, productId, status) {
    const authorization = requireRole(token, PRODUCT_ROLES);
    if (!authorization.success) return authorization;

    const newStatus = String(status || "").trim().toLowerCase();

    if (newStatus !== "active" && newStatus !== "inactive") {
        return { success: false, message: "El estado debe ser active o inactive." };
    }

    const sheets = getProductSheets_();
    if (!sheets.success) return sheets;

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
        const found = findProductRow_(sheets.products, productId);

        if (!found) return { success: false, message: "El producto no existe." };

        const current = found.product;
        const oldStatus = String(current.status || "").trim().toLowerCase();

        if (oldStatus === newStatus) {
            return { success: true, message: "El producto ya tenía ese estado.", product: toAdminProduct_(current) };
        }

        if (newStatus === "active" && !current.imageId) {
            return { success: false, message: "Sube una imagen antes de activar el producto." };
        }

        const userId = authorization.user.id;

        current.status = newStatus;
        current.updatedBy = userId;
        current.updatedAt = new Date();

        sheets.products
            .getRange(found.rowNumber, 1, 1, PRODUCT_COLUMNS.length)
            .setValues([productToRow_(current)]);

        appendProductHistory_(sheets.history, [{
            productId: current.id,
            action: "status",
            field: "status",
            oldValue: oldStatus,
            newValue: newStatus
        }], userId);

        return {
            success: true,
            message: newStatus === "active" ? "El producto fue activado." : "El producto fue desactivado.",
            product: toAdminProduct_(current)
        };

    } finally {
        lock.releaseLock();
    }
}

/**
 * fileData = { base64: "...", name: "foto.jpg" }
 * El navegador debe reducir la imagen antes de enviarla (máx. 3 MB).
 */
function uploadProductImage(token, productId, fileData) {
    const authorization = requireRole(token, PRODUCT_ROLES);
    if (!authorization.success) return authorization;

    if (!fileData || typeof fileData.base64 !== "string" || !fileData.base64) {
        return { success: false, message: "No se recibió la imagen." };
    }

    const base64 = fileData.base64.replace(/^data:[^;]+;base64,/, "");

    if (base64.length * 0.75 > PRODUCT_RULES.IMAGE_MAX_BYTES) {
        return { success: false, message: "La imagen supera los 3 MB." };
    }

    let bytes;

    try {
        bytes = Utilities.base64Decode(base64);
    } catch (error) {
        return { success: false, message: "La imagen no es válida." };
    }

    const type = detectImageType_(bytes);

    if (!type) {
        return { success: false, message: "Solo se permiten imágenes JPG, PNG o WEBP." };
    }

    const sheets = getProductSheets_();
    if (!sheets.success) return sheets;

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    let createdFile = null;

    try {
        const found = findProductRow_(sheets.products, productId);

        if (!found) return { success: false, message: "El producto no existe." };

        const current = found.product;
        const oldImageId = String(current.imageId || "");
        const fileName = "product-" + current.id + "-" + Date.now() + "." + type.extension;
        const blob = Utilities.newBlob(bytes, type.mimeType, fileName);

        try {
            const folder = DriveApp.getFolderById(config_().ID_PRODUCT_IMAGES_FOLDER);
            createdFile = folder.createFile(blob);
            createdFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch (error) {
            console.error("Error al guardar la imagen en Drive:", error);

            if (createdFile) createdFile.setTrashed(true);

            return {
                success: false,
                message: "No se pudo guardar la imagen en Drive. Revisa la carpeta configurada y sus permisos."
            };
        }

        const userId = authorization.user.id;

        current.imageId = createdFile.getId();
        current.updatedBy = userId;
        current.updatedAt = new Date();

        sheets.products
            .getRange(found.rowNumber, 1, 1, PRODUCT_COLUMNS.length)
            .setValues([productToRow_(current)]);

        appendProductHistory_(sheets.history, [{
            productId: current.id,
            action: "image",
            field: "imageId",
            oldValue: oldImageId,
            newValue: current.imageId
        }], userId);

        // La imagen anterior no se borra de Drive: queda como respaldo.
        return {
            success: true,
            message: "La imagen se guardó correctamente.",
            product: toAdminProduct_(current)
        };

    } finally {
        lock.releaseLock();
    }
}

function listProductsAdmin(token) {
    const authorization = requireRole(token, PRODUCT_ROLES);
    if (!authorization.success) return authorization;

    const sheets = getProductSheets_();
    if (!sheets.success) return sheets;

    const lastRow = sheets.products.getLastRow();

    if (lastRow < 2) return { success: true, products: [] };

    const values = sheets.products
        .getRange(2, 1, lastRow - 1, PRODUCT_COLUMNS.length)
        .getValues();

    const products = values
        .map(function (row) { return toAdminProduct_(rowToProduct_(row)); })
        .reverse(); // los más recientes primero

    return { success: true, products: products };
}

/* ---------- Pública (sin token) ---------- */

function getPublicProducts() {
    const sheets = getProductSheets_();
    if (!sheets.success) return { success: false, message: "No se pudo cargar el catálogo." };

    const lastRow = sheets.products.getLastRow();

    if (lastRow < 2) return { success: true, products: [] };

    const values = sheets.products
        .getRange(2, 1, lastRow - 1, PRODUCT_COLUMNS.length)
        .getValues();

    const products = values
        .map(rowToProduct_)
        .filter(function (product) {
            return String(product.status).trim().toLowerCase() === "active";
        })
        .map(toPublicProduct_);

    return { success: true, products: products };
}