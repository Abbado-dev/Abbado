#!/bin/sh
set -e

REPO="abbado-dev/abbado"
INSTALL_DIR="/usr/local/bin"
BINARY="abbado"
DATA_DIR="$HOME/.abbado"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
DIM='\033[0;90m'
BOLD='\033[1m'
RESET='\033[0m'

info()  { printf "${BOLD}%s${RESET}\n" "$1"; }
ok()    { printf "${GREEN}%s${RESET}\n" "$1"; }
err()   { printf "${RED}error:${RESET} %s\n" "$1" >&2; exit 1; }
dim()   { printf "${DIM}%s${RESET}\n" "$1"; }

# --- Uninstall ---
if [ "${1:-}" = "uninstall" ]; then
  info "Uninstalling Abbado..."

  if [ -f "$INSTALL_DIR/$BINARY" ]; then
    sudo rm -f "$INSTALL_DIR/$BINARY"
    ok "Removed $INSTALL_DIR/$BINARY"
  else
    dim "Binary not found at $INSTALL_DIR/$BINARY"
  fi

  if [ -d "$DATA_DIR" ]; then
    printf "Remove data directory %s? [y/N] " "$DATA_DIR"
    read -r answer
    if [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
      rm -rf "$DATA_DIR"
      ok "Removed $DATA_DIR"
    else
      dim "Kept $DATA_DIR"
    fi
  fi

  ok "Abbado uninstalled."
  exit 0
fi

# --- Install / Update ---
detect_platform() {
  OS=$(uname -s | tr '[:upper:]' '[:lower:]')
  ARCH=$(uname -m)

  case "$OS" in
    darwin) OS="darwin" ;;
    linux)  OS="linux" ;;
    *)      err "Unsupported OS: $OS" ;;
  esac

  case "$ARCH" in
    x86_64|amd64)  ARCH="amd64" ;;
    arm64|aarch64) ARCH="arm64" ;;
    *)             err "Unsupported architecture: $ARCH" ;;
  esac
}

get_latest_version() {
  VERSION=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
    | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"//;s/".*//')

  if [ -z "$VERSION" ]; then
    err "Failed to fetch latest version from GitHub"
  fi
}

download_and_install() {
  FILENAME="${BINARY}-${OS}-${ARCH}"
  URL="https://github.com/$REPO/releases/download/$VERSION/$FILENAME"
  TMP=$(mktemp)

  dim "Downloading $URL"
  curl -fsSL "$URL" -o "$TMP" || err "Download failed. Check that a release exists for $OS/$ARCH."

  chmod +x "$TMP"

  if [ -w "$INSTALL_DIR" ]; then
    mv "$TMP" "$INSTALL_DIR/$BINARY"
  else
    sudo mv "$TMP" "$INSTALL_DIR/$BINARY"
  fi
}

# Main
ACTION="Installing"
if [ -f "$INSTALL_DIR/$BINARY" ]; then
  ACTION="Updating"
fi

detect_platform
info "$ACTION Abbado for $OS/$ARCH..."

get_latest_version
dim "Latest version: $VERSION"

download_and_install

ok "$ACTION complete: $INSTALL_DIR/$BINARY ($VERSION)"
dim ""
dim "Usage:"
dim "  abbado                         Start the server"
dim "  curl -fsSL https://abbado.dev/install.sh | sh              Update"
dim "  curl -fsSL https://abbado.dev/install.sh | sh -s uninstall Remove"
