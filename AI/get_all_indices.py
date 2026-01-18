import json
from opensearchpy import OpenSearch
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

client = OpenSearch(
    hosts=["https://localhost:9200"],
    http_auth=("admin", "O0cpR65ml6eDQAah"),
    use_ssl=True,
    verify_certs=False
)

try:
    indices = client.cat.indices(format="json")
    with open("/Users/tridlm/DevOps/all_indices_found.json", "w") as f:
        json.dump(indices, f, indent=2)
except Exception as e:
    with open("/Users/tridlm/DevOps/all_indices_found.json", "w") as f:
        json.dump({"error": str(e)}, f)
