#!/bin/bash

# Comprehensive fix for all governance function calls
# Adds programData account and upgradeAuthority signer pattern

FILE="tests/pool-factory-icbs.test.ts"

echo "Fixing all governance calls in $FILE..."

# Read the file
cp "$FILE" "${FILE}.backup"

# Use a Python script for more complex replacements
python3 << 'PYTHON_SCRIPT'
import re

FILE = "tests/pool-factory-icbs.test.ts"

with open(FILE, 'r') as f:
    content = f.read()

# Pattern 1: Add programDataAddress at the start of governance test sections
# Insert after "describe(" for Authority Management and Parameter Updates sections
content = re.sub(
    r'(describe\("5\. Authority Management".*?\(\) => \{)',
    r'\1\n    // Derive program data address for upgrade authority validation\n    const [programDataAddress] = PublicKey.findProgramAddressSync(\n      [program.programId.toBuffer()],\n      new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111")\n    );',
    content,
    flags=re.DOTALL
)

content = re.sub(
    r'(describe\("6\. Parameter Updates".*?\(\) => \{)',
    r'\1\n    // Derive program data address for upgrade authority validation\n    const [programDataAddress] = PublicKey.findProgramAddressSync(\n      [program.programId.toBuffer()],\n      new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111")\n    );',
    content,
    flags=re.DOTALL
)

# Pattern 2: Fix updateProtocolAuthority calls
# Find pattern: .updateProtocolAuthority(...)\n.accounts({\nfactory: factoryPda,\n})
pattern = r'(\.updateProtocolAuthority\([^)]+\))\s*\.accounts\(\{\s*factory:\s*factoryPda,?\s*\}\)'
replacement = r'\1\n        .accounts({\n          factory: factoryPda,\n          upgradeAuthority: upgradeAuthority.publicKey,\n          program: program.programId,\n          programData: programDataAddress,\n        })\n        .signers([upgradeAuthority])'

content = re.sub(pattern, replacement, content, flags=re.MULTILINE)

# Pattern 3: Fix updateDefaults calls
pattern = r'(\.updateDefaults\([^)]+\))\s*\.accounts\(\{\s*factory:\s*factoryPda,?\s*\}\)'
replacement = r'\1\n        .accounts({\n          factory: factoryPda,\n          upgradeAuthority: upgradeAuthority.publicKey,\n          program: program.programId,\n          programData: programDataAddress,\n        })\n        .signers([upgradeAuthority])'

content = re.sub(pattern, replacement, content, flags=re.MULTILINE)

# Pattern 4: Fix updateFeeConfig calls if any
pattern = r'(\.updateFeeConfig\([^)]+\))\s*\.accounts\(\{\s*factory:\s*factoryPda,?\s*\}\)'
replacement = r'\1\n        .accounts({\n          factory: factoryPda,\n          upgradeAuthority: upgradeAuthority.publicKey,\n          program: program.programId,\n          programData: programDataAddress,\n        })\n        .signers([upgradeAuthority])'

content = re.sub(pattern, replacement, content, flags=re.MULTILINE)

with open(FILE, 'w') as f:
    f.write(content)

print("✅ Governance calls updated")

PYTHON_SCRIPT

if [ $? -eq 0 ]; then
    echo "✅ All governance function calls updated"
    echo "Backup saved to: ${FILE}.backup"
else
    echo "❌ Python script failed, restoring backup"
    mv "${FILE}.backup" "$FILE"
    exit 1
fi
