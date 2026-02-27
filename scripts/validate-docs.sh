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
  ACTIVE_DOCS="docs/*.md docs/architecture/*.md docs/features/*.md docs/design/*.md docs/api/*.md"

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
BROKEN_REFS=0
ACTIVE_DOC_DIRS="docs/*.md docs/architecture/*.md docs/features/*.md docs/design/*.md docs/api/*.md"

for doc in $ACTIVE_DOC_DIRS; do
  if [ -f "$doc" ]; then
    # Skip archived docs
    if [[ "$doc" == *"archive"* ]] || [[ "$doc" == *"ARCHIVED"* ]]; then
      continue
    fi

    # Extract file paths from markdown
    while IFS= read -r filepath; do
      if [ -n "$filepath" ] && [ ! -f "$filepath" ]; then
        # Skip example/template paths used for documentation
        if [[ "$filepath" == *"my-"* ]] || [[ "$filepath" == *"example"* ]] || \
           [[ "$filepath" == *"invoicing-module"* ]] || [[ "$filepath" == *"data-table"* ]] || \
           [[ "$filepath" == *"notification-service"* ]] || [[ "$filepath" == *"base.ts"* ]] || \
           [[ "$filepath" == *"business-card"* ]] || [[ "$filepath" == *"admin-users"* ]]; then
          continue
        fi
        echo -e "${RED}  Broken: $doc -> $filepath${NC}"
        BROKEN_REFS=$((BROKEN_REFS + 1))
      fi
    done < <(grep -oE '(server|src|tests)/[a-zA-Z0-9_/.-]+\.(ts|tsx|js|css)' "$doc" 2>/dev/null | sort -u)
  fi
done

if [ $BROKEN_REFS -eq 0 ]; then
  echo -e "${GREEN}No broken file references found in active docs${NC}"
else
  echo -e "${YELLOW}Found $BROKEN_REFS broken references${NC}"
  WARNINGS=$((WARNINGS + BROKEN_REFS))
fi
echo ""

# 3. Check current_work.md status
echo -e "${BLUE}3. Checking current_work.md...${NC}"
if [ -f "docs/current_work.md" ]; then
  COMPLETED_COUNT=$(grep -c "\- COMPLETE" docs/current_work.md 2>/dev/null || echo "0")

  # Check last updated date
  LAST_UPDATED=$(grep -oE "Last Updated.*202[0-9]" docs/current_work.md | head -1 || echo "")
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
  "docs/current_work.md"
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
TODO_OUTPUT=$(grep -ri "TODO\|FIXME" docs/*.md docs/architecture/*.md docs/features/*.md 2>/dev/null | grep -v "archive\|ARCHIVED" || true)
TODO_COUNT=$(echo "$TODO_OUTPUT" | grep -c "TODO\|FIXME" 2>/dev/null || echo "0")

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
