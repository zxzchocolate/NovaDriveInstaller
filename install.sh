#!/bin/sh

set -eu

BASE="https://zxzchocolate.github.io/NovaDriveInstaller"
BIN="$HOME/.local/bin"

echo "NovaDrive Installer"
echo

if ! command -v node >/dev/null 2>&1
then
    echo "Node.js 18 or newer is required."
    echo "Install Node.js and run the installer again."
    exit 1
fi

NODE_VERSION="$(node -p 'process.versions.node.split(".")[0]')"

if [ "$NODE_VERSION" -lt 18 ]
then
    echo "Node.js 18 or newer is required."
    exit 1
fi

mkdir -p "$BIN"

echo "Downloading NovaDrive..."

curl -fsSL \
    "$BASE/novadrive.mjs" \
    -o "$BIN/novadrive.mjs"

echo "Installing Puter.js..."

cd "$BIN"

if [ ! -f package.json ]
then
    printf '%s\n' \
'{"private":true,"dependencies":{"@heyputer/puter.js":"latest"}}' \
        > package.json
fi

npm install --silent

cat > "$BIN/novadrive" <<EOF
#!/bin/sh
exec node "$BIN/novadrive.mjs" "\$@"
EOF

chmod +x "$BIN/novadrive"

case ":$PATH:" in
    *":$BIN:"*)
        ;;
    *)
        echo
        echo "Add this to your shell profile:"
        echo
        echo 'export PATH="$HOME/.local/bin:$PATH"'
        echo
        ;;
esac

echo
echo "NovaDrive installed."
echo
echo "Run:"
echo
echo "    novadrive"
echo
