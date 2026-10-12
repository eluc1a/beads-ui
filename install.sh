#!/bin/sh
# Install Beads UI as a login service: systemd user unit on Linux, launchd agent on macOS.
# The service gets the PATH of the shell that runs this script, so bd and node must be on it.
# Re-run after a move or a PATH change.
set -e
DIR=$(cd "$(dirname "$0")" && pwd)
PY=$(command -v python3) || { echo "python3 not found" >&2; exit 1; }
command -v bd >/dev/null || { echo "bd not found: npm install -g @beads/bd" >&2; exit 1; }

case "$(uname)" in
Linux)
  U=~/.config/systemd/user/beads-ui.service
  mkdir -p "$(dirname "$U")"
  rm -f "$U"
  cat > "$U" <<EOF
[Unit]
Description=Beads UI: live LAN dependency board for all beads projects
After=network-online.target

[Service]
ExecStart=$PY $DIR/server.py --host 0.0.0.0
Environment="PATH=$PATH"
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
EOF
  systemctl --user daemon-reload
  systemctl --user enable beads-ui
  systemctl --user restart beads-ui
  loginctl enable-linger "$USER"
  ;;
Darwin)
  P=~/Library/LaunchAgents/com.beads-ui.plist
  mkdir -p "$(dirname "$P")"
  cat > "$P" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.beads-ui</string>
  <key>ProgramArguments</key>
  <array><string>$PY</string><string>$DIR/server.py</string><string>--host</string><string>0.0.0.0</string></array>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>$PATH</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardErrorPath</key><string>/tmp/beads-ui.log</string>
</dict>
</plist>
EOF
  launchctl bootout "gui/$(id -u)" "$P" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$P"
  ;;
*) echo "unsupported OS: $(uname)" >&2; exit 1 ;;
esac

for i in 1 2 3 4 5 6 7 8 9 10; do
  curl -s localhost:8765/api/projects && echo && exit 0
  sleep 1
done
echo "beads-ui did not answer on port 8765" >&2
exit 1
