CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE auth.users (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	email TEXT UNIQUE NOT NULL,
	name TEXT NOT NULL,
	role TEXT NOT NULL CHECK (role IN ('rider', 'organizer')),
	oauth_provider TEXT NOT NULL,
	oauth_provider_id TEXT NOT NULL,
	created_at TIMESTAMPTZ DEFAULT now(),
	updated_at TIMESTAMPTZ DEFAULT now(),
	UNIQUE(oauth_provider, oauth_provider_id)
);

CREATE TABLE auth.organizations (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	name TEXT NOT NULL,
	contact_email TEXT NOT NULL,
	scopes TEXT[] NOT NULL DEFAULT '{}',
	owner_id UUID NOT NULL REFERENCES auth.users(id),
	created_at TIMESTAMPTZ DEFAULT now(),
	updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE auth.api_keys (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	org_id UUID NOT NULL REFERENCES auth.organizations(id),
	key_hash TEXT NOT NULL,
	key_prefix TEXT NOT NULL,
	label TEXT,
	scopes TEXT[] NOT NULL,
	expires_at TIMESTAMPTZ,
	revoked_at TIMESTAMPTZ,
	last_used_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE auth.refresh_tokens (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id UUID NOT NULL REFERENCES auth.users(id),
	token_hash TEXT NOT NULL,
	expires_at TIMESTAMPTZ NOT NULL,
	revoked_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ DEFAULT now()
);
