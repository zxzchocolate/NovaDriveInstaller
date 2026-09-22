#!/bin/sh

set -eu

BASE="https://zxzchocolate.github.io/NovaDriveInstaller"
APP="$HOME/.novadrive"
BIN="$HOME/.local/bin"

echo "NovaDrive Installer"
echo

if ! command -v node >/dev/null 2>&1
then
    echo "error: Node.js 18 or newer is required."
    exit 1
fi

VERSION="$(node -p 'process.versions.node.split(".")[0]')"

if [ "$VERSION" -lt 18 ]
then
    echo "error: Node.js 18 or newer is required."
    exit 1
fi

mkdir -p "$APP"
mkdir -p "$BIN"

echo "Downloading NovaDrive..."

curl -fsSL \
    "$BASE/novadrive.mjs" \
    -o "$APP/novadrive.mjs"

cat > "$APP/package.json" <<'EOF'
{
  "name": "novadrive",
  "private": true,
  "type": "module",
  "dependencies": {
    "@heyputer/puter.js": "latest"
  }
}
EOF

echo "Installing dependencies..."

cd "$APP"

npm install --silent

cat > "$BIN/novadrive" <<EOF
#!/bin/sh
exec node "$APP/novadrive.mjs" "\$@"
EOF

chmod +x "$BIN/novadrive"

echo
echo "NovaDrive installed."
echo

case ":$PATH:" in
    *":$BIN:"*)
        echo "Run:"
        echo "  novadrive"
        ;;
    *)
        echo "Add ~/.local/bin to your PATH:"
        echo
        echo '  export PATH="$HOME/.local/bin:$PATH"'
        echo
        echo "Then run:"
        echo "  novadrive"
        ;;
esac
