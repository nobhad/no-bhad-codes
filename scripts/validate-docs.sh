#!/bin/bash
# Documentation Validation Script
# Checks for common documentation issues
#
# Usage:
#   ./scripts/validate-docs.sh           # Check all docs
#   ./scripts/validate-docs.sh --fix     # Auto-fix where possible
#   npm run docs:validate                 # Via npm

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0
FIX_MODE=false

# Parse arguments
if [[ "$1" == "--fix" ]]; then
  FIX_MODE=true
fi

echo "========================================"
echo -e "${BLUE}Documentation Validation${NC}"
echo "========================================"
echo ""

# 1. Check for markdown lint violations (if markdownlint is available)
echo -e "${BLUE}1. Checking markdown lint...${NC}"
if command -v npx &> /dev/null; then
  # Only check active docs, not archives
  ACTIVE_DOCS="docs/*.md docs/architecture/*.md docs/features/*.md docs/design/*.md docs/design/typography/*.md docs/api/*.md docs/guides/*.md"

  if $FIX_MODE; then
    npx markdownlint-cli $ACTIVE_DOCS --config .markdownlint.json --fix 2>/dev/null || true
    echo -e "${GREEN}Auto-fixed markdown issues where possible${NC}"
  else
    LINT_OUTPUT=$(npx markdownlint-cli $ACTIVE_DOCS --config .markdownlint.json 2>&1) || true
    if [ -n "$LINT_OUTPUT" ]; then
      LINT_COUNT=$(echo "$LINT_OUTPUT" | wc -l | tr -d ' ')
      echo -e "${YELLOW}Found $LINT_COUNT markdown lint issues:${NC}"
      echo "$LINT_OUTPUT" | head -10
      if [ "$LINT_COUNT" -gt 10 ]; then
        echo "  ... and $((LINT_COUNT - 10)) more"
      fi
      WARNINGS=$((WARNINGS + LINT_COUNT))
    else
      echo -e "${GREEN}No markdown lint issues found${NC}"
    fi
  fi
else
  echo -e "${YELLOW}npx not available, skipping lint check${NC}"
fi
echo ""

# 2. Check for broken file references in active docs only
echo -e "${BLUE}2. Checking for broken file references in active docs...${NC}"
ACTIVE_DOC_DIRS="docs/*.md docs/architecture/*.md docs/features/*.md docs/design/*.md docs/design/typography/*.md docs/api/*.md docs/guides/*.md README.md CONTRIBUTING.md HANDOFF.md"

# A reference only counts as broken if the doc presents it as current. Lines that explicitly
# mark a path as removed/legacy/replaced are accurate history, not errors. Build output
# (dist/...) is generated rather than a source path, so it is stripped before matching.
BROKEN_REFS=$(python3 - $ACTIVE_DOC_DIRS <<'PYEOF'
import os, re, sys

# Longest extensions first, plus a boundary, so "tier-tasks.json" is not read as ".js"
PATH_RE = re.compile(
    r'(?:server|src|tests)/[A-Za-z0-9_/.-]+'
    r'\.(?:tsx|jsx|json|html|mjs|sql|css|ts|js)(?![A-Za-z0-9])')
DIST_RE = re.compile(r'dist/[A-Za-z0-9_/.-]+')
# Lines that frame a path as gone are accurate history, not broken references
REMOVED_RE = re.compile(
    r'removed|deleted|legacy|no longer exist|does not exist|superseded'
    r'|replaced by|historical|former|moved from|relocated',
    re.I)
# Placeholder paths used by the "how to add a feature" tutorials - never real files
EXAMPLE_RE = re.compile(
    r'/my-|/invoicing/|data-table|notification-service|admin-users'
    r'|/example|invoice-service|src/types/invoice\.ts|src/styles/invoicing\.css'
    r'|\.test\.ts$|^tests/e2e/|_add_new_table\.sql$')
RED, NC = '\033[0;31m', '\033[0m'

# A design doc may deliberately name paths that do not exist yet. It opts out with
# <!-- validate-docs: planned-paths --> near the top.
OPT_OUT = '<!-- validate-docs: planned-paths -->'

broken = 0
skipped = []
for doc in sys.argv[1:]:
    if not os.path.isfile(doc) or 'archive' in doc or 'ARCHIVED' in doc:
        continue
    with open(doc, encoding='utf-8', errors='replace') as fh:
        text = fh.read()
    if OPT_OUT in text:
        skipped.append(doc)
        continue
    seen = set()
    if True:
        for line in text.splitlines():
            if REMOVED_RE.search(line):
                continue
            for m in PATH_RE.findall(DIST_RE.sub('', line)):
                if m in seen or os.path.exists(m) or EXAMPLE_RE.search(m):
                    continue
                seen.add(m)
                print(f'{RED}  Broken: {doc} -> {m}{NC}', file=sys.stderr)
                broken += 1
for doc in skipped:
    print(f'  Skipped (planned-paths design doc): {doc}', file=sys.stderr)
print(broken)
PYEOF
)

