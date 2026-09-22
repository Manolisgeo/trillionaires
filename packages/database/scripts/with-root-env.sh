#!/bin/sh
set -a
# shellcheck disable=SC1091
. "$(dirname "$0")/../../../.env"
set +a
exec "$@"
