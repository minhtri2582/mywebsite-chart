# OpenSearch MCP Server

This is an MCP (Model Context Protocol) server for interacting with OpenSearch.

## Configuration

The server uses credentials from a `.env` file:

```env
OPENSEARCH_URL=https://localhost:9200
OPENSEARCH_USERNAME=admin
OPENSEARCH_PASSWORD=O0cpR65ml6eDQAah
OPENSEARCH_VERIFY_SSL=false
```

## Installation

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Run the server:
   ```bash
   python server.py
   ```

## Tools Provided

- `list_indices`: List all indices.
- `get_mapping`: Get mapping for an index.
- `search`: Execute a search query.
- `get_document`: Get a document by ID.
- `cluster_health`: Check cluster health.
