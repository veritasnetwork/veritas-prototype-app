#!/bin/bash

# Veritas Protocol - Run All Tests
# This script runs all tests in the /tests directory

set -e  # Exit on any error

echo "🧪 Running All Veritas Protocol Tests"
echo "====================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
FAILED_FILES=()

# Function to run a single test file
run_test() {
    local test_file="$1"
    local test_name=$(basename "$test_file" .test.ts)

    echo ""
    echo -e "${BLUE}Running: $test_name${NC}"
    echo "----------------------------------------"

    if /Users/josh/.deno/bin/deno test --allow-net --allow-env "$test_file" --no-check; then
        echo -e "${GREEN}✅ PASSED: $test_name${NC}"
        ((PASSED_TESTS++))
    else
        echo -e "${RED}❌ FAILED: $test_name${NC}"
        ((FAILED_TESTS++))
        FAILED_FILES+=("$test_file")
    fi

    ((TOTAL_TESTS++))
}

echo -e "${YELLOW}Discovering test files...${NC}"

# Find all test files recursively
TEST_FILES=$(find /Users/josh/veritas/veritas-prototype-app/tests -name "*.test.ts" -type f | sort)

if [ -z "$TEST_FILES" ]; then
    echo -e "${RED}No test files found in /tests directory${NC}"
    exit 1
fi

echo "Found test files:"
echo "$TEST_FILES" | while read -r file; do
    echo "  - $(basename "$file")"
done

echo ""
echo -e "${YELLOW}Starting test execution...${NC}"

# Run each test file
while IFS= read -r test_file; do
    run_test "$test_file"
done <<< "$TEST_FILES"

# Summary
echo ""
echo "=========================================="
echo -e "${BLUE}📊 TEST SUMMARY${NC}"
echo "=========================================="
echo -e "Total tests run: ${TOTAL_TESTS}"
echo -e "${GREEN}Passed: ${PASSED_TESTS}${NC}"
echo -e "${RED}Failed: ${FAILED_TESTS}${NC}"

if [ ${FAILED_TESTS} -gt 0 ]; then
    echo ""
    echo -e "${RED}Failed test files:${NC}"
    for failed_file in "${FAILED_FILES[@]}"; do
        echo -e "  ${RED}- $(basename "$failed_file")${NC}"
    done
    echo ""
    echo -e "${RED}❌ Some tests failed. Check the output above for details.${NC}"
    exit 1
else
    echo ""
    echo -e "${GREEN}🎉 All tests passed successfully!${NC}"
    exit 0
fi