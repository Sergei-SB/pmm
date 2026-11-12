function isLegacyPasswordStorageKey(key) {
    return ['dev_system_passwords', 'dev_security_logs'].includes(key.toLowerCase());
}

function sanitizeRoleStorage(key, raw) {
    if (key !== 'dev_managed_users' || !raw) return raw;
    try {
        const users = JSON.parse(raw);
        if (Array.isArray(users) && users.some(user => user && Object.hasOwn(user, 'pin'))) {
            return JSON.stringify(users.map(user => {
                if (!user) return user;
                const {pin, ...profile} = user;
                return profile;
            }));
        }
    } catch (_) {}
    return raw;
}

try {
    if (localStorage.getItem('__sync_role_password_migration') !== '1') {
        for (const key of ['currentRole', 'app_current_role', 'isDeveloperLoggedIn']) {
            localStorage.removeItem(key);
        }
        localStorage.setItem('__sync_role_password_migration', '1');
    }
    localStorage.removeItem('dev_system_passwords');
    localStorage.removeItem('dev_security_logs');
    const key = 'dev_managed_users';
    const raw = localStorage.getItem(key);
    const sanitized = sanitizeRoleStorage(key, raw);
    if (sanitized !== raw) localStorage.setItem(key, sanitized);
} catch (_) {}

async function verifyRolePassword(role, password) {
    try {
        const server = window.APP_SERVER_URL || 'https://pmm-server.onrender.com';
        const response = await fetch(server + '/api/auth/role', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({role, password}),
            cache: 'no-store',
            signal: AbortSignal.timeout(70000)
        });
        if (response.status === 400 || response.status === 401) return false;
        if (response.status === 429) {
            alert('Забагато спроб входу. Спробуйте за хвилину.');
            return null;
        }
        if (response.ok && (await response.json()).ok === true) return true;
    } catch (_) {}
    alert('Сервер входу недоступний. Спробуйте ще раз пізніше.');
    return null;
}
