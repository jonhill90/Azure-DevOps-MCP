# Quick Setup Guide

## 1. Create .env file

```bash
cp .env.example .env
```

Edit `.env` with your values:
```bash
ADO_ORGANIZATION=your-org-name
ADO_PAT=your-personal-access-token
ADO_AUTH_TYPE=envvar
ADO_MCP_PORT=8055
LOG_LEVEL=info
```

**Important:** Use `ADO_AUTH_TYPE=envvar` for PAT-based authentication.

## 2. Build and start

```bash
docker-compose up -d
```

## 3. Verify

```bash
# Check health
curl http://localhost:8055/health

# Expected output:
# {"status":"healthy","organization":"your-org","authType":"envvar"}

# View logs
docker-compose logs -f
```

## 4. Configure Claude Desktop

### Option 1: HTTP/SSE (Recommended for Production)

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "azure-devops": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://localhost:8055/mcp"
      ]
    }
  }
}
```

### Option 2: stdio (Local Development)

```json
{
  "mcpServers": {
    "azure-devops": {
      "command": "docker",
      "args": ["exec", "-i", "azure-devops-mcp", "node", "/app/azure-devops-mcp/dist/index.js", "YOUR_ORG_NAME", "-a", "envvar"]
    }
  }
}
```

Replace `YOUR_ORG_NAME` with your Azure DevOps organization name.

## 5. Restart Claude Desktop

Quit and reopen Claude Desktop completely for changes to take effect.

## Testing

Test the HTTP/SSE endpoint:

```bash
curl -N -X POST http://localhost:8055/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```

Expected response:
```
: SSE connection established

event: message
data: {"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{"listChanged":true}},"serverInfo":{"name":"Azure DevOps MCP Server","version":"2.2.2"}},"jsonrpc":"2.0","id":1}
```

## Common Issues

### Authentication Errors

**Error:** `ChainedTokenCredential authentication failed`

**Solution:** Ensure you're using `ADO_AUTH_TYPE=envvar` in your `.env` file, not `env`.

```bash
# Verify auth type
docker exec azure-devops-mcp env | grep ADO_AUTH_TYPE

# Should show: ADO_AUTH_TYPE=envvar
```

If incorrect, update `.env` and restart:
```bash
docker-compose down
docker-compose up -d
```

### PAT Token Issues

**Error:** `Environment variable 'ADO_MCP_AUTH_TOKEN' is not set`

**Solution:**
1. Verify PAT is in `.env`: `cat .env | grep ADO_PAT`
2. Restart container: `docker-compose down && docker-compose up -d`
3. Check container has the PAT: `docker exec azure-devops-mcp env | grep ADO_MCP_AUTH_TOKEN`

### Server Not Responding

**Solution:**
```bash
# Check if container is running
docker ps | grep azure-devops-mcp

# Check logs
docker logs azure-devops-mcp --tail 50

# Restart
docker-compose down
docker-compose up -d
```

### PAT Scopes

Your PAT must include these scopes:
- Code (Read)
- Work Items (Read & Write)
- Build (Read)
- Release (Read)
- Graph (Read)
- Wiki (Read & Write) - if using wiki features

Generate at: https://dev.azure.com/YOUR_ORG/_usersSettings/tokens

### Container Won't Start

```bash
# Check environment variables
docker-compose config

# Rebuild from scratch
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## Production Deployment

For production use with MCP gateways (LiteLLM, Microsoft MCP Gateway):

1. Deploy behind HTTPS reverse proxy
2. Use environment variables for secrets (never commit `.env`)
3. Set appropriate resource limits in docker-compose.yml
4. Configure health checks and monitoring
5. Use `LOG_LEVEL=info` or `warn` in production

Example nginx config:
```nginx
location /azure-devops-mcp/ {
    proxy_pass http://localhost:8055/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_buffering off;
}
```
