// OpenAPI 3.0 스펙을 JSON으로 서빙하는 Edge Function
// LangChain, CrewAI, AutoGen 등 AI 프레임워크에서 자동으로 Tool을 생성할 수 있도록 지원

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'K-Trendz Bot Trading API',
    description:
      'Trade K-pop artist lightstick tokens on the K-Trendz bonding curve market. All transactions are gas-sponsored via Paymaster — no ETH needed. Supports per-agent DAU tracking on-chain.',
    version: '2.0.0',
    contact: {
      name: 'K-Trendz',
      url: 'https://k-trendz.com',
    },
    license: {
      name: 'MIT',
    },
  },
  servers: [
    {
      url: 'https://k-trendz.com/api/bot',
      description: 'Production',
    },
  ],
  security: [
    {
      ApiKeyAuth: [],
    },
  ],
  paths: {
    '/tokens': {
      get: {
        operationId: 'listTokens',
        summary: 'List all available tokens',
        description:
          'Returns all active lightstick tokens with current supply, trending scores, and follower counts.',
        security: [],
        responses: {
          '200': {
            description: 'Token list',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/TokenListResponse',
                },
              },
            },
          },
        },
      },
    },
    '/token-price': {
      post: {
        operationId: 'getTokenPrice',
        summary: 'Get token price and trading signals',
        description:
          'Returns current price, buy cost, sell refund, 24h change, trending score, and external news signals for a token. No authentication required.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/TokenPriceRequest',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Token price and signals',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/TokenPriceResponse',
                },
              },
            },
          },
        },
      },
    },
    '/buy': {
      post: {
        operationId: 'buyToken',
        summary: 'Buy 1 lightstick token',
        description:
          'Purchase 1 lightstick token. Max 1 per transaction (bonding curve protection). $100/day limit per agent. Gas fees are automatically sponsored.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/TradeRequest',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Purchase result',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/BuyResponse',
                },
              },
            },
          },
        },
      },
    },
    '/sell': {
      post: {
        operationId: 'sellToken',
        summary: 'Sell 1 lightstick token',
        description:
          'Sell 1 lightstick token. Gas fees are automatically sponsored.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/TradeRequest',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Sale result',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/SellResponse',
                },
              },
            },
          },
        },
      },
    },
    '/register': {
      post: {
        operationId: 'registerAgent',
        summary: 'Register agent and get API key',
        description:
          'Register a new trading agent and receive an API key instantly. No approval needed. The API key is required for buy/sell operations. If called again with the same name, a new API key is re-issued.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RegisterRequest',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Registration result with API key',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/RegisterResponse',
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-bot-api-key',
        description: 'API key issued via /ktrendz:setup or agent registration',
      },
    },
    schemas: {
      TokenListResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              contract_address: { type: 'string', example: '0xBBf57b07847E355667D4f8583016dD395c5cB1D1' },
              token_count: { type: 'integer', example: 6 },
              tokens: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    token_id: { type: 'string', example: '7963681970480434413' },
                    artist_name: { type: 'string', example: 'RIIZE' },
                    total_supply: { type: 'integer', example: 42 },
                    trending_score: { type: 'integer', example: 1250 },
                    follower_count: { type: 'integer', example: 156 },
                  },
                },
              },
            },
          },
        },
      },
      TokenPriceRequest: {
        type: 'object',
        required: ['artist_name'],
        properties: {
          artist_name: {
            type: 'string',
            description: 'Artist name (e.g., RIIZE, IVE, BTS)',
            example: 'RIIZE',
          },
        },
      },
      TokenPriceResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              token_id: { type: 'string' },
              artist_name: { type: 'string' },
              current_price_usdc: { type: 'number', example: 1.85 },
              buy_cost_usdc: { type: 'number', example: 1.91 },
              sell_refund_usdc: { type: 'number', example: 1.78 },
              price_change_24h: { type: 'string', example: '5.2' },
              total_supply: { type: 'integer' },
              trending_score: { type: 'integer' },
              external_signals: {
                type: 'object',
                properties: {
                  article_count_24h: { type: 'integer' },
                  has_recent_news: { type: 'boolean' },
                  headlines: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
      },
      TradeRequest: {
        type: 'object',
        required: ['artist_name'],
        properties: {
          artist_name: {
            type: 'string',
            description: 'Artist name (e.g., RIIZE, IVE, BTS)',
            example: 'RIIZE',
          },
          max_slippage_percent: {
            type: 'number',
            description: 'Maximum slippage tolerance (default: 5%)',
            default: 5,
            example: 5,
          },
        },
      },
      BuyResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              transaction_id: { type: 'string', format: 'uuid' },
              tx_hash: { type: 'string' },
              token_id: { type: 'string' },
              artist_name: { type: 'string' },
              amount: { type: 'integer', example: 1 },
              total_cost_usdc: { type: 'number', example: 1.91 },
              remaining_daily_limit: { type: 'number', example: 98.09 },
              gas_sponsored: { type: 'boolean', example: true },
            },
          },
        },
      },
      SellResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              transaction_id: { type: 'string', format: 'uuid' },
              tx_hash: { type: 'string' },
              token_id: { type: 'string' },
              artist_name: { type: 'string' },
              amount: { type: 'integer', example: 1 },
              net_refund_usdc: { type: 'number', example: 1.78 },
              fee_usdc: { type: 'number', example: 0.04 },
              gas_sponsored: { type: 'boolean', example: true },
            },
          },
        },
      },
      RegisterRequest: {
        type: 'object',
        required: ['agent_name'],
        properties: {
          agent_name: {
            type: 'string',
            description: 'A unique name for your trading agent (min 2 characters)',
            example: 'my-trading-bot',
          },
        },
      },
      RegisterResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              agent_id: { type: 'string', format: 'uuid' },
              api_key: { type: 'string', description: 'Use this key in x-bot-api-key header for buy/sell' },
              daily_limit_usd: { type: 'number', example: 100 },
              message: { type: 'string' },
            },
          },
        },
      },
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(JSON.stringify(openApiSpec, null, 2), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
});
