import os
import json
from opensearchpy import OpenSearch
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Hardcoded for test
OPENSEARCH_URL = "https://localhost:9200"
OPENSEARCH_USERNAME = "admin"
OPENSEARCH_PASSWORD = "O0cpR65ml6eDQAah"

client = OpenSearch(
    hosts=[OPENSEARCH_URL],
    http_auth=(OPENSEARCH_USERNAME, OPENSEARCH_PASSWORD),
    use_ssl=True,
    verify_certs=False,
    ssl_show_warn=False
)

try:
    indices = client.cat.indices(format="json")
    with open("/Users/tridlm/DevOps/my_indices.json", "w") as f:
        json.dump(indices, f, indent=2)
    print("Success")
except Exception as e:
    with open("/Users/tridlm/DevOps/my_indices.json", "w") as f:
        f.write(f"Error: {str(e)}")
    print(f"Error: {str(e)}")
