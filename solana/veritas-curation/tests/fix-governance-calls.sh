#!/bin/bash

# Fix governance function calls to use upgrade authority pattern

FILE="tests/pool-factory-icbs.test.ts"

echo "Updating governance function calls in $FILE..."

# Step 1: Rename updatePoolAuthority -> updateProtocolAuthority
sed -i.bak 's/\.updatePoolAuthority(/\.updateProtocolAuthority(/g' "$FILE"

# Step 2: Find all .updateDefaults and .updateProtocolAuthority calls and add programData account
# This needs to be done more carefully - adding program and programData accounts to governance calls

# Create a temp file for manual fixes needed
echo "⚠️  Manual fixes still needed for governance function accounts:" > /tmp/governance-fixes-needed.txt
echo "" >> /tmp/governance-fixes-needed.txt

grep -n "\.updateDefaults\|\.updateProtocolAuthority\|\.updateFeeConfig" "$FILE" | while read line; do
  echo "$line" >> /tmp/governance-fixes-needed.txt
done

echo "" >> /tmp/governance-fixes-needed.txt
echo "Pattern to add to ALL governance calls:" >> /tmp/governance-fixes-needed.txt
echo "" >> /tmp/governance-fixes-needed.txt
cat >> /tmp/governance-fixes-needed.txt << 'EOF'
// Add BEFORE governance function call:
const [programDataAddress] = PublicKey.findProgramAddressSync(
  [program.programId.toBuffer()],
  new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111")
);

// Then in .accounts():
.accounts({
  factory: factoryPda,
  upgradeAuthority: upgradeAuthority.publicKey,
  program: program.programId,
  programData: programDataAddress,
  // ... other accounts
})
.signers([upgradeAuthority])  // Must sign with upgrade authority
EOF

# Clean up backup
rm -f tests/*.bak

echo "✅ updatePoolAuthority renamed to updateProtocolAuthority"
echo "⚠️  Check /tmp/governance-fixes-needed.txt for manual account additions"

cat /tmp/governance-fixes-needed.txt
