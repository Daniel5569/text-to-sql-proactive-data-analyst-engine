CREATE TABLE IF NOT EXISTS organizations (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS data_sources (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  schema_name TEXT NOT NULL,
  readonly_role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, source_name)
);

CREATE TABLE IF NOT EXISTS semantic_terms (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  canonical_metric TEXT NOT NULL,
  allowed_table TEXT NOT NULL,
  allowed_columns TEXT[] NOT NULL,
  definition TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, term)
);

CREATE TABLE IF NOT EXISTS analysis_requests (
  id UUID PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id),
  channel TEXT NOT NULL CHECK (channel IN ('slack', 'api', 'webhook')),
  requester TEXT NOT NULL,
  question TEXT NOT NULL,
  semantic_profile TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS query_attempts (
  id BIGSERIAL PRIMARY KEY,
  analysis_request_id UUID NOT NULL REFERENCES analysis_requests(id) ON DELETE CASCADE,
  generated_sql TEXT NOT NULL,
  validation_status TEXT NOT NULL CHECK (validation_status IN ('accepted', 'rejected')),
  rejection_reason TEXT,
  execution_ms INTEGER,
  row_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chart_payloads (
  id BIGSERIAL PRIMARY KEY,
  analysis_request_id UUID NOT NULL REFERENCES analysis_requests(id) ON DELETE CASCADE,
  chart_type TEXT NOT NULL CHECK (chart_type IN ('bar', 'line', 'table')),
  title TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id BIGSERIAL PRIMARY KEY,
  analysis_request_id UUID REFERENCES analysis_requests(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analytics_customers (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id),
  account_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'churned')),
  created_at DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS analytics_orders (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id),
  customer_id BIGINT NOT NULL REFERENCES analytics_customers(id),
  order_month DATE NOT NULL,
  revenue_cents INTEGER NOT NULL CHECK (revenue_cents >= 0)
);

INSERT INTO organizations (slug, display_name)
VALUES ('demo-co', 'Demo SaaS Co')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO data_sources (organization_id, source_name, schema_name, readonly_role)
SELECT id, 'warehouse', 'public', 'analyst_readonly'
FROM organizations
WHERE slug = 'demo-co'
ON CONFLICT (organization_id, source_name) DO NOTHING;

INSERT INTO semantic_terms (organization_id, term, canonical_metric, allowed_table, allowed_columns, definition)
SELECT id, 'revenue', 'monthly_revenue', 'analytics_orders', ARRAY['order_month', 'revenue_cents'], 'Recognized customer order revenue in cents grouped by month.'
FROM organizations
WHERE slug = 'demo-co'
ON CONFLICT (organization_id, term) DO NOTHING;

INSERT INTO semantic_terms (organization_id, term, canonical_metric, allowed_table, allowed_columns, definition)
SELECT id, 'active customers', 'active_customers', 'analytics_customers', ARRAY['status', 'id'], 'Customers currently marked active.'
FROM organizations
WHERE slug = 'demo-co'
ON CONFLICT (organization_id, term) DO NOTHING;

INSERT INTO analytics_customers (organization_id, account_name, status, created_at)
SELECT id, 'Acme Operations', 'active', '2026-01-15'::date FROM organizations WHERE slug = 'demo-co'
ON CONFLICT DO NOTHING;

INSERT INTO analytics_customers (organization_id, account_name, status, created_at)
SELECT id, 'Northstar Labs', 'active', '2026-02-10'::date FROM organizations WHERE slug = 'demo-co'
ON CONFLICT DO NOTHING;

INSERT INTO analytics_orders (organization_id, customer_id, order_month, revenue_cents)
SELECT o.id, c.id, '2026-04-01'::date, 120000
FROM organizations o JOIN analytics_customers c ON c.organization_id = o.id
WHERE o.slug = 'demo-co' AND c.account_name = 'Acme Operations'
ON CONFLICT DO NOTHING;

INSERT INTO analytics_orders (organization_id, customer_id, order_month, revenue_cents)
SELECT o.id, c.id, '2026-05-01'::date, 175000
FROM organizations o JOIN analytics_customers c ON c.organization_id = o.id
WHERE o.slug = 'demo-co' AND c.account_name = 'Northstar Labs'
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_analysis_requests_status ON analysis_requests(status);
CREATE INDEX IF NOT EXISTS idx_query_attempts_request ON query_attempts(analysis_request_id);
CREATE INDEX IF NOT EXISTS idx_chart_payloads_request ON chart_payloads(analysis_request_id);

