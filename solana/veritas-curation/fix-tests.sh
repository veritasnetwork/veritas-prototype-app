#!/bin/bash

# Fix ContentPool tests to match current smart contract implementation

cd /Users/josh/veritas/veritas-prototype-app/solana/veritas-curation/tests

echo "Fixing content-pool-icbs.test.ts..."

# 1. Remove protocolAuthority from createPool calls (it's not in the instruction)
sed -i '' '/protocolAuthority: poolAuthority.publicKey,/d' content-pool-icbs.test.ts

# 2. Remove poolAuthority signers from createPool calls (only creator and payer needed)
sed -i '' 's/\.signers(\[testUser1, poolAuthority\])/\.signers([testUser1])/g' content-pool-icbs.test.ts
sed -i '' 's/\.signers(\[testUser2, poolAuthority\])/\.signers([testUser2])/g' content-pool-icbs.test.ts
sed -i '' 's/\.signers(\[payer\.publicKey, poolAuthority\])/\.signers([payer])/g' content-pool-icbs.test.ts
sed -i '' 's/\.signers(\[payer, poolAuthority\])/\.signers([payer])/g' content-pool-icbs.test.ts

# 3. Fix createPool calls that incorrectly pass F and beta parameters
# The create_pool instruction only takes content_id
sed -i '' 's/createPool(contentId.*DEFAULT_BETA_DEN)/createPool(contentId)/g' content-pool-icbs.test.ts

# 4. Remove contentIdAccount from createPool (it's not in the accounts struct)
sed -i '' '/contentIdAccount:/d' content-pool-icbs.test.ts

# 5. Fix RENT sysvar - should be SYSVAR_RENT_PUBKEY not rent:
sed -i '' 's/rent: SYSVAR_RENT_PUBKEY/rent: anchor.web3.SYSVAR_RENT_PUBKEY/g' content-pool-icbs.test.ts

echo "Done! Fixed content-pool-icbs.test.ts"
echo "Note: Trade operations correctly keep poolAuthority as protocol_authority signer"
