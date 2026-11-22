#!/usr/bin/env bash
# Run only mocked commands: never starts Docker, PostgreSQL or a browser.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir "$tmp/bin"
cat > "$tmp/bin/docker" <<'MOCK'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$LOG"
case " $* " in
 *' pg_isready '*)
  case " $* " in
   *' -h 127.0.0.1 '*)
    n=$(wc -l < "$PROBES"); echo probe >> "$PROBES"
    [[ "$MODE" == ready && "$n" -ge 2 ]]; exit $? ;;
   *) exit 0 ;;
  esac ;;
 *' psql '*)
  case " $* " in *' -h 127.0.0.1 '*) ;; *) exit 42 ;; esac
  [[ $(wc -l < "$PROBES") -ge 3 ]] || exit 43
  cat >/dev/null ;;
esac
MOCK
printf '#!/usr/bin/env bash\nexit 0\n' > "$tmp/bin/sleep"
cp "$tmp/bin/sleep" "$tmp/bin/pnpm"
chmod +x "$tmp/bin/"*
for script in run-public-tests.sh recurrence-migration.sh; do
 for mode in ready timeout; do
  export LOG="$tmp/log" PROBES="$tmp/probes" MODE="$mode"
  : > "$LOG"; : > "$PROBES"
  status=0
  (cd "$root"; PATH="$tmp/bin:$PATH" bash "tests/$script") > "$tmp/output" 2>&1 || status=$?
  if [[ "$mode" == ready ]]; then
   [[ "$status" == 0 ]] || { echo "FAIL $script ready: $status"; exit 1; }
   grep -q ' psql ' "$LOG"
  else
   [[ "$status" != 0 ]] || { echo "FAIL $script timeout succeeded"; exit 1; }
   [[ $(wc -l < "$PROBES") == 30 ]]
   ! grep -q ' psql ' "$LOG"
   grep -q 'PostgreSQL.*TCP.*ready' "$tmp/output"
  fi
 done
done
echo 'PASS: both harnesses wait for final TCP server and stop after bounded timeout'
