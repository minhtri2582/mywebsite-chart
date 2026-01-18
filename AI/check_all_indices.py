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
    if not indices:
        print("KHÔNG CÓ INDEX NÀO (EMPTY CLUSTER)")
    else:
        for i in indices:
            print(f"Index: {i['index']} | Docs: {i['docs.count']}")
except Exception as e:
    print(f"LỖI: {str(e)}")
