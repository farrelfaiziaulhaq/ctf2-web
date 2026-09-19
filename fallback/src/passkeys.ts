import {
  addPasskey,
  consumeChallenge,
  createChallenge,
  findPasskeyByCredentialId,
  findUserByEmail,
  findUserByUsername,
  getChallenge,
  listPasskeysForUser,
  updatePasskeyCounter,
  type ChallengeRow,
  type User
} from "./db";
import {
  assert,
  b64urlDecode,
  parseAuthData,
  randomChallenge,
  rpIdFromOrigin,
  sha256,
  usernameOrEmailToUserKey,
  verifyAssertionSignature
} from "./lib";

type CeremonyBody = Record<string, any>;
type RegistrationPayload = {
  credentialId: string;
  publicKey: string;
  transports: string[];
  signCount: number;
};
type AssertionMaterial = {
  clientDataJSON: Buffer;
  authenticatorData: Buffer;
  signCount: number;
};

function responseOf(body: CeremonyBody) {
  return (typeof body.response === "object" && body.response ? body.response : {}) as Record<string, any>;
}

function credentialIdOf(body: CeremonyBody) {
  return String(body.id || body.rawId || "");
}

function stringField(source: Record<string, any>, key: string) {
  return String(source[key] || "");
}

function transportsOf(source: Record<string, any>) {
  return Array.isArray(source.transports) ? source.transports.map(String) : [];
}

function requireChallenge(body: CeremonyBody, purpose: ChallengeRow["purpose"]) {
  const challengeId = String(body.challengeId || "");
  const challenge = getChallenge(challengeId);
  assert(challenge, "unknown challenge");
  assert(challenge.purpose === purpose, "wrong challenge purpose");
  assert(!challenge.used_at, "challenge already used");
  assert(Date.parse(challenge.expires_at) > Date.now(), "challenge expired");
  return challenge;
}

function verifyClientData(encodedClientData: string, expectedType: "webauthn.create" | "webauthn.get", expectedChallenge: string, expectedOrigin: string) {
  const clientDataJSON = b64urlDecode(encodedClientData);
  const clientData = JSON.parse(clientDataJSON.toString("utf8"));
  assert(clientData.type === expectedType, "wrong ceremony type");
  assert(clientData.challenge === expectedChallenge, "challenge mismatch");
  assert(clientData.origin === expectedOrigin, "origin mismatch");
  return { clientDataJSON, clientData };
}

function verifyAuthenticatorData(authenticatorDataB64: string, expectedOrigin: string, requireAttestedCredentialData = false) {
  const authenticatorData = b64urlDecode(authenticatorDataB64);
  const parsed = parseAuthData(authenticatorData);
  const expectedRpHash = sha256(rpIdFromOrigin(expectedOrigin));
  assert(Buffer.compare(parsed.rpIdHash, expectedRpHash) === 0, "rp hash mismatch");
  assert((parsed.flags & 0x01) === 0x01, "user not present");
  if (requireAttestedCredentialData) {
    assert((parsed.flags & 0x40) === 0x40, "missing attested credential data");
  }
  return { authenticatorData, parsed };
}

function readRegistrationPayload(body: CeremonyBody, expectedOrigin: string, challengeB64: string) {
  const response = responseOf(body);
  verifyClientData(
    stringField(response, "clientDataJSON"),
    "webauthn.create",
    challengeB64,
    expectedOrigin
  );

  const { parsed } = verifyAuthenticatorData(
    stringField(response, "authenticatorData"),
    expectedOrigin,
    true
  );

  const publicKey = stringField(response, "publicKey");
  assert(publicKey.length > 0, "missing public key");

  return {
    credentialId: credentialIdOf(body),
    publicKey,
    transports: transportsOf(response),
    signCount: parsed.signCount
  } satisfies RegistrationPayload;
}

function storeRegistration(userId: number, payload: RegistrationPayload) {
  addPasskey(userId, payload.credentialId, payload.publicKey, payload.transports, payload.signCount);
}

