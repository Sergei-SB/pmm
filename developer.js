// ==========================================
// МОДУЛЬ РОЗРОБНИКА (developer.js)
// ==========================================

const DEVELOPER_PASSWORD = "02031985";

function checkDeveloperPassword(callback) {
    showCustomPasswordModal((pass) => {
        if (pass === DEVELOPER_PASSWORD) {
            callback(true);
        } else if (pass !== null) {
            alert("Неправильний пароль Розробника!");
            callback(false);
        } else {
            callback(false);
        }
    });
}