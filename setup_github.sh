#!/usr/bin/env bash
set -euo pipefail

REPO_NAME="${REPO_NAME:-text-to-sql-proactive-data-analyst-engine}"
VISIBILITY="${VISIBILITY:-public}"

if ! command -v git >/dev/null 2>&1; then
  echo "git is required" >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI is required. Install gh and run: gh auth login" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub CLI is not authenticated. Run: gh auth login" >&2
  exit 1
fi

OWNER="$(gh api user --jq .login)"
OWNER_ID="$(gh api user --jq .id)"

git init
git config user.name "${GIT_AUTHOR_NAME:-$OWNER}"
git config user.email "${GIT_AUTHOR_EMAIL:-$OWNER_ID+$OWNER@users.noreply.github.com}"

git add .gitattributes .gitignore .env.example .nvmrc .python-version LICENSE package.json
git commit -m "chore: initialize proactive analyst monorepo"

git add infra/db/init.sql packages/shared/contracts
git commit -m "infra: add semantic analytics control plane schema"

git add docker-compose.yml storage/.gitkeep
git commit -m "infra: add isolated analyst engine topology"

git add package-lock.json apps/web/package.json apps/web/tsconfig.json apps/web/next.config.mjs apps/web/next-env.d.ts apps/web/Dockerfile apps/web/public apps/web/eslint.config.mjs apps/web/.prettierrc apps/web/.prettierignore apps/web/src/app/layout.tsx apps/web/src/app/page.tsx
git commit -m "feat(gateway): scaffold MCP-style event gateway"

git add apps/web/src/lib/config.ts apps/web/src/lib/db.ts apps/web/src/lib/queue.ts
git commit -m "feat(gateway): add Postgres and Redis stream adapters"

git add apps/web/src/lib/mcp.ts
git commit -m "feat(gateway): expose analyst tool registry"

git add apps/web/src/lib/analysis.ts
git commit -m "feat(gateway): persist analysis requests asynchronously"

git add apps/web/src/app/api/analysis/route.ts apps/web/src/app/api/analysis/[id]/route.ts apps/web/src/app/api/mcp/tools/route.ts
git commit -m "feat(gateway): expose analysis and MCP APIs"

git add apps/web/src/lib/analysis.test.ts apps/web/src/lib/mcp.test.ts apps/web/src/app/api/analysis/route.test.ts apps/web/src/app/api/analysis/route.integration.test.ts apps/web/vitest.config.ts
git commit -m "test(gateway): cover analyst admission and integration flow"

git add services/engine/pyproject.toml services/engine/Dockerfile services/engine/analyst_engine/__init__.py services/engine/analyst_engine/config.py services/engine/analyst_engine/db.py services/engine/analyst_engine/main.py
git commit -m "feat(engine): scaffold semantic analyst runtime"

git add services/engine/analyst_engine/semantic_layer.py services/engine/analyst_engine/planner.py
git commit -m "feat(engine): add semantic layer and query planner"

git add services/engine/analyst_engine/validator.py services/engine/analyst_engine/charting.py
git commit -m "feat(engine): add SQL validation and chart payload builder"

git add services/engine/analyst_engine/worker.py
git commit -m "feat(engine): consume Redis stream analysis jobs"

git add services/engine/tests
git commit -m "test(engine): cover semantic planning validation and worker behavior"

git add .github/workflows/ci.yml
git commit -m "ci: add Node and Python quality pipeline"

git add README.md docs scripts setup_github.sh
git commit -m "docs: add proactive analyst case study"

if ! gh repo view "$OWNER/$REPO_NAME" >/dev/null 2>&1; then
  gh repo create "$REPO_NAME" "--$VISIBILITY" --source=. --remote=origin
else
  git remote remove origin >/dev/null 2>&1 || true
  git remote add origin "https://github.com/$OWNER/$REPO_NAME.git"
fi

git branch -M main
git push -u origin main

gh repo edit "$OWNER/$REPO_NAME" \
  --description "MCP-style Text-to-SQL analyst engine with semantic layer, Redis Streams, read-only SQL sandbox, and CI-tested workflows." \
  --homepage "https://github.com/$OWNER/$REPO_NAME#readme" \
  --add-topic text-to-sql \
  --add-topic mcp \
  --add-topic ai-infrastructure \
  --add-topic nextjs \
  --add-topic fastapi \
  --add-topic redis-streams \
  --add-topic postgresql \
  --add-topic docker \
  --add-topic typescript \
  --add-topic python \
  --add-topic semantic-layer

echo "Published $REPO_NAME to GitHub."
