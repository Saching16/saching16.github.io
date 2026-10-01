# Digital Twin API

`POST /api/digital-twin` answers a question about Sachin using retrieved context from his resume, LinkedIn export, and research notes. Implemented in `app/api/digital-twin/route.js` on the Node.js runtime.

## Request

```http
POST /api/digital-twin
Content-Type: application/json
```

```json
{
  "message": "What kind of RAG systems has Sachin built?",
  "history": [
    { "role": "user", "content": "Where does Sachin study?" },
    {
      "role": "assistant",
      "content": "He is a Master of Applied Data Science candidate at the University of Michigan."
    },
    { "role": "user", "content": "What kind of RAG systems has Sachin built?" }
  ]
}
```

| Field     | Type   | Notes                                                                                                                                                                  |
| --------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `message` | string | Required. Trimmed, then must be 1 to 1,000 characters.                                                                                                                 |
| `history` | array  | Optional. Entries with a role other than `user` or `assistant`, or non-string content, are ignored. Only the last 8 are used. A trailing copy of `message` is removed. |

## Responses

### 200 OK

```json
{
  "answer": "Sachin built a hybrid RAG pipeline ...",
  "sources": ["Resume", "Research Interests"]
}
```

`sources` lists the unique labels of the chunks that were retrieved as context. It doesn't guarantee that the model used each one.

### Errors

All errors return `{ "error": "<message>" }`.

| Status | When                                                                                                 |
| ------ | ---------------------------------------------------------------------------------------------------- |
| 400    | `message` is missing or empty, or longer than 1,000 characters.                                      |
| 403    | The `Origin` header's host doesn't match the request host.                                           |
| 429    | More than 5 requests from the same IP within 60 seconds. Includes a `Retry-After` header in seconds. |
| 500    | Anything else, including a missing `OPENAI_API_KEY`, an OpenAI failure, or invalid JSON.             |

## Limits and configuration

Defined in `lib/digitalTwinConfig.js`:

| Constant                  | Value |
| ------------------------- | ----- |
| `MAX_MESSAGE_CHARS`       | 1000  |
| `MAX_HISTORY_MESSAGES`    | 8     |
| `RATE_LIMIT_WINDOW_MS`    | 60000 |
| `RATE_LIMIT_MAX_REQUESTS` | 5     |

`MAX_MESSAGE_CHARS` is also used as the textarea `maxLength` in the chat UI.

The rate limiter keys on the first address in `x-forwarded-for`, then `x-real-ip`, then `"unknown"`. Its state is in memory per serverless instance.

Set `DISABLE_RATE_LIMIT=1` to skip the limit while running `npm run eval-twin` against `npm run dev`. The route ignores that variable when `NODE_ENV` is `production`, including `next start` and every Vercel deployment.

## Analytics logging

Each request writes one JSON line to stdout with `console.info`, which appears in Vercel's function logs. Logging is skipped when `NODE_ENV` is `test`.

```json
{
  "event": "digital_twin_chat",
  "outcome": "success",
  "status": 200,
  "latencyMs": 1834,
  "messageLength": 42,
  "historyLength": 3,
  "sources": ["Resume"],
  "clientHash": "3f9a1c0b7e2d4a11",
  "userAgent": "Mozilla/5.0 ...",
  "timestamp": "2026-09-28T21:41:00.000Z"
}
```

| Field        | Notes                                                                                              |
| ------------ | -------------------------------------------------------------------------------------------------- |
| `outcome`    | One of `success`, `validation_error`, `rate_limited`, `blocked_origin`, `error`.                   |
| `clientHash` | First 16 hex characters of SHA-256 of `CHAT_ANALYTICS_SALT:<client IP>`. Raw IPs are never logged. |
| `userAgent`  | Truncated to 160 characters.                                                                       |
| `error`      | Present only on failures, truncated to 160 characters.                                             |

Message content is never logged, only its length.

## Trying it locally

```bash
npm run dev
curl -s localhost:3000/api/digital-twin \
  -H 'Content-Type: application/json' \
  -d '{"message":"What are Sachin'\''s research interests?"}'
```

This requires `OPENAI_API_KEY` in `.env`. The first request on a fresh server is slower because it embeds all sources.
