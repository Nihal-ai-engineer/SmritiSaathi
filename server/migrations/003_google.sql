CREATE TABLE google_identities (
 subject text PRIMARY KEY, user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE google_flows (
 state_hash text PRIMARY KEY, nonce text NOT NULL, verifier text NOT NULL,
 link_user uuid REFERENCES users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes'
);
CREATE TABLE google_setups (
 token_hash text PRIMARY KEY, subject text NOT NULL, email text NOT NULL,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes'
);
