#!/usr/bin/env bash
# Build index.html from source modules + generate lab-data.js from labs.json.
# labs.json is the single source of truth for both the lab engine and the checker.
set -euo pipefail
cd "$(dirname "$0")"

node -e '
const fs = require("fs");
const labs = JSON.parse(fs.readFileSync("labs.json", "utf8"));
fs.writeFileSync("lab-data.js", "window.LAB_DATA = " + JSON.stringify(labs, null, 2) + ";\n");
console.log("lab-data.js generated (" + Object.keys(labs).length + " labs)");
'

cat _base.html modules/m1.html modules/m2.html modules/m3.html modules/m4.html _footer.html > index.html
echo "index.html built ($(wc -c < index.html | tr -d " ") bytes)"
