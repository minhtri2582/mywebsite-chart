import os
import json
import asyncio
from typing import Any, Dict, List, Optional
from dotenv import load_dotenv
from opensearchpy import OpenSearch
from mcp.server.fastmcp import FastMCP

# Load environment variables
load_dotenv()

OPENSEARCH_URL = os.getenv("OPENSEARCH_URL", "https://localhost:9200")
OPENSEARCH_USERNAME = os.getenv("OPENSEARCH_USERNAME", "admin")
OPENSEARCH_PASSWORD = os.getenv("OPENSEARCH_PASSWORD", "admin")
OPENSEARCH_VERIFY_SSL = os.getenv("OPENSEARCH_VERIFY_SSL", "true").lower() == "true"

# Initialize OpenSearch client
client = OpenSearch(
    hosts=[OPENSEARCH_URL],
    http_auth=(OPENSEARCH_USERNAME, OPENSEARCH_PASSWORD),
    use_ssl=True,
    verify_certs=OPENSEARCH_VERIFY_SSL,
    ssl_show_warn=False
)

# Initialize MCP server
mcp = FastMCP("OpenSearch")

@mcp.tool()
async def list_indices() -> str:
    """List all indices in the OpenSearch cluster."""
    try:
        indices = client.cat.indices(format="json")
        return json.dumps(indices, indent=2)
    except Exception as e:
        return f"Error listing indices: {str(e)}"

@mcp.tool()
async def get_mapping(index: str) -> str:
    """Get mapping for a specific index."""
    try:
        mapping = client.indices.get_mapping(index=index)
        return json.dumps(mapping, indent=2)
    except Exception as e:
        return f"Error getting mapping for index {index}: {str(e)}"

@mcp.tool()
async def search(index: str, query: Dict[str, Any], size: int = 10) -> str:
    """Execute a search query on a specific index."""
    try:
        response = client.search(index=index, body=query, size=size)
        return json.dumps(response, indent=2)
    except Exception as e:
        return f"Error executing search on index {index}: {str(e)}"

@mcp.tool()
async def get_document(index: str, doc_id: str) -> str:
    """Get a document by its ID."""
    try:
        response = client.get(index=index, id=doc_id)
        return json.dumps(response, indent=2)
    except Exception as e:
        return f"Error getting document {doc_id} from index {index}: {str(e)}"

@mcp.tool()
async def cluster_health() -> str:
    """Get the health status of the cluster."""
    try:
        health = client.cluster.health()
        return json.dumps(health, indent=2)
    except Exception as e:
        return f"Error getting cluster health: {str(e)}"

if __name__ == "__main__":
    mcp.run()
