#!/bin/bash

# Pre-commit check script for vbwd-fe-user
# Usage:
#   ./bin/pre-commit-check.sh              # Run only style checks (eslint, vue-tsc)
#   ./bin/pre-commit-check.sh --style      # Style checks
#   ./bin/pre-commit-check.sh --unit       # Style + unit tests
#   ./bin/pre-commit-check.sh --integration # Style + integration tests
#   ./bin/pre-commit-check.sh --all        # Run everything
#   ./bin/pre-commit-check.sh --full       # Alias for --all

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

# Default values
RUN_STYLE=true
RUN_UNIT=false
RUN_INTEGRATION=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --style)
            RUN_STYLE=true
            RUN_UNIT=false
            RUN_INTEGRATION=false
            shift
            ;;
        --unit)
            RUN_STYLE=true
            RUN_UNIT=true
            RUN_INTEGRATION=false
            shift
            ;;
        --integration)
            RUN_STYLE=true
            RUN_UNIT=false
            RUN_INTEGRATION=true
            shift
            ;;
        --all|--full)
            RUN_STYLE=true
            RUN_UNIT=true
            RUN_INTEGRATION=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --style       Run style checks (eslint, vue-tsc) [default]"
            echo "  --unit        Run style checks + unit tests"
            echo "  --integration Run style checks + integration tests"
            echo "  --all         Run everything"
            echo "  --help        Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                  # Style checks only"
            echo "  $0 --unit           # Style checks + unit tests"
            echo "  $0 --integration    # Style checks + integration tests"
            echo "  $0 --all            # Everything"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Track overall success
OVERALL_EXIT=0

# Function to print section header
print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

# Function to print success
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Function to print error
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Function to run style checks
run_style() {
    print_header "Style Checks"

    cd "$REPO_DIR"

    # ESLint
    echo "Running ESLint..."
    if npm run lint; then
        print_success "ESLint passed"
    else
        print_error "ESLint failed"
        OVERALL_EXIT=1
    fi

    # TypeScript check
    echo ""
    echo "Running TypeScript check..."
    if npx vue-tsc --noEmit; then
        print_success "TypeScript check passed"
    else
        print_error "TypeScript check failed"
        OVERALL_EXIT=1
    fi
}

# Function to run unit tests
run_unit() {
    print_header "Unit Tests"

    cd "$REPO_DIR"

    echo "Running unit tests..."
    VITEST_OUT=$(npx vitest run vue/tests/unit/ 2>&1)
    VITEST_EXIT=$?
    echo "$VITEST_OUT" | tail -20
    if [[ "$VITEST_EXIT" == "0" ]]; then
        print_success "Unit tests passed"
    else
        print_error "Unit tests failed"
        OVERALL_EXIT=1
    fi
}

# Function to run integration tests
run_integration() {
    print_header "Integration Tests"

    cd "$REPO_DIR"

    echo "Running integration tests..."
    # Check if integration test files exist
    if ls vue/tests/integration/*.spec.ts vue/tests/integration/**/*.spec.ts 2>/dev/null | head -1 | grep -q . 2>/dev/null; then
        if npx vitest run vue/tests/integration/ 2>&1 | tail -20; then
            print_success "Integration tests passed"
        else
            print_error "Integration tests failed"
            OVERALL_EXIT=1
        fi
    else
        print_warning "No integration test files found (skipped)"
    fi
}

# Main execution
echo -e "${BLUE}Pre-commit Check Script (vbwd-fe-user)${NC}"
echo "======================================"
echo ""
echo "Configuration:"
echo "  Style:       $RUN_STYLE"
echo "  Unit:        $RUN_UNIT"
echo "  Integration: $RUN_INTEGRATION"

# Run style checks
if [[ "$RUN_STYLE" == "true" ]]; then
    run_style
fi

# Run unit tests
if [[ "$RUN_UNIT" == "true" ]]; then
    run_unit
fi

# Run integration tests
if [[ "$RUN_INTEGRATION" == "true" ]]; then
    run_integration
fi

# Summary
echo ""
print_header "Summary"

if [[ "$OVERALL_EXIT" == "0" ]]; then
    print_success "All checks passed!"
else
    print_error "Some checks failed!"
fi

exit $OVERALL_EXIT
