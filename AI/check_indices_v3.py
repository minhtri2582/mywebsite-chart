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
    print(json.dumps(indices))
except Exception as e:
    print(json.dumps({"error": str(e)}))
