#!/usr/bin/env bash
#
# MMS — single entry point for local dev (PostgreSQL → API :3000 → tenant console :5173)
#
# Usage:
#   ./restart_servers.sh              # start in GNU screen (default, survives agent exit)
#   ./restart_servers.sh status       # ports, screen session, health
#   ./restart_servers.sh stop         # stop screen + servers
#   ./restart_servers.sh --foreground # run in this terminal (Ctrl+C stops)
#   ./restart_servers.sh --turbo      # legacy turbo detached (not recommended)
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

BACKEND_PORT="${MMS_BACKEND_PORT:-3000}"
FRONTEND_PORT="${MMS_FRONTEND_PORT:-5173}"
LOG_DIR="$ROOT_DIR/.logs"
SCREEN_SESSION="${MMS_DEV_SCREEN_SESSION:-mms-dev}"
MAX_LOG_BYTES="${MMS_MAX_LOG_BYTES:-52428800}"

QUICK=false
NO_DOCKER=false
MODE="screen"
CMD="restart"

usage() {
  cat <<EOF
MMS restart_servers.sh — local development stack (single source of truth)

Commands:
  (none)|start|restart   Start dev servers (default: GNU screen)
  status                 Screen session, ports, recent logs
  stop                   Stop screen session and free ports

Options:
  --foreground           Run API + tenant console in this terminal (blocks; Ctrl+C stops)
  --turbo                Legacy: detached turbo (fragile — prefer default screen mode)
  --quick                Skip Vite cache clear / shorten health wait
  --help                 Show this help

URLs:
  Frontend  http://localhost:5173
  Backend   http://localhost:${BACKEND_PORT}/health

Screen (default):
  Attach    screen -r ${SCREEN_SESSION}
  Detach    Ctrl+A then D
  Logs      tail -f .logs/dev.log
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    restart|start|stop|status) CMD="$1"; shift ;;
    --foreground) MODE=foreground; shift ;;
    --turbo) MODE=turbo; shift ;;
    --quick) QUICK=true; shift ;;
    --no-docker) NO_DOCKER=true; shift ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 1 ;;
  esac
done

log() { printf '▸ %s\n' "$*"; }
ok()  { printf '✓ %s\n' "$*"; }
warn(){ printf '⚠ %s\n' "$*" >&2; }
die() { printf '✗ %s\n' "$*" >&2; exit 1; }

port_listener_pids() {
  lsof -t -iTCP:"$1" -sTCP:LISTEN 2>/dev/null || true
}

port_in_use() {
  [ -n "$(port_listener_pids "$1")" ]
}

port_open() {
  nc -w 2 -z localhost "$1" 2>/dev/null || nc -G 2 -z localhost "$1" 2>/dev/null || nc -z localhost "$1" 2>/dev/null
}

session_running() {
  local list
  list="$(screen -ls 2>/dev/null || true)"
  grep -qF ".${SCREEN_SESSION}" <<<"$list"
}

save_port_pid() {
  local port="$1" file="$2" pid
  pid="$(port_listener_pids "$port" | head -1)"
  [ -n "$pid" ] && echo "$pid" >"$file"
}

kill_pid_file() {
  local file="$1" label="$2" pid
  [ -f "$file" ] || return 0
  pid="$(tr -d '[:space:]' <"$file")"
  rm -f "$file"
  [ -n "$pid" ] || return 0
  if kill -0 "$pid" 2>/dev/null; then
    log "Stopping saved $label (pid $pid)..."
    kill -TERM "$pid" 2>/dev/null || true
    sleep 0.3
    kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null || true
  fi
}

log_file_size() {
  [ -f "$1" ] || { echo 0; return; }
  stat -f%z "$1" 2>/dev/null || stat -c%s "$1" 2>/dev/null || echo 0
}

rotate_log_if_huge() {
  local file="$1" size backup
  [ -f "$file" ] || return 0
  size="$(log_file_size "$file")"
  if [ "$size" -gt "$MAX_LOG_BYTES" ]; then
    backup="${file}.$(date +%Y%m%d-%H%M%S).bak"
    log "Rotating oversized log $(basename "$file") (${size} bytes) → $(basename "$backup")"
    mv "$file" "$backup"
    : >"$file"
  fi
}