function readAssertionMaterial(body: CeremonyBody, expectedOrigin: string, challengeB64: string) {
  const response = responseOf(body);
  const { clientDataJSON } = verifyClientData(
    stringField(response, "clientDataJSON"),
    "webauthn.get",
    challengeB64,
    expectedOrigin
  );

  const { authenticatorData, parsed } = verifyAuthenticatorData(
    stringField(response, "authenticatorData"),
    expectedOrigin
  );

  return {
    clientDataJSON,
    authenticatorData,
    signCount: parsed.signCount
  } satisfies AssertionMaterial;
}

function verifyAssertionCredential(body: CeremonyBody, userId: number) {
  const credentialId = credentialIdOf(body);
  const passkey = findPasskeyByCredentialId(credentialId);
  assert(passkey, "unknown credential");
  assert(passkey.user_id === userId, "credential owner mismatch");
  return { credentialId, passkey };
}

function finalizeVerifiedLogin(passkeyId: number, previousSignCount: number, signCount: number, challengeId: string) {
  updatePasskeyCounter(passkeyId, Math.max(previousSignCount, signCount));
  consumeChallenge(challengeId);
}

export function buildRegistrationOptions(user: User, expectedOrigin: string) {
  const challenge = randomChallenge();
  const challengeId = createChallenge(user.id, "register", challenge, user.username);
  return {
    challengeId,
    publicKey: {
      challenge,
      rp: {
        id: rpIdFromOrigin(expectedOrigin),
        name: "Fallback"
      },
      user: {
        id: Buffer.from(String(user.id)).toString("base64url"),
        name: user.username,
        displayName: user.username
      },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred"
      },
      timeout: 120000,
      attestation: "none"
    }
  };
}

export function verifyRegistrationResponse(user: User, body: CeremonyBody, expectedOrigin: string) {
  const challenge = requireChallenge(body, "register");
  assert(challenge.user_id === user.id, "challenge owner mismatch");

  const payload = readRegistrationPayload(body, expectedOrigin, challenge.challenge_b64);
  storeRegistration(user.id, payload);
  consumeChallenge(challenge.id);

  return {
    ok: true,
    username: user.username,
    credentialId: payload.credentialId,
    passkeyCount: listPasskeysForUser(user.id).length
  };
}

export function buildLoginOptions(usernameOrEmail: string, expectedOrigin: string) {
  const userKey = usernameOrEmailToUserKey(usernameOrEmail);
  const user = findUserByUsername(userKey) || findUserByEmail(userKey);
  assert(user, "user not found");
  const passkeys = listPasskeysForUser(user.id);
  assert(passkeys.length > 0, "no passkeys registered");

  const challenge = randomChallenge();
  const challengeId = createChallenge(user.id, "login", challenge, user.username);
  return {
    challengeId,
    publicKey: {
      challenge,
      timeout: 120000,
      rpId: rpIdFromOrigin(expectedOrigin),
      allowCredentials: passkeys.map((row) => ({
        type: "public-key",
        id: row.credential_id,
        transports: JSON.parse(row.transports_json)
      })),
      userVerification: "preferred"
    }
  };
}

export function verifyLoginResponse(body: CeremonyBody, expectedOrigin: string) {
  const challenge = requireChallenge(body, "login");
  const assertion = readAssertionMaterial(body, expectedOrigin, challenge.challenge_b64);
  const { passkey } = verifyAssertionCredential(body, challenge.user_id);

  const signatureOk = verifyAssertionSignature(
    passkey.public_key_spki_b64,
    assertion.authenticatorData,
    assertion.clientDataJSON,
    String(body.response?.signature || "")
  );
  assert(signatureOk, "signature verification failed");

  finalizeVerifiedLogin(passkey.id, passkey.sign_count, assertion.signCount, challenge.id);

  return {
    ok: true,
    userId: challenge.user_id,
    username: challenge.username_hint
  };
}
