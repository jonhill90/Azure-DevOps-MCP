#!/usr/bin/env node

/**
 * HTTP/SSE Wrapper for Azure DevOps MCP Server
 * Converts the stdio-based MCP server to HTTP/SSE for Docker deployment
 */

import { spawn } from 'child_process';
import http from 'http';
import { EventEmitter } from 'events';

const PORT = process.env.PORT || 8000;
const ADO_ORGANIZATION = process.env.ADO_ORGANIZATION;
const ADO_AUTH_TYPE = process.env.ADO_AUTH_TYPE || 'env';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Validation
if (!ADO_ORGANIZATION) {
  console.error('ERROR: ADO_ORGANIZATION environment variable is required');
  process.exit(1);
}

class MCPHttpBridge extends EventEmitter {
  constructor() {
    super();
    this.mcpProcess = null;
    this.isReady = false;
  }

  start() {
    const args = [
      ADO_ORGANIZATION,
      '-a', ADO_AUTH_TYPE
    ];

    console.log(`Starting Azure DevOps MCP Server for organization: ${ADO_ORGANIZATION}`);
    console.log(`Auth type: ${ADO_AUTH_TYPE}`);

    this.mcpProcess = spawn('node', [
      '/app/azure-devops-mcp/dist/index.js',
      ...args
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'production'
      }
    });

    this.mcpProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (LOG_LEVEL === 'debug') {
        console.log('[MCP STDOUT]:', output);
      }
      this.emit('output', output);
      this.isReady = true;
    });

    this.mcpProcess.stderr.on('data', (data) => {
      const error = data.toString();
      // Log stderr but don't emit as error event to avoid crashes
      console.error('[MCP STDERR]:', error);
    });

    this.mcpProcess.on('close', (code) => {
      console.log(`MCP process exited with code ${code}`);
      this.isReady = false;
      // Restart on crash
      if (code !== 0) {
        console.log('Restarting MCP process in 5 seconds...');
        setTimeout(() => this.start(), 5000);
      }
    });

    this.mcpProcess.on('error', (error) => {
      console.error('Failed to start MCP process:', error);
      this.isReady = false;
    });
  }

  send(message) {
    if (this.mcpProcess && this.mcpProcess.stdin.writable) {
      this.mcpProcess.stdin.write(JSON.stringify(message) + '\n');
    }
  }

  stop() {
    if (this.mcpProcess) {
      this.mcpProcess.kill();
      this.mcpProcess = null;
      this.isReady = false;
    }
  }
}

// Create MCP bridge
const bridge = new MCPHttpBridge();
bridge.start();

// Create HTTP server
const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: bridge.isReady ? 'healthy' : 'starting',
      organization: ADO_ORGANIZATION,
      authType: ADO_AUTH_TYPE
    }));
    return;
  }

  // SSE endpoint for MCP communication
  if (req.url === '/sse' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    // Send keepalive
    const keepAlive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 30000);

    // Forward MCP output to SSE
    const outputHandler = (data) => {
      res.write(`data: ${JSON.stringify({ type: 'output', data })}\n\n`);
    };

    const errorHandler = (data) => {
      res.write(`data: ${JSON.stringify({ type: 'error', data })}\n\n`);
    };

    bridge.on('output', outputHandler);
    bridge.on('error', errorHandler);

    req.on('close', () => {
      clearInterval(keepAlive);
      bridge.off('output', outputHandler);
      bridge.off('error', errorHandler);
    });

    return;
  }

  // POST endpoint for sending messages to MCP
  if (req.url === '/message' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const message = JSON.parse(body);
        bridge.send(message);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'sent' }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });

    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Azure DevOps MCP HTTP/SSE wrapper listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
  console.log(`Message endpoint: http://localhost:${PORT}/message`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  bridge.stop();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  bridge.stop();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
