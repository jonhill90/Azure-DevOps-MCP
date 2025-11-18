# Quick Setup Guide

## 1. Create .env file

```bash
cp .env.example .env
```

Edit `.env` with your values:
```bash
ADO_ORGANIZATION=your-org
ADO_PAT=your-pat-token
```

## 2. Ensure vibes-network exists

```bash
docker network create vibes-network
```

## 3. Build and start

```bash
docker-compose up -d
```

## 4. Verify

```bash
# Check health
curl http://localhost:8055/health

# Expected output:
# {"status":"healthy","organization":"your-org","authType":"pat"}

# View logs
docker-compose logs -f
```

## 5. Configure Claude Code

Add to your MCP settings:

```json
{
  "mcpServers": {
    "azure-devops": {
      "url": "http://localhost:8055/sse",
      "transport": "sse"
    }
  }
}
```

## Common Issues

### PAT Authentication Error
- Generate new PAT at: https://dev.azure.com/YOUR_ORG/_usersSettings/tokens
- Required scopes: Code (Read), Work Items (Read & Write), Build (Read)

### Network Error
- Ensure vibes-network exists: `docker network create vibes-network`

### Container Won't Start
- Check logs: `docker-compose logs`
- Rebuild: `docker-compose build --no-cache`
