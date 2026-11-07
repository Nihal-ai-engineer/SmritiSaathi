ALTER TABLE sessions ADD COLUMN last_seen timestamptz NOT NULL DEFAULT now();
UPDATE sessions SET expires_at=LEAST(expires_at,now()+interval '5 days');
CREATE TABLE passkeys (
 id text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 public_key bytea NOT NULL, counter bigint NOT NULL, transports jsonb NOT NULL,
 salt text NOT NULL, vault_envelope jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX passkeys_user ON passkeys(user_id);
CREATE TABLE challenges (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES users(id) ON DELETE CASCADE,
 kind text NOT NULL, challenge text NOT NULL, expires_at timestamptz NOT NULL DEFAULT now()+interval '5 minutes'
);
CREATE INDEX challenges_expiry ON challenges(expires_at);
