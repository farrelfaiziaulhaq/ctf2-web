export type User = {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  role: "user" | "admin";
};

export type Session = {
  id: string;
  user_id: number;
  auth_level: "password" | "review" | "passkey";
  created_at: string;
};

export type Incident = {
  id: number;
  author_id: number;
  title: string;
  queue: string;
  body_html: string;
  created_at: string;
};

export type PasskeyRow = {
  id: number;
  user_id: number;
  credential_id: string;
  public_key_spki_b64: string;
  transports_json: string;
  sign_count: number;
  created_at: string;
};

export type ChallengeRow = {
  id: string;
  user_id: number;
  purpose: "register" | "login";
  challenge_b64: string;
  username_hint: string | null;
  expires_at: string;
  used_at: string | null;
};

export type ReportProfile = {
  id: number;
  owner_id: number;
  name: string;
  config_json: string;
  compat_patch_json: string;
  created_at: string;
};
