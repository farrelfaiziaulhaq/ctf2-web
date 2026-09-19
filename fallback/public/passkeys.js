function toBase64Url(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let raw = "";
  for (const byte of bytes) {
    raw += String.fromCharCode(byte);
  }
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(input) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const raw = atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function setStatus(message) {
  const output = document.getElementById("passkey-status");
  if (output) {
    output.hidden = false;
    output.textContent = typeof message === "string" ? message : JSON.stringify(message, null, 2);
  }
}

function errorMessage(error, fallback) {
  return error instanceof Error ? error.message : fallback;
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!response.ok) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
    throw new Error(parsed?.error || text || `Request failed with status ${response.status}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text || "Invalid server response.");
  }
}

async function registerPasskey() {
  if (!navigator.credentials?.create) {
    setStatus("Passkey registration is not available in this browser.");
    return;
  }
  setStatus("Fetching registration options...");
  const optionsResponse = await fetch("/api/passkeys/register/options");
  const options = await readJsonResponse(optionsResponse);
  const publicKey = options.publicKey;
  publicKey.challenge = fromBase64Url(publicKey.challenge);
  publicKey.user.id = fromBase64Url(publicKey.user.id);

  const credential = await navigator.credentials.create({ publicKey });
  const response = credential.response;

  const payload = {
    challengeId: options.challengeId,
    id: credential.id,
    rawId: toBase64Url(credential.rawId),
    type: credential.type,
    response: {
      attestationObject: toBase64Url(response.attestationObject),
      clientDataJSON: toBase64Url(response.clientDataJSON),
      publicKey: response.getPublicKey ? toBase64Url(response.getPublicKey()) : "",
      publicKeyAlgorithm: response.getPublicKeyAlgorithm ? response.getPublicKeyAlgorithm() : -7,
      authenticatorData: response.getAuthenticatorData ? toBase64Url(response.getAuthenticatorData()) : "",
      transports: response.getTransports ? response.getTransports() : []
    }
  };

  setStatus("Submitting registration response...");
  const verify = await fetch("/api/passkeys/register/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  setStatus(await verify.text());
}

async function loginPasskey(event) {
  event.preventDefault();
  if (!navigator.credentials?.get) {
    setStatus("Passkey authentication is not available in this browser.");
    return;
  }
  const username = document.getElementById("passkey-username").value;
  setStatus("Fetching login options...");
  const optionsResponse = await fetch(`/api/passkeys/login/options?username=${encodeURIComponent(username)}`);
  const options = await readJsonResponse(optionsResponse);
  const publicKey = options.publicKey;
  publicKey.challenge = fromBase64Url(publicKey.challenge);
  publicKey.allowCredentials = publicKey.allowCredentials.map((item) => ({
    ...item,
    id: fromBase64Url(item.id)
  }));

  const assertion = await navigator.credentials.get({ publicKey });
  const payload = {
    challengeId: options.challengeId,
    id: assertion.id,
    rawId: toBase64Url(assertion.rawId),
    type: assertion.type,
    response: {
      authenticatorData: toBase64Url(assertion.response.authenticatorData),
      clientDataJSON: toBase64Url(assertion.response.clientDataJSON),
      signature: toBase64Url(assertion.response.signature),
      userHandle: assertion.response.userHandle ? toBase64Url(assertion.response.userHandle) : null
    }
  };
  const verify = await fetch("/api/passkeys/login/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const text = await verify.text();
  setStatus(text);
  if (verify.ok) {
    location.href = "/dashboard";
  }
}

window.setupPasskeyRegistration = function setupPasskeyRegistration() {
  document.getElementById("register-passkey")?.addEventListener("click", () => {
    registerPasskey().catch((error) => setStatus(errorMessage(error, "Passkey registration failed.")));
  });
};

window.setupPasskeyLogin = function setupPasskeyLogin() {
  document.getElementById("passkey-login-form")?.addEventListener("submit", (event) => {
    loginPasskey(event).catch((error) => setStatus(errorMessage(error, "Passkey authentication failed.")));
  });
};
