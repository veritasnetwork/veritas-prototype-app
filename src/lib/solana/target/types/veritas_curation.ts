/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/veritas_curation.json`.
 */
export type VeritasCuration = {
  "address": "5hX4MjCF7EwCfjVSsa5zMjbNCQRtfo98YWhph7tCMw7F",
  "metadata": {
    "name": "veritasCuration",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "addLiquidity",
      "docs": [
        "Add bilateral liquidity to both sides of the market"
      ],
      "discriminator": [
        181,
        157,
        89,
        67,
        143,
        182,
        52,
        72
      ],
      "accounts": [
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  116,
                  101,
                  110,
                  116,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "pool.content_id",
                "account": "contentPool"
              }
            ]
          }
        },
        {
          "name": "longTokenMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  111,
                  110,
                  103,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "pool.content_id",
                "account": "contentPool"
              }
            ]
          }
        },
        {
          "name": "shortTokenMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  104,
                  111,
                  114,
                  116,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "pool.content_id",
                "account": "contentPool"
              }
            ]
          }
        },
        {
          "name": "poolReserve",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "pool.content_id",
                "account": "contentPool"
              }
            ]
          }
        },
        {
          "name": "userUsdcAccount",
          "writable": true
        },
        {
          "name": "userLongAccount",
          "writable": true
        },
        {
          "name": "userShortAccount",
          "writable": true
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "usdcAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "closePool",
      "docs": [
        "Close an empty pool"
      ],
      "discriminator": [
        140,
        189,
        209,
        23,
        239,
        62,
        239,
        11
      ],
      "accounts": [
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  116,
                  101,
                  110,
                  116,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "pool.content_id",
                "account": "contentPool"
              }
            ]
          }
        },
        {
          "name": "factory"
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "creatorUsdc",
          "writable": true
        },
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "protocolAuthority",
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "createPool",
      "discriminator": [
        233,
        146,
        209,
        142,
        207,
        104,
        64,
        188
      ],
      "accounts": [
        {
          "name": "factory",
          "writable": true
        },
        {
          "name": "pool",
          "docs": [
            "The pool to be created"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  116,
                  101,
                  110,
                  116,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "arg",
                "path": "contentId"
              }
            ]
          }
        },
        {
          "name": "registry",
          "docs": [
            "Registry entry for this pool (prevents duplicates)"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              },
              {
                "kind": "arg",
                "path": "contentId"
              }
            ]
          }
        },
        {
          "name": "custodian",
          "docs": [
            "VeritasCustodian (for stake vault reference)"
          ]
        },
        {
          "name": "creator",
          "docs": [
            "Pool creator"
          ],
          "signer": true
        },
        {
          "name": "payer",
          "docs": [
            "Payer for account creation"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "docs": [
            "System program for account creation"
          ],
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "contentId",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "deployMarket",
      "docs": [
        "Deploy market with initial liquidity (first trader)"
      ],
      "discriminator": [
        220,
        236,
        177,
        120,
        89,
        124,
        206,
        46
      ],
      "accounts": [
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  116,
                  101,
                  110,
                  116,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "pool.content_id",
                "account": "contentPool"
              }
            ]
          }
        },
        {
          "name": "longMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  111,
                  110,
                  103,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "pool.content_id",
                "account": "contentPool"
              }
            ]
          }
        },
        {
          "name": "shortMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  104,
                  111,
                  114,
                  116,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "pool.content_id",
                "account": "contentPool"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "pool.content_id",
                "account": "contentPool"
              }
            ]
          }
        },
        {
          "name": "deployerUsdc",
          "writable": true
        },
        {
          "name": "deployerLong",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "deployer"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "longMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "deployerShort",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "deployer"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "shortMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "deployer",
          "signer": true
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "initialDeposit",
          "type": "u64"
        },
        {
          "name": "longAllocation",
          "type": "u64"
        }
      ]
    },
    {
      "name": "deposit",
      "discriminator": [
        242,
        35,
        198,
        137,
        82,
        225,
        242,
        182
      ],
      "accounts": [
        {
          "name": "custodian",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  117,
                  115,
                  116,
                  111,
                  100,
                  105,
                  97,
                  110
                ]
              }
            ]
          }
        },
        {
          "name": "custodianUsdcVault",
          "writable": true
        },
        {
          "name": "depositorUsdcAccount",
          "writable": true
        },
        {
          "name": "depositor",
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initializeCustodian",
      "discriminator": [
        40,
        174,
        58,
        101,
        105,
        77,
        237,
        239
      ],
      "accounts": [
        {
          "name": "custodian",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  117,
                  115,
                  116,
                  111,
                  100,
                  105,
                  97,
                  110
                ]
              }
            ]
          }
        },
        {
          "name": "usdcVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  117,
                  115,
                  116,
                  111,
                  100,
                  105,
                  97,
                  110,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "owner",
          "type": "pubkey"
        },
        {
          "name": "protocolAuthority",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "initializeFactory",
      "discriminator": [
        179,
        64,
        75,
        250,
        39,
        254,
        240,
        178
      ],
      "accounts": [
        {
          "name": "factory",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  97,
                  99,
                  116,
                  111,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "factoryAuthority",
          "type": "pubkey"
        },
        {
          "name": "poolAuthority",
          "type": "pubkey"
        },
        {
          "name": "custodian",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "settleEpoch",
      "docs": [
        "Settle epoch with BD score"
      ],
      "discriminator": [
        148,
        223,
        178,
        38,
        201,
        158,
        167,
        13
      ],
      "accounts": [
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  116,
                  101,
                  110,
                  116,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "pool.content_id",
                "account": "contentPool"
              }
            ]
          }
        },
        {
          "name": "factory"
        },
        {
          "name": "protocolAuthority",
          "signer": true
        },
        {
          "name": "settler",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "bdScore",
          "type": "u32"
        }
      ]
    },
    {
      "name": "toggleEmergencyPause",
      "discriminator": [
        159,
        225,
        114,
        189,
        152,
        176,
        147,
        141
      ],
      "accounts": [
        {
          "name": "custodian",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  117,
                  115,
                  116,
                  111,
                  100,
                  105,
                  97,
                  110
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "paused",
          "type": "bool"
        }
      ]
    },
    {
      "name": "trade",
      "docs": [
        "Trade on the ICBS market (buy or sell LONG/SHORT tokens)"
      ],
      "discriminator": [
        178,
        144,
        26,
        216,
        241,
        187,
        206,
        130
      ],
      "accounts": [
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  116,
                  101,
                  110,
                  116,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "pool.content_id",
                "account": "contentPool"
              }
            ]
          }
        },
        {
          "name": "factory",
          "writable": true
        },
        {
          "name": "traderUsdc",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "stakeVault",
          "writable": true
        },
        {
          "name": "traderTokens",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "trader"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenMint",
          "writable": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "trader",
          "signer": true
        },
        {
          "name": "protocolAuthority",
          "signer": true
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "side",
          "type": {
            "defined": {
              "name": "tokenSide"
            }
          }
        },
        {
          "name": "tradeType",
          "type": {
            "defined": {
              "name": "tradeType"
            }
          }
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "stakeSkim",
          "type": "u64"
        },
        {
          "name": "minTokensOut",
          "type": "u64"
        },
        {
          "name": "minUsdcOut",
          "type": "u64"
        }
      ]
    },
    {
      "name": "updateDefaults",
      "discriminator": [
        117,
        104,
        211,
        196,
        159,
        196,
        168,
        117
      ],
      "accounts": [
        {
          "name": "factory",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  97,
                  99,
                  116,
                  111,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "defaultF",
          "type": {
            "option": "u16"
          }
        },
        {
          "name": "defaultBetaNum",
          "type": {
            "option": "u16"
          }
        },
        {
          "name": "defaultBetaDen",
          "type": {
            "option": "u16"
          }
        },
        {
          "name": "minInitialDeposit",
          "type": {
            "option": "u64"
          }
        },
        {
          "name": "minSettleInterval",
          "type": {
            "option": "i64"
          }
        }
      ]
    },
    {
      "name": "updateFactoryAuthority",
      "discriminator": [
        149,
        240,
        149,
        218,
        216,
        125,
        187,
        110
      ],
      "accounts": [
        {
          "name": "factory",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  97,
                  99,
                  116,
                  111,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "newAuthority",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "updateOwner",
      "discriminator": [
        164,
        188,
        124,
        254,
        132,
        26,
        198,
        178
      ],
      "accounts": [
        {
          "name": "custodian",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  117,
                  115,
                  116,
                  111,
                  100,
                  105,
                  97,
                  110
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "newOwner",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "updatePoolAuthority",
      "discriminator": [
        160,
        162,
        113,
        9,
        99,
        187,
        23,
        239
      ],
      "accounts": [
        {
          "name": "factory",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  97,
                  99,
                  116,
                  111,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "newAuthority",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "updateProtocolAuthority",
      "discriminator": [
        207,
        19,
        17,
        100,
        133,
        169,
        89,
        253
      ],
      "accounts": [
        {
          "name": "custodian",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  117,
                  115,
                  116,
                  111,
                  100,
                  105,
                  97,
                  110
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "newProtocolAuthority",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "withdraw",
      "discriminator": [
        183,
        18,
        70,
        156,
        148,
        109,
        161,
        34
      ],
      "accounts": [
        {
          "name": "custodian",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  117,
                  115,
                  116,
                  111,
                  100,
                  105,
                  97,
                  110
                ]
              }
            ]
          }
        },
        {
          "name": "custodianUsdcVault",
          "writable": true
        },
        {
          "name": "recipientUsdcAccount",
          "writable": true
        },
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "recipient",
          "type": "pubkey"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "contentPool",
      "discriminator": [
        0,
        165,
        204,
        192,
        114,
        127,
        212,
        149
      ]
    },
    {
      "name": "poolFactory",
      "discriminator": [
        56,
        190,
        120,
        141,
        185,
        136,
        141,
        169
      ]
    },
    {
      "name": "poolRegistry",
      "discriminator": [
        113,
        149,
        124,
        60,
        130,
        240,
        64,
        157
      ]
    },
    {
      "name": "veritasCustodian",
      "discriminator": [
        112,
        199,
        203,
        122,
        165,
        124,
        34,
        248
      ]
    }
  ],
  "events": [
    {
      "name": "defaultsUpdatedEvent",
      "discriminator": [
        182,
        95,
        200,
        120,
        138,
        251,
        114,
        254
      ]
    },
    {
      "name": "depositEvent",
      "discriminator": [
        120,
        248,
        61,
        83,
        31,
        142,
        107,
        144
      ]
    },
    {
      "name": "factoryAuthorityUpdatedEvent",
      "discriminator": [
        128,
        144,
        61,
        121,
        30,
        178,
        211,
        177
      ]
    },
    {
      "name": "factoryInitializedEvent",
      "discriminator": [
        242,
        223,
        218,
        189,
        15,
        226,
        221,
        64
      ]
    },
    {
      "name": "liquidityAdded",
      "discriminator": [
        154,
        26,
        221,
        108,
        238,
        64,
        217,
        161
      ]
    },
    {
      "name": "marketDeployedEvent",
      "discriminator": [
        86,
        26,
        216,
        214,
        251,
        115,
        66,
        175
      ]
    },
    {
      "name": "poolAuthorityUpdatedEvent",
      "discriminator": [
        213,
        47,
        117,
        236,
        89,
        192,
        242,
        67
      ]
    },
    {
      "name": "poolClosedEvent",
      "discriminator": [
        76,
        55,
        28,
        161,
        130,
        142,
        226,
        133
      ]
    },
    {
      "name": "poolCreatedEvent",
      "discriminator": [
        25,
        94,
        75,
        47,
        112,
        99,
        53,
        63
      ]
    },
    {
      "name": "poolInitializedEvent",
      "discriminator": [
        249,
        103,
        129,
        77,
        214,
        169,
        88,
        24
      ]
    },
    {
      "name": "settlementEvent",
      "discriminator": [
        48,
        132,
        218,
        111,
        54,
        173,
        61,
        129
      ]
    },
    {
      "name": "tradeEvent",
      "discriminator": [
        189,
        219,
        127,
        211,
        78,
        230,
        97,
        238
      ]
    },
    {
      "name": "withdrawEvent",
      "discriminator": [
        22,
        9,
        133,
        26,
        160,
        44,
        71,
        192
      ]
    }
  ],
  "errors": [
    {
      "code": 13000,
      "name": "alreadyInitialized",
      "msg": "Factory already initialized"
    },
    {
      "code": 13001,
      "name": "invalidAuthority",
      "msg": "Invalid authority address"
    },
    {
      "code": 13010,
      "name": "poolAlreadyExists",
      "msg": "Pool already exists for content_id"
    },
    {
      "code": 13011,
      "name": "invalidContentId",
      "msg": "Invalid content_id"
    },
    {
      "code": 13012,
      "name": "invalidParameters",
      "msg": "Invalid ICBS parameters"
    },
    {
      "code": 13020,
      "name": "unauthorized",
      "msg": "Unauthorized (not factory authority)"
    },
    {
      "code": 13021,
      "name": "unauthorizedProtocol",
      "msg": "Unauthorized protocol authority"
    },
    {
      "code": 13030,
      "name": "invalidF",
      "msg": "Invalid growth exponent F"
    },
    {
      "code": 13031,
      "name": "invalidBeta",
      "msg": "Invalid coupling coefficient β"
    },
    {
      "code": 13032,
      "name": "invalidMinDeposit",
      "msg": "Invalid minimum deposit"
    },
    {
      "code": 13033,
      "name": "invalidSettleInterval",
      "msg": "Invalid settle interval"
    }
  ],
  "types": [
    {
      "name": "contentPool",
      "docs": [
        "Primary account structure for ContentPool",
        "Total size: 408 bytes + 8 discriminator = 416 bytes"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "contentId",
            "docs": [
              "Post/belief identifier (32 bytes)"
            ],
            "type": "pubkey"
          },
          {
            "name": "creator",
            "docs": [
              "Pool creator (32 bytes)"
            ],
            "type": "pubkey"
          },
          {
            "name": "marketDeployer",
            "docs": [
              "First trader who deployed market (32 bytes)"
            ],
            "type": "pubkey"
          },
          {
            "name": "longMint",
            "docs": [
              "SPL token mint for LONG side (32 bytes)"
            ],
            "type": "pubkey"
          },
          {
            "name": "shortMint",
            "docs": [
              "SPL token mint for SHORT side (32 bytes)"
            ],
            "type": "pubkey"
          },
          {
            "name": "vault",
            "docs": [
              "USDC vault for this pool (32 bytes)"
            ],
            "type": "pubkey"
          },
          {
            "name": "stakeVault",
            "docs": [
              "Global stake vault (VeritasCustodian) (32 bytes)"
            ],
            "type": "pubkey"
          },
          {
            "name": "f",
            "docs": [
              "Growth exponent (default: 3)"
            ],
            "type": "u16"
          },
          {
            "name": "betaNum",
            "docs": [
              "β numerator (default: 1)"
            ],
            "type": "u16"
          },
          {
            "name": "betaDen",
            "docs": [
              "β denominator (default: 2, so β = 0.5)"
            ],
            "type": "u16"
          },
          {
            "name": "padding1",
            "docs": [
              "Alignment padding"
            ],
            "type": {
              "array": [
                "u8",
                10
              ]
            }
          },
          {
            "name": "sLong",
            "docs": [
              "LONG token supply (integer, 6 decimals)"
            ],
            "type": "u64"
          },
          {
            "name": "sShort",
            "docs": [
              "SHORT token supply (integer, 6 decimals)"
            ],
            "type": "u64"
          },
          {
            "name": "rLong",
            "docs": [
              "LONG virtual reserve (R_L = s_L × p_L)"
            ],
            "type": "u64"
          },
          {
            "name": "rShort",
            "docs": [
              "SHORT virtual reserve (R_S = s_S × p_S)"
            ],
            "type": "u64"
          },
          {
            "name": "sqrtPriceLongX96",
            "docs": [
              "sqrt(price_long) * 2^96"
            ],
            "type": "u128"
          },
          {
            "name": "sqrtPriceShortX96",
            "docs": [
              "sqrt(price_short) * 2^96"
            ],
            "type": "u128"
          },
          {
            "name": "sqrtLambdaLongX96",
            "docs": [
              "sqrt(λ_L) * 2^96"
            ],
            "type": "u128"
          },
          {
            "name": "sqrtLambdaShortX96",
            "docs": [
              "sqrt(λ_S) * 2^96"
            ],
            "type": "u128"
          },
          {
            "name": "lastSettleTs",
            "docs": [
              "Last settlement timestamp (8 bytes)"
            ],
            "type": "i64"
          },
          {
            "name": "minSettleInterval",
            "docs": [
              "Cooldown between settlements (default: 300s)"
            ],
            "type": "i64"
          },
          {
            "name": "vaultBalance",
            "docs": [
              "Actual USDC in vault (for invariant checking)"
            ],
            "type": "u64"
          },
          {
            "name": "initialQ",
            "docs": [
              "Initial q set by deployer (Q32.32)"
            ],
            "type": "u64"
          },
          {
            "name": "factory",
            "docs": [
              "PoolFactory that created this pool"
            ],
            "type": "pubkey"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump seed"
            ],
            "type": "u8"
          },
          {
            "name": "padding2",
            "docs": [
              "Alignment"
            ],
            "type": {
              "array": [
                "u8",
                7
              ]
            }
          }
        ]
      }
    },
    {
      "name": "defaultsUpdatedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "factory",
            "type": "pubkey"
          },
          {
            "name": "defaultF",
            "type": "u16"
          },
          {
            "name": "defaultBetaNum",
            "type": "u16"
          },
          {
            "name": "defaultBetaDen",
            "type": "u16"
          },
          {
            "name": "minInitialDeposit",
            "type": "u64"
          },
          {
            "name": "minSettleInterval",
            "type": "i64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "depositEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "depositor",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "factoryAuthorityUpdatedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "factory",
            "type": "pubkey"
          },
          {
            "name": "oldAuthority",
            "type": "pubkey"
          },
          {
            "name": "newAuthority",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "factoryInitializedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "factory",
            "type": "pubkey"
          },
          {
            "name": "factoryAuthority",
            "type": "pubkey"
          },
          {
            "name": "poolAuthority",
            "type": "pubkey"
          },
          {
            "name": "custodian",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "liquidityAdded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "usdcAmount",
            "type": "u64"
          },
          {
            "name": "longTokensOut",
            "type": "u64"
          },
          {
            "name": "shortTokensOut",
            "type": "u64"
          },
          {
            "name": "newRLong",
            "type": "u64"
          },
          {
            "name": "newRShort",
            "type": "u64"
          },
          {
            "name": "newSLong",
            "type": "u64"
          },
          {
            "name": "newSShort",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "marketDeployedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "deployer",
            "type": "pubkey"
          },
          {
            "name": "initialDeposit",
            "type": "u64"
          },
          {
            "name": "longAllocation",
            "type": "u64"
          },
          {
            "name": "shortAllocation",
            "type": "u64"
          },
          {
            "name": "initialQ",
            "type": "u64"
          },
          {
            "name": "longTokens",
            "type": "u64"
          },
          {
            "name": "shortTokens",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "poolAuthorityUpdatedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "factory",
            "type": "pubkey"
          },
          {
            "name": "oldAuthority",
            "type": "pubkey"
          },
          {
            "name": "newAuthority",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "poolClosedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "remainingUsdc",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "poolCreatedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "contentId",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "f",
            "type": "u16"
          },
          {
            "name": "betaNum",
            "type": "u16"
          },
          {
            "name": "betaDen",
            "type": "u16"
          },
          {
            "name": "registry",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "poolFactory",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "factoryAuthority",
            "type": "pubkey"
          },
          {
            "name": "poolAuthority",
            "type": "pubkey"
          },
          {
            "name": "totalPools",
            "type": "u64"
          },
          {
            "name": "defaultF",
            "type": "u16"
          },
          {
            "name": "defaultBetaNum",
            "type": "u16"
          },
          {
            "name": "defaultBetaDen",
            "type": "u16"
          },
          {
            "name": "minInitialDeposit",
            "type": "u64"
          },
          {
            "name": "minSettleInterval",
            "type": "i64"
          },
          {
            "name": "custodian",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "poolInitializedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "contentId",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "f",
            "type": "u16"
          },
          {
            "name": "betaNum",
            "type": "u16"
          },
          {
            "name": "betaDen",
            "type": "u16"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "poolRegistry",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "contentId",
            "type": "pubkey"
          },
          {
            "name": "poolAddress",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "settlementEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "settler",
            "type": "pubkey"
          },
          {
            "name": "bdScore",
            "type": "u32"
          },
          {
            "name": "marketPredictionQ",
            "type": "u128"
          },
          {
            "name": "fLong",
            "type": "u128"
          },
          {
            "name": "fShort",
            "type": "u128"
          },
          {
            "name": "rLongBefore",
            "type": "u128"
          },
          {
            "name": "rShortBefore",
            "type": "u128"
          },
          {
            "name": "rLongAfter",
            "type": "u128"
          },
          {
            "name": "rShortAfter",
            "type": "u128"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "tokenSide",
      "docs": [
        "Token side for trading"
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "long"
          },
          {
            "name": "short"
          }
        ]
      }
    },
    {
      "name": "tradeEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "trader",
            "type": "pubkey"
          },
          {
            "name": "side",
            "type": {
              "defined": {
                "name": "tokenSide"
              }
            }
          },
          {
            "name": "tradeType",
            "type": {
              "defined": {
                "name": "tradeType"
              }
            }
          },
          {
            "name": "usdcAmount",
            "type": "u64"
          },
          {
            "name": "usdcToTrade",
            "type": "u64"
          },
          {
            "name": "usdcToStake",
            "type": "u64"
          },
          {
            "name": "tokensTraded",
            "type": "u64"
          },
          {
            "name": "sLongBefore",
            "type": "u64"
          },
          {
            "name": "sShortBefore",
            "type": "u64"
          },
          {
            "name": "sqrtPriceLongX96Before",
            "type": "u128"
          },
          {
            "name": "sqrtPriceShortX96Before",
            "type": "u128"
          },
          {
            "name": "sLongAfter",
            "type": "u64"
          },
          {
            "name": "sShortAfter",
            "type": "u64"
          },
          {
            "name": "sqrtPriceLongX96After",
            "type": "u128"
          },
          {
            "name": "sqrtPriceShortX96After",
            "type": "u128"
          },
          {
            "name": "rLongAfter",
            "type": "u64"
          },
          {
            "name": "rShortAfter",
            "type": "u64"
          },
          {
            "name": "vaultBalanceAfter",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "tradeType",
      "docs": [
        "Trade type"
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "buy"
          },
          {
            "name": "sell"
          }
        ]
      }
    },
    {
      "name": "veritasCustodian",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "protocolAuthority",
            "type": "pubkey"
          },
          {
            "name": "usdcVault",
            "type": "pubkey"
          },
          {
            "name": "totalDeposits",
            "type": "u128"
          },
          {
            "name": "totalWithdrawals",
            "type": "u128"
          },
          {
            "name": "emergencyPause",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "withdrawEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "recipient",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    }
  ]
};