rotate_logs_if_huge() {
  rotate_log_if_huge "$LOG_DIR/dev.log"
  rotate_log_if_huge "$LOG_DIR/backend.log"
  rotate_log_if_huge "$LOG_DIR/frontend.log"
}

pid_alive() {
  [ -n "$1" ] && kill -0 "$1" 2>/dev/null
}

stop_screen_session() {
  if session_running; then
    log "Stopping screen session '$SCREEN_SESSION'..."
    screen -S "$SCREEN_SESSION" -X quit 2>/dev/null || true
    sleep 0.5
  fi
}

kill_all_on_port() {
  local port="$1" name="$2" pids pid attempt=0
  while [ "$attempt" -lt 8 ]; do
    pids="$(port_listener_pids "$port")"
    [ -z "$pids" ] && return 0
    while IFS= read -r pid; do
      [ -z "$pid" ] && continue
      log "Stopping $name on port $port (pid $pid)..."
      kill -TERM "$pid" 2>/dev/null || true
    done <<<"$pids"
    sleep 0.4
    pids="$(port_listener_pids "$port")"
    if [ -n "$pids" ]; then
      while IFS= read -r pid; do
        [ -z "$pid" ] && continue
        kill -9 "$pid" 2>/dev/null || true
      done <<<"$pids"
      sleep 0.3
    fi
    attempt=$((attempt + 1))
  done
  port_in_use "$port" && warn "Port $port still in use after stop attempts" && return 1
}

kill_repo_dev_processes() {
  local pid cmd
  while IFS= read -r pid; do
    [ -z "$pid" ] && continue
    cmd="$(ps -p "$pid" -o args= 2>/dev/null || true)"
    [[ "$cmd" == *"$ROOT_DIR"* || "$cmd" == *"mms-api"* || "$cmd" == *"mms-tenant-web"* ]] || continue
    case "$cmd" in
      *"turbo"*"run dev"*|*"pnpm"*"dev"*|*"pnpm"*"worker"*|\
      *"/apps/tenant-web"*"vite"*|*"/apps/api"*"tsx"*)
        log "Stopping orphan dev process (pid $pid)..."
        kill -TERM "$pid" 2>/dev/null || true
        ;;
    esac
  done < <(pgrep -f "pnpm|turbo|vite|tsx" 2>/dev/null || true)
  sleep 0.4
  while IFS= read -r pid; do
    [ -z "$pid" ] && continue
    cmd="$(ps -p "$pid" -o args= 2>/dev/null || true)"
    [[ "$cmd" == *"$ROOT_DIR"* || "$cmd" == *"mms-api"* || "$cmd" == *"mms-tenant-web"* ]] || continue
    case "$cmd" in
      *"turbo"*"run dev"*|*"pnpm"*"dev"*|*"pnpm"*"worker"*|\
      *"/apps/tenant-web"*"vite"*|*"/apps/api"*"tsx"*)
        kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null || true
        ;;
    esac
  done < <(pgrep -f "pnpm|turbo|vite|tsx" 2>/dev/null || true)
}

stop_servers() {
  local quiet="${1:-false}" ports_clear=true
  [ "$quiet" != true ] && log "Stopping MMS dev servers..."
  stop_screen_session
  kill_pid_file "$LOG_DIR/dev.pid" "turbo dev"
  kill_pid_file "$LOG_DIR/backend.pid" "backend"
  kill_pid_file "$LOG_DIR/frontend.pid" "frontend"
  kill_all_on_port "$BACKEND_PORT" "backend" || ports_clear=false
  kill_all_on_port "$FRONTEND_PORT" "frontend" || ports_clear=false
  kill_repo_dev_processes
  kill_all_on_port "$BACKEND_PORT" "backend" || ports_clear=false
  kill_all_on_port "$FRONTEND_PORT" "frontend" || ports_clear=false
  rm -f "$LOG_DIR/dev.pid" "$LOG_DIR/backend.pid" "$LOG_DIR/frontend.pid"
  if [ "$quiet" != true ]; then
    if [ "$ports_clear" = true ] && ! port_in_use "$BACKEND_PORT" && ! port_in_use "$FRONTEND_PORT"; then
      ok "Servers stopped (ports $BACKEND_PORT and $FRONTEND_PORT free)"
    else
      warn "Ports may still be in use — run: lsof -iTCP:$BACKEND_PORT,$FRONTEND_PORT -sTCP:LISTEN"
    fi
  fi
}

