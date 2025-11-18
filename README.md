# Azure DevOps MCP Server (Docker Wrapper)

Docker wrapper for the official [Microsoft Azure DevOps MCP Server](https://github.com/microsoft/azure-devops-mcp) that provides both HTTP/SSE and stdio transports for use with Claude Desktop, Claude Code, and other MCP clients.

## Overview

This wrapper:
- Clones the official `@azure-devops/mcp` package
- Provides HTTP/SSE transport layer (original uses stdio only)
- Packages everything in Docker for easy deployment
- Supports both direct stdio access and HTTP/SSE endpoints

## Quick Start

### 1. Prerequisites

- Docker and Docker Compose
- Azure DevOps organization
- Personal Access Token (PAT) from Azure DevOps

### 2. Get Your Azure DevOps PAT

1. Go to https://dev.azure.com/YOUR_ORG/_usersSettings/tokens
2. Click "New Token"
3. Required scopes:
   - **Code**: Read
   - **Work Items**: Read & Write
   - **Build**: Read
   - **Release**: Read
   - **Wiki**: Read & Write (if using wiki features)
   - **Graph**: Read (for identity lookups)
4. Copy the token (you won't see it again!)

### 3. Setup

```bash
# Clone this wrapper
cd ~/source/repos/Personal
git clone <this-repo> Azure-DevOps-MCP
cd Azure-DevOps-MCP

# Create .env file from example
cp .env.example .env

# Edit .env and set your values
nano .env
```

### 4. Configure `.env`

```bash
ADO_ORGANIZATION=your-org-name
ADO_PAT=your-personal-access-token
ADO_AUTH_TYPE=envvar
ADO_MCP_PORT=8055
```

**Important:** Use `ADO_AUTH_TYPE=envvar` for PAT-based authentication.

### 5. Start the Server

```bash
# Build and start
docker-compose up -d

# Check logs
docker-compose logs -f

# Check health
curl http://localhost:8055/health
```

## Usage with Claude Desktop (Recommended)

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

**Replace `YOUR_ORG_NAME`** with your Azure DevOps organization name.

After updating the config:
1. Restart Claude Desktop completely (quit and reopen)
2. The Azure DevOps tools will be available in chat
3. Try: "List my Azure DevOps projects" or "Show repos in my organization"

## Usage with Claude Code

### Option 1: Docker stdio (Recommended)

Add to your Claude Code MCP settings:

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

### Option 2: HTTP/SSE Transport

If your MCP client supports HTTP/SSE:

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

## Available Tools

Once connected, you'll have access to 80+ Azure DevOps tools:

### Core
- List projects, teams
- Get identity IDs

### Work Items
- Create, update, query work items
- Add comments, link work items
- Manage backlogs and iterations
- Link work items to PRs and builds

### Repositories
- List repos, branches, pull requests
- Create PRs and branches
- Search commits
- Manage PR comments, reviewers, and threads
- Reply to and resolve PR comments

### Pipelines
- List builds and definitions
- Get build logs and status
- Run pipelines
- Create pipeline definitions

### Wiki
- List wikis and pages
- Create/update wiki pages
- Get page content

### Test Plans
- Create test plans and cases
- Manage test suites
- View test results

### Search
- Search code, wiki, work items

### Advanced Security
- Get security alerts
- View alert details

See the [official documentation](https://github.com/microsoft/azure-devops-mcp) for the complete tool list.

## Architecture

### Dual Transport Support

```
┌─────────────────────────────────────┐
│  Claude Desktop / MCP Client        │
└───────────────┬─────────────────────┘
                │ stdio OR HTTP/SSE
                ▼
┌─────────────────────────────────────┐
│  Docker Container                   │
│                                     │
│  ┌───────────────────────────────┐  │
│  │  http-wrapper.js (port 8055)  │  │  ← HTTP/SSE endpoint
│  └──────────┬────────────────────┘  │
│             │ stdio                 │
│             ▼                        │
│  ┌───────────────────────────────┐  │
│  │  @azure-devops/mcp            │  │  ← Direct stdio access
│  │  (Official MCP Server)        │  │
│  └──────────┬────────────────────┘  │
│             │                        │
└─────────────┼────────────────────────┘
              │ HTTPS + PAT
              ▼
┌─────────────────────────────────────┐
│  Azure DevOps (dev.azure.com)       │
└─────────────────────────────────────┘
```

## Authentication

### Supported Auth Types

| Type | Description | Use Case | Docker Support |
|------|-------------|----------|----------------|
| `envvar` | PAT via `ADO_MCP_AUTH_TOKEN` | **Recommended for Docker** | ✅ Full |
| `env` | Azure AD via environment credentials | Azure-authenticated environments | ⚠️  Complex setup |
| `azcli` | Azure CLI credentials | Local development with Azure CLI | ⚠️  Limited in Docker |
| `interactive` | Browser-based login | Local development only | ❌ Not supported in Docker |

### How Authentication Works

1. Your `.env` file sets `ADO_PAT`
2. Docker Compose passes it to the container as:
   - `ADO_MCP_AUTH_TOKEN` (for `envvar` auth)
   - `AZURE_DEVOPS_EXT_PAT` (for `env` auth)
3. The MCP server uses the appropriate credential for Azure DevOps API calls

## Troubleshooting

### Authentication Errors

**Error:** `ChainedTokenCredential authentication failed`
- **Solution:** Use `ADO_AUTH_TYPE=envvar` instead of `env`
- The `env` type requires Azure AD credentials, while `envvar` uses your PAT directly

**Error:** `Environment variable 'ADO_MCP_AUTH_TOKEN' is not set`
- **Solution:** Restart the container: `docker-compose down && docker-compose up -d`
- Verify PAT is in `.env`: `cat .env | grep ADO_PAT`

**Error:** Authentication errors in Claude Desktop
- **Solution:** Check the container has the PAT: `docker exec azure-devops-mcp env | grep ADO_MCP_AUTH_TOKEN`
- Ensure you're using `-a envvar` in the Claude Desktop config

### Common Issues

#### Check server health
```bash
curl http://localhost:8055/health
```

Expected response:
```json
{
  "status": "starting",
  "organization": "YourOrg",
  "authType": "envvar"
}
```

#### View logs
```bash
docker-compose logs -f azure-devops-mcp
```

#### Test direct MCP connection
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | \
  docker exec -i azure-devops-mcp node /app/azure-devops-mcp/dist/index.js YOUR_ORG -a envvar
```

#### Verify environment variables
```bash
docker exec azure-devops-mcp env | grep -E "ADO_|AZURE_"
```

Should show:
```
ADO_ORGANIZATION=YourOrg
ADO_PAT=your-pat-token
ADO_AUTH_TYPE=envvar
ADO_MCP_AUTH_TOKEN=your-pat-token
AZURE_DEVOPS_EXT_PAT=your-pat-token
```

### Container won't start
```bash
# Check environment variables
docker-compose config

# Rebuild from scratch
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### PAT Scopes Issues

If you get permission errors, verify your PAT includes these scopes:
- Code (Read)
- Work Items (Read & Write)
- Build (Read)
- Release (Read)
- Graph (Read)
- Wiki (Read & Write) - if using wiki features

## Development

### Update to latest azure-devops-mcp

The Dockerfile clones the official repo on build. To update:

```bash
docker-compose build --no-cache
docker-compose up -d
```

### Modify wrapper behavior

Edit `src/http-wrapper.js` and rebuild:

```bash
docker-compose build
docker-compose up -d
```

### Test changes locally

```bash
# Test direct stdio connection
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"core_list_projects","arguments":{}}}' | \
  docker exec -i azure-devops-mcp node /app/azure-devops-mcp/dist/index.js YOUR_ORG -a envvar | jq .

# Test HTTP endpoint
curl -s http://localhost:8055/health | jq .
```

## Example Prompts

Once configured, try these in Claude Desktop:

- "List my Azure DevOps projects"
- "Show me all repositories in the [ProjectName] project"
- "What are my current work items?"
- "Create a bug work item in [ProjectName] titled 'Fix login issue'"
- "Show me recent pull requests in [RepoName]"
- "Get the build status for build #123 in [ProjectName]"
- "Search for 'authentication' in the code"
- "List all wiki pages in [ProjectName]"

## Files Structure

```
.
├── Dockerfile              # Builds container with official MCP server
├── docker-compose.yml      # Container orchestration with env vars
├── start.sh               # Startup script with auth handling
├── package.json           # Wrapper package definition
├── src/
│   └── http-wrapper.js    # HTTP/SSE transport layer
├── .env                   # Your configuration (not in git)
├── .env.example          # Configuration template
└── README.md             # This file
```

## License

This wrapper is MIT licensed. The underlying `@azure-devops/mcp` package is licensed by Microsoft Corporation.

## Credits

- Official MCP Server: [microsoft/azure-devops-mcp](https://github.com/microsoft/azure-devops-mcp)
- Wrapper pattern inspired by [BasicMemory](https://github.com/basicmachines-co/basic-memory)
