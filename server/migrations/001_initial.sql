-- Care content is ciphertext. The server can query operational metadata only.
CREATE TABLE users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE,
 password_hash text NOT NULL, role text NOT NULL CHECK(role IN ('patient','caregiver')),
 vault_envelope jsonb NOT NULL, recovery_envelope jsonb NOT NULL,
 email_verified boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE profiles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES users(id),
 payload jsonb NOT NULL, consent_version text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX profiles_owner ON profiles(owner_id);
CREATE TABLE memberships (
 profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 role text NOT NULL CHECK(role IN ('owner','caregiver','patient')), key_envelope jsonb NOT NULL,
 PRIMARY KEY(profile_id,user_id)
);
CREATE INDEX memberships_user ON memberships(user_id,profile_id);
CREATE TABLE action_tokens (
 token_hash text PRIMARY KEY, user_id uuid REFERENCES users(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('verify','reset','invite')), email text,
 profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL
);
CREATE INDEX action_tokens_expiry ON action_tokens(expires_at);
CREATE TABLE photos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 storage_key text NOT NULL UNIQUE, bytes integer NOT NULL CHECK(bytes > 0), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX photos_profile ON photos(profile_id);
CREATE TABLE records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('memory','person','reminder','practice','health')),
 payload jsonb NOT NULL, photo_id uuid REFERENCES photos(id), version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX records_page ON records(profile_id,kind,created_at DESC,id DESC);
CREATE TABLE audit_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, user_id uuid REFERENCES users(id),
 profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE, action text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_profile_date ON audit_events(profile_id,created_at DESC);
