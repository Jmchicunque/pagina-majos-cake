const doGet = () =>
    HtmlService.createTemplateFromFile("frontend/index")
    .evaluate()
    .setTitle("majos cake medellín")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .setSandboxMode(HtmlService.SandboxMode.IFRAME)
    .setFaviconUrl("https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/1f96a.png")
    .addMetaTag("viewport", "width=device-width, initial-scale=1.0");

const include = (page) =>
    HtmlService.createHtmlOutputFromFile(page).getContent();

function getPage (page) {
    const allowedPages = [
        "frontend/views/pages/home",
        "frontend/views/pages/login",
        "frontend/views/pages/register",
        "frontend/views/pages/dashboard"
    ];

    if (!allowedPages.includes(page)) {
        throw new Error("Página no permitida", page);
    }
    
    return HtmlService.createHtmlOutputFromFile(page).getContent();
}