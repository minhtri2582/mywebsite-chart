import os
import json
from datetime import datetime, timedelta
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

def run_report():
    index_pattern = "nginx-access-prod-*"
    output_path = "/Users/tridlm/DevOps/mywebsite-chart/AI/nginx_prod_traffic_report.json"
    end_time = datetime.utcnow()
    start_time = end_time - timedelta(days=30)
    
    query = {
        "size": 0,
        "query": {
            "range": {
                "@timestamp": {
                    "gte": start_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "lte": end_time.strftime("%Y-%m-%dT%H:%M:%SZ")
                }
            }
        },
        "aggs": {
            "top_ips": { "terms": { "field": "remote_ip.keyword", "size": 5 } },
            "top_requests": { "terms": { "field": "request.keyword", "size": 5 } },
            "status_codes": { "terms": { "field": "status.keyword", "size": 5 } }
        }
    }

    try:
        res = client.search(index=index_pattern, body=query)
        data = {
            "total": res['hits']['total']['value'],
            "ips": res['aggregations']['top_ips']['buckets'],
            "requests": res['aggregations']['top_requests']['buckets'],
            "status": res['aggregations']['status_codes']['buckets']
        }
        
        # Also list all indices if zero hits
        if data["total"] == 0:
            indices = client.cat.indices(format="json")
            data["all_indices"] = [i['index'] for i in indices]

        with open(output_path, "w") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        with open(output_path, "w") as f:
            json.dump({"error": str(e)}, f)

if __name__ == "__main__":
    run_report()
 Broadway
