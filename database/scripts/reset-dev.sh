#!/bin/bash
set -eu
# Legacy entrypoint retained. The Node runner refuses application/shared URLs.
exec node "$(dirname "$0")/reset-disposable-test.mjs"