wait_for_port() {
  local port="$1" label="$2" max="${3:-45}" i=1
  while [ "$i" -le "$max" ]; do
    if port_open "$port"; then
      ok "$label ready on port $port"
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  warn "$label did not open port $port within ${max}s"
  return 1
}

# Waits (bounded) for a port to be released. Prevents a lingering process from
# a previous run causing a doomed start (EADDRINUSE) right after stop_servers.
wait_for_port_free() {
  local port="$1" label="$2" max="${3:-30}" i=1
  while [ "$i" -le "$max" ]; do
    if ! port_in_use "$port"; then
      return 0
    fi
    # The backend drains for ~5s on shutdown; a restart right after a stop used to
    # die in that window with "Ports not free".
    if [ "$i" = 4 ]; then
      log "$label port $port still releasing (waiting for the previous process to drain)..."
    fi
    sleep 0.5
    i=$((i + 1))
  done
  warn "$label port $port still in use after $((max / 2))s — aborting start"
  return 1
}

# Ensures the backend/frontend ports are actually free before launching, so a
# stale listener cannot cause EADDRINUSE. Aborts with a clear message otherwise.
ensure_ports_free() {
  local ok=true
  wait_for_port_free "$BACKEND_PORT" "Backend" || ok=false
  wait_for_port_free "$FRONTEND_PORT" "Frontend" || ok=false
  [ "$ok" = true ] || die "Ports not free — run: lsof -iTCP:$BACKEND_PORT,$FRONTEND_PORT -sTCP:LISTEN"
}

http_check_ok() {
  local url="$1"
  if command -v curl &>/dev/null; then
    curl -sf --max-time 3 "$url" >/dev/null 2>&1
  else
    node -e "fetch(process.argv[1], { signal: AbortSignal.timeout(3000) }).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))" "$url" >/dev/null 2>&1
  fi
}

wait_for_http() {
  local url="$1" label="$2" max="${3:-45}" i=1
  while [ "$i" -le "$max" ]; do
    if http_check_ok "$url"; then
      ok "$label healthy ($url)"
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  warn "$label not healthy at $url"
  return 1
}



check_prerequisites() {
  [ -f "pnpm-workspace.yaml" ] || die "Run from repo root"
  command -v pnpm &>/dev/null || die "pnpm not installed"
  command -v nc &>/dev/null || warn "nc not found"
  if [ ! -d "node_modules" ]; then
    log "Running pnpm install..."
    pnpm install
  fi
  if [ ! -f "apps/api/.env" ]; then
    [ -f "apps/api/.env.example" ] || die "Missing apps/api/.env"
    log "Creating apps/api/.env from .env.example..."
    cp apps/api/.env.example apps/api/.env
    ok "Created apps/api/.env — review JWT_SECRET before production"
  fi
  grep -q '^JWT_SECRET=.\+' apps/api/.env 2>/dev/null || die "JWT_SECRET missing in apps/api/.env"
}

maybe_clear_vite_cache() {
  if [ "$QUICK" = false ]; then
    log "Clearing Vite cache..."
    rm -rf apps/tenant-web/node_modules/.vite 2>/dev/null || true
  fi
}

# Last captured child output, used to decide whether a start failure is a port race.
# The screen child appends to the same dev.log as the legacy turbo mode, so only the
# bytes written after this run's launch are evidence for this run.
START_FAILURE_TAIL=""
START_LOG_OFFSET=0

mark_start_log_offset() {
  START_LOG_OFFSET="$(wc -c <"$LOG_DIR/dev.log" 2>/dev/null || echo 0)"
  START_LOG_OFFSET="${START_LOG_OFFSET// /}"
}

