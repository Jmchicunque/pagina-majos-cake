function connection () {
    return SpreadsheetApp.openById(config_().ID_DATABASE);
}

function obtainSheet (name) {
    return connection().getSheetByName(name);
}

function getData (name) {
    return obtainSheet(name).getDataRange().getDisplayValues();
}