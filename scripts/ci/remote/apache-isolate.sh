# Streamed to the production host by scripts/ci/ssh-exec.sh
# (production-apache-isolate.yml). Anonymous fetch — the repo is public.
set -e
export GIT_TERMINAL_PROMPT=0
cd /var/www/mmsv2

git fetch origin main 2>/dev/null || true
git reset --hard origin/main
bash scripts/apply-production-host-isolation.sh apps/api/.env < /dev/null