capture_start_failure_tail() {
  local from
  from="$(wc -c <"$LOG_DIR/dev.log" 2>/dev/null || echo 0)"
  from="${from// /}"
  if [ "$from" -gt "$START_LOG_OFFSET" ]; then
    START_FAILURE_TAIL="$(tail -c +"$((START_LOG_OFFSET + 1))" "$LOG_DIR/dev.log" 2>/dev/null | tail -40 || true)"
  else
    START_FAILURE_TAIL=""
  fi
}

start_failure_is_port_race() {
  grep -qE "EADDRINUSE|address already in use|Ports not free" <<<"$START_FAILURE_TAIL"
}

# The screen child writes to dev.log (not frontend.log/backend.log), so the old
# "tail frontend.log" hint was empty by construction and "screen -r" dead-ended
# once the session had exited. Report what actually exists.
print_start_failure_diagnostics() {
  capture_start_failure_tail
  if [ -n "$START_FAILURE_TAIL" ]; then
    warn "── .logs/dev.log (this run, last 20 lines) ──"
    tail -20 <<<"$START_FAILURE_TAIL" >&2 || true
  else
    warn "No .logs/dev.log output was captured"
  fi
  for extra_log in "$LOG_DIR/frontend.log" "$LOG_DIR/backend.log"; do
    [ -f "$extra_log" ] || continue
    warn "── $(basename "$extra_log") (last 10 lines) ──"
    tail -10 "$extra_log" >&2 || true
  done
  if session_running; then
    warn "Screen session '$SCREEN_SESSION' is still running — attach with: screen -r $SCREEN_SESSION"
  else
    warn "No screen session '$SCREEN_SESSION' (it exited) — reproduce in the foreground:"
    warn "  MMS_FOREGROUND_WORKER=1 ./restart_servers.sh --foreground --quick"
  fi
  if port_in_use "$BACKEND_PORT" || port_in_use "$FRONTEND_PORT"; then
    warn "A port is still in use after the child exited — clear it: ./restart_servers.sh stop"
  fi
  if start_failure_is_port_race; then
    warn "The log shows a port conflict — free it first: ./restart_servers.sh stop"
    warn "  lsof -iTCP:$BACKEND_PORT,$FRONTEND_PORT -sTCP:LISTEN"
  fi
}

wait_for_dev_ports() {
  if [ "$QUICK" = true ]; then
    sleep 4
    return 0
  fi
  wait_for_http "http://localhost:$BACKEND_PORT/health" "Backend" 90 || true
  wait_for_port "$FRONTEND_PORT" "Frontend" 45 || true
  sleep 3
  port_in_use "$BACKEND_PORT" && port_in_use "$FRONTEND_PORT" || {
    warn "Servers died shortly after start"
    print_start_failure_diagnostics
    return 1
  }
}

run_dev_foreground() {
  log "MMS dev (foreground) — Ctrl+C to stop"
  echo "  Frontend  http://localhost:$FRONTEND_PORT"
  echo "  Backend   http://localhost:$BACKEND_PORT/health"
  echo ""
  trap 'kill 0 2>/dev/null; exit 0' INT TERM
  pnpm --filter mms-api exec tsx watch src/index.ts &
  sleep 2
  pnpm --filter mms-api exec tsx watch src/worker/index.ts &
  sleep 2
  pnpm --filter mms-tenant-web exec vite &
  wait
}

launch_detached() {
  local logfile="$1" pidfile="$2" workdir="$3"
  shift 3
  local launcher_pid prev_dir="$PWD" cmd_quoted="" arg
  for arg in "$@"; do cmd_quoted+="$(printf '%q' "$arg") "; done
  cd "$workdir" || die "Cannot cd to $workdir"
  nohup setsid bash -c "cd $(printf '%q' "$workdir") && exec $cmd_quoted" >>"$logfile" 2>&1 </dev/null &
  launcher_pid=$!
  echo "$launcher_pid" >"$pidfile"
  disown -h "$launcher_pid" 2>/dev/null || true
  cd "$prev_dir" || cd "$ROOT_DIR"
}

