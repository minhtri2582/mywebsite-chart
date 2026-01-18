import os
import json
from opensearchpy import OpenSearch
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Config
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

def run_query():
    index = "nginx*"
    query = {
        "size": 0,
        "aggs": {
            "status_errors": {
                "terms": {
                    "field": "status.keyword"
                }
            }
        }
    }
    
    try:
        # Check if any nginx indices exist first
        indices = client.cat.indices(format="json")
        nginx_indices = [i['index'] for i in indices if 'nginx' in i['index'].lower()]
        
        if not nginx_indices:
            print("Lỗi: Không tìm thấy index nào khớp với 'nginx*'.")
            print("Các index hiện có:")
            for i in indices:
                print(f"- {i['index']}")
            return

        response = client.search(index=index, body=query)
        print(json.dumps(response, indent=2))
    except Exception as e:
        print(f"Lỗi truy vấn: {str(e)}")

if __name__ == "__main__":
    run_query()