if [ "$BROKEN_REFS" -eq 0 ]; then
  echo -e "${GREEN}No broken file references found in active docs${NC}"
else
  echo -e "${YELLOW}Found $BROKEN_REFS broken references${NC}"
  WARNINGS=$((WARNINGS + BROKEN_REFS))
fi
echo ""

# 3. Check current_work.md status
echo -e "${BLUE}3. Checking current_work.md...${NC}"
if [ -f "CURRENT_WORK.md" ]; then
  # grep -c already prints 0 on no match and exits 1, so swallow the status only
  COMPLETED_COUNT=$(grep -c "\- COMPLETE" CURRENT_WORK.md 2>/dev/null || true)
  COMPLETED_COUNT=${COMPLETED_COUNT:-0}

  # Check last updated date
  LAST_UPDATED=$(grep -oE "Last Updated.*202[0-9]" CURRENT_WORK.md | head -1 || echo "")
  if [ -n "$LAST_UPDATED" ]; then
    echo "  $LAST_UPDATED"
  fi

  echo "  Completed sections: $COMPLETED_COUNT"

  if [ "$COMPLETED_COUNT" -gt 15 ]; then
    echo -e "${YELLOW}  Consider archiving some completed items (>15)${NC}"
    WARNINGS=$((WARNINGS + 1))
  fi
fi
echo ""

# 4. Check for missing required docs
echo -e "${BLUE}4. Checking required documentation files...${NC}"
REQUIRED_DOCS=(
  "CURRENT_WORK.md"
  "docs/architecture/DATABASE_SCHEMA.md"
  "docs/API_DOCUMENTATION.md"
  "docs/design/CSS_ARCHITECTURE.md"
)

MISSING_DOCS=0
for doc in "${REQUIRED_DOCS[@]}"; do
  if [ ! -f "$doc" ]; then
    echo -e "${RED}  Missing: $doc${NC}"
    MISSING_DOCS=$((MISSING_DOCS + 1))
    ERRORS=$((ERRORS + 1))
  fi
done

if [ $MISSING_DOCS -eq 0 ]; then
  echo -e "${GREEN}All required docs present${NC}"
fi
echo ""

# 5. Check for TODO/FIXME in active docs
echo -e "${BLUE}5. Checking for TODO/FIXME markers...${NC}"
TODO_OUTPUT=$(grep -rE "\b(TODO|FIXME)\b:?" docs/*.md docs/architecture/*.md docs/features/*.md docs/design/*.md docs/guides/*.md 2>/dev/null | grep -v "archive\|ARCHIVED\|TODO list" || true)
TODO_COUNT=$(echo "$TODO_OUTPUT" | grep -cE "\b(TODO|FIXME)\b" 2>/dev/null || true)
TODO_COUNT=${TODO_COUNT:-0}

if [ "$TODO_COUNT" -gt 0 ] && [ -n "$TODO_OUTPUT" ]; then
  echo -e "${YELLOW}Found $TODO_COUNT TODO/FIXME markers:${NC}"
  echo "$TODO_OUTPUT" | head -5
else
  echo -e "${GREEN}No TODO/FIXME markers found${NC}"
fi
echo ""

# Summary
echo "========================================"
echo -e "${BLUE}Summary${NC}"
echo "========================================"
if [ $ERRORS -gt 0 ]; then
  echo -e "Errors:   ${RED}$ERRORS${NC}"
else
  echo -e "Errors:   ${GREEN}0${NC}"
fi

if [ $WARNINGS -gt 0 ]; then
  echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
else
  echo -e "Warnings: ${GREEN}0${NC}"
fi
echo ""

if [ $ERRORS -gt 0 ]; then
  echo -e "${RED}Documentation validation failed${NC}"
  exit 1
elif [ $WARNINGS -gt 10 ]; then
  echo -e "${YELLOW}Documentation has warnings but passed${NC}"
  exit 0
else
  echo -e "${GREEN}Documentation validation passed${NC}"
  exit 0
fi
