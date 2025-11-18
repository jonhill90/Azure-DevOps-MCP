# Azure DevOps MCP Server - Node.js Alpine wrapper
# Pattern: Similar to BasicMemory - clone official repo and add HTTP/SSE transport

FROM node:20-alpine

WORKDIR /app

# ==============================================================================
# PACKAGE LIST - Core packages needed
# ==============================================================================
ARG CORE_PACKAGES="\
    bash \
    git \
    curl \
    "

# ==============================================================================
# INSTALL PACKAGES
# ==============================================================================
RUN apk add --no-cache ${CORE_PACKAGES}

# Clone the official azure-devops-mcp repository
RUN git clone https://github.com/microsoft/azure-devops-mcp.git /app/azure-devops-mcp

WORKDIR /app/azure-devops-mcp

# Install dependencies and build
RUN npm install && npm run build

# Copy wrapper scripts
WORKDIR /app
COPY src/ src/
COPY package.json package.json
COPY start.sh start.sh
RUN chmod +x start.sh

# Install wrapper dependencies (MCP HTTP/SSE transport)
RUN npm install

# Build wrapper
RUN npm run build 2>/dev/null || echo "No build needed for wrapper"

# CRITICAL: Unbuffered output for streaming
ENV NODE_ENV=production

EXPOSE 8000

CMD ["/app/start.sh"]
