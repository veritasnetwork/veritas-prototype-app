#!/bin/bash

# Script to update authority references in test files
# Phase 4: Global find/replace operations

FILES=(
  "tests/content-pool-icbs.test.ts"
  "tests/pool-factory-icbs.test.ts"
)

for FILE in "${FILES[@]}"; do
  echo "Updating $FILE..."

  # Replace poolAuthority variable references (but not in comments about OLD code)
  sed -i.bak 's/poolAuthority\.publicKey/protocolAuthority.publicKey/g' "$FILE"
  sed -i.bak 's/poolAuthority\]/protocolAuthority]/g' "$FILE"
  sed -i.bak 's/poolAuthority)/protocolAuthority)/g' "$FILE"
  sed -i.bak 's/\[poolAuthority/[protocolAuthority/g' "$FILE"
  sed -i.bak 's/, poolAuthority/, protocolAuthority/g' "$FILE"

  # Replace field references
  sed -i.bak 's/factory\.pool_authority/factory.protocol_authority/g' "$FILE"
  sed -i.bak 's/factory\.factory_authority/factory.protocol_authority/g' "$FILE"

  # Replace in test names and descriptions
  sed -i.bak 's/"pool_authority"/"protocol_authority"/g' "$FILE"
  sed -i.bak 's/"factory_authority"/"upgrade_authority"/g' "$FILE"
  sed -i.bak 's/"pool authority"/"protocol authority"/g' "$FILE"
  sed -i.bak 's/"factory authority"/"upgrade authority"/g' "$FILE"

  echo "  ✓ Completed $FILE"
done

# Clean up backup files
rm -f tests/*.bak

echo "✅ Global find/replace complete"
echo "⚠️  Manual review needed for initializeFactory calls"
