#!/bin/bash

# Azure DevOps MCP Server Startup Script
# Handles authentication setup and starts the HTTP/SSE wrapper

set -e

echo "Starting Azure DevOps MCP Server wrapper..."

# Validate required environment variables
if [ -z "$ADO_ORGANIZATION" ]; then
    echo "ERROR: ADO_ORGANIZATION environment variable is required"
    echo "Please set it in your .env file or docker-compose.yml"
    exit 1
fi

# Handle authentication based on ADO_AUTH_TYPE
AUTH_TYPE="${ADO_AUTH_TYPE:-env}"

case "$AUTH_TYPE" in
    env|envvar)
        if [ -z "$ADO_PAT" ]; then
            echo "ERROR: ADO_PAT environment variable is required when using 'env/envvar' auth type"
            echo "Please set your Personal Access Token in the .env file"
            exit 1
        fi
        # Set environment variable for azure-devops-node-api
        export AZURE_DEVOPS_EXT_PAT="$ADO_PAT"
        echo "Using PAT authentication ($AUTH_TYPE) for organization: $ADO_ORGANIZATION"
        ;;

    azcli)
        echo "Using Azure CLI authentication for organization: $ADO_ORGANIZATION"
        echo "WARNING: Azure CLI auth may require interactive login - consider using env/envvar for Docker"
        ;;

    interactive)
        echo "ERROR: Interactive authentication is not supported in Docker containers"
        echo "Please use 'env', 'envvar', or 'azcli' authentication type"
        exit 1
        ;;

    *)
        echo "ERROR: Unknown authentication type: $AUTH_TYPE"
        echo "Supported types: env, envvar, azcli"
        exit 1
        ;;
esac

# Start the HTTP/SSE wrapper
echo "Starting HTTP/SSE wrapper on port ${PORT:-8000}..."
exec node /app/src/http-wrapper.js