start_servers_turbo() {
  mkdir -p "$LOG_DIR"
  rotate_logs_if_huge
  stop_servers true
  ensure_ports_free
  maybe_clear_vite_cache
  warn "Turbo detached mode is fragile — prefer default screen mode"
  log "Starting dev stack (pnpm dev / turbo) → $LOG_DIR/dev.log"
  launch_detached "$LOG_DIR/dev.log" "$LOG_DIR/dev.pid" "$ROOT_DIR" pnpm dev
  wait_for_dev_ports || die "Turbo dev failed — run: ./restart_servers.sh status"
  save_port_pid "$BACKEND_PORT" "$LOG_DIR/backend.pid"
  save_port_pid "$FRONTEND_PORT" "$LOG_DIR/frontend.pid"
  port_in_use "$BACKEND_PORT" && port_in_use "$FRONTEND_PORT" || die "Servers failed to start"
}

start_servers_screen() {
  command -v screen >/dev/null 2>&1 || die "GNU screen required — install screen or use: ./restart_servers.sh --foreground"

  if session_running && port_open "$BACKEND_PORT" && port_open "$FRONTEND_PORT"; then
    ok "Dev session '$SCREEN_SESSION' already running"
    print_summary
    return 0
  fi

  mkdir -p "$LOG_DIR"
  rotate_logs_if_huge
  stop_servers true
  ensure_ports_free
  maybe_clear_vite_cache
  check_prerequisites

  launch_screen_session() {
    log "Starting dev in screen session '$SCREEN_SESSION'..."
    mark_start_log_offset
    screen -dmS "$SCREEN_SESSION" bash -lc \
      "cd '$ROOT_DIR' && MMS_FOREGROUND_WORKER=1 exec ./restart_servers.sh --foreground --no-docker --quick >>'$LOG_DIR/dev.log' 2>&1"

    # Do not wait the full health budget for a child that died on launch.
    local i=1
    while [ "$i" -le 10 ]; do
      session_running && break
      sleep 1
      i=$((i + 1))
    done
    if ! session_running; then
      warn "Screen session '$SCREEN_SESSION' exited immediately after launch"
      return 1
    fi
    wait_for_dev_ports
  }

  local attempt=1
  while :; do
    if launch_screen_session; then
      break
    fi
    capture_start_failure_tail
    if [ "$attempt" -ge 2 ] || ! start_failure_is_port_race; then
      # wait_for_dev_ports already printed the diagnostics for this attempt.
      die "Dev servers did not start — see the log above"
    fi
    attempt=$((attempt + 1))
    warn "Port conflict on the first attempt — stopping and retrying once..."
    stop_servers true
    sleep 2
    ensure_ports_free || die "Ports not free — run: ./restart_servers.sh stop"
    maybe_clear_vite_cache
  done

  save_port_pid "$BACKEND_PORT" "$LOG_DIR/backend.pid"
  save_port_pid "$FRONTEND_PORT" "$LOG_DIR/frontend.pid"
  port_in_use "$BACKEND_PORT" && port_in_use "$FRONTEND_PORT" || die "Servers failed to start"
}

start_servers_foreground() {
  mkdir -p "$LOG_DIR"
  rotate_logs_if_huge
  stop_servers true
  ensure_ports_free
  maybe_clear_vite_cache
  check_prerequisites
  run_dev_foreground
}

show_status() {
  echo "══ MMS status ══"
  if session_running; then
    ok "Screen session '$SCREEN_SESSION' running (attach: screen -r $SCREEN_SESSION)"
  else
    warn "Screen session '$SCREEN_SESSION' not running"
  fi

  if [ -f "apps/api/.env" ]; then
    local db_url db_host db_port
    db_url="$(grep '^DATABASE_URL=' apps/api/.env | sed 's/DATABASE_URL=//')"
    if [[ "$db_url" == postgres://* || "$db_url" == postgresql://* ]]; then
      local temp="${db_url#*//}"
      temp="${temp#*@}"
      local host_port="${temp%%/*}"
      db_host="${host_port%%:*}"
      db_port="${host_port#*:}"
      [ "$db_port" = "$host_port" ] && db_port=5432
      if nc -w 2 -z "$db_host" "$db_port" 2>/dev/null || nc -G 2 -z "$db_host" "$db_port" 2>/dev/null || nc -z "$db_host" "$db_port" 2>/dev/null; then
        ok "PostgreSQL: database host listening ($db_host:$db_port)"
      else
        warn "PostgreSQL: host not listening ($db_host:$db_port) — verify Docker/Postgres is running"
      fi
    else
      local db_file="${db_url#sqlite://}"
      if [[ "$db_file" != /* ]]; then
        db_file="apps/api/$db_file"
      fi
      if [ -f "$db_file" ]; then
        ok "SQLite: database file exists ($db_file, $(stat -f%z "$db_file" 2>/dev/null || stat -c%s "$db_file" 2>/dev/null) bytes)"
      else
        warn "SQLite: database file not found ($db_file)"
      fi
    fi
  else
    warn "Database: missing apps/api/.env"
  fi

  local be fe
  be="$(port_listener_pids "$BACKEND_PORT" | tr '\n' ' ' | sed 's/ $//')"
  fe="$(port_listener_pids "$FRONTEND_PORT" | tr '\n' ' ' | sed 's/ $//')"

  if [ -n "$be" ]; then
    ok "Backend:  pid $be  http://localhost:$BACKEND_PORT/health"
    http_check_ok "http://localhost:$BACKEND_PORT/health" && echo "" || warn "Backend health check failed"
  else
    warn "Backend:  not listening on port $BACKEND_PORT"
  fi
  if [ -n "$fe" ]; then
    ok "Frontend: pid $fe  http://localhost:$FRONTEND_PORT"
    http_check_ok "http://localhost:$FRONTEND_PORT/" \
      && ok "Frontend HTTP check passed" \
      || warn "Frontend port open but HTTP check failed"
  else
    warn "Frontend: not listening on port $FRONTEND_PORT"
  fi

  if [ -z "$be" ] && [ -z "$fe" ]; then
    echo ""
    echo "── fix ──"
    echo "  ./restart_servers.sh          # start (screen)"
    echo "  ./restart_servers.sh --foreground   # this terminal, blocks"
  fi

  echo ""
  if [ -f "$LOG_DIR/frontend.log" ]; then
    echo "── frontend.log (last 5 lines) ──"
    tail -5 "$LOG_DIR/frontend.log" 2>/dev/null || true
  fi
  if [ -f "$LOG_DIR/backend.log" ]; then
    echo "── backend.log (last 5 lines) ──"
    tail -5 "$LOG_DIR/backend.log" 2>/dev/null || true
  fi
  if [ -f "$LOG_DIR/dev.log" ]; then
    echo "── dev.log (last 5 lines) ──"
    tail -5 "$LOG_DIR/dev.log" 2>/dev/null || true
  fi
}

print_summary() {
  cat <<EOF

════════════════════════════════════════
  MMS is running
════════════════════════════════════════
  New madrasa  http://localhost:$FRONTEND_PORT
  Backend      http://localhost:$BACKEND_PORT/health
  Status       ./restart_servers.sh status
  Stop         ./restart_servers.sh stop
  Attach       screen -r $SCREEN_SESSION
  Logs         tail -f .logs/frontend.log .logs/backend.log

  Tip: open a NEW browser tab after start (not chrome-error:// refresh).
════════════════════════════════════════
EOF
}

main() {
  if [ "${MMS_FOREGROUND_WORKER:-}" = "1" ]; then
    check_prerequisites
    run_dev_foreground
    exit 0
  fi

  case "$CMD" in
    stop) stop_servers ;;
    status) show_status ;;
    restart|start)
      log "MMS $CMD — $ROOT_DIR"
      case "$MODE" in
        foreground) start_servers_foreground ;;
        turbo)
          check_prerequisites
          start_servers_turbo
          print_summary
          ;;
        screen|*)
          start_servers_screen
          print_summary
          ;;
      esac
      ;;
  esac
}

main
