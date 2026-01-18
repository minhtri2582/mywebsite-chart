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

def run_analysis():
    index_pattern = "nginx-access-prod-*"
    output_path = "/Users/tridlm/DevOps/mywebsite-chart/AI/prod_traffic_report.json"
    
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
            "top_ips": { "terms": { "field": "remote_ip.keyword", "size": 10 } },
            "top_requests": { "terms": { "field": "request.keyword", "size": 10 } },
            "status_codes": { "terms": { "field": "status.keyword", "size": 10 } }
        }
    }

    try:
        res = client.search(index=index_pattern, body=query)
        data = {
            "timestamp": datetime.now().isoformat(),
            "index_pattern": index_pattern,
            "total_logs": res['hits']['total']['value'],
            "top_ips": res['aggregations']['top_ips']['buckets'],
            "top_requests": res['aggregations']['top_requests']['buckets'],
            "status_distribution": res['aggregations']['status_codes']['buckets']
        }
        with open(output_path, "w") as f:
            json.dump(data, f, indent=2)
        return f"Success! Results saved to {output_path}"
    except Exception as e:
        error_data = {"error": str(e), "index_pattern": index_pattern}
        with open(output_path, "w") as f:
            json.dump(error_data, f, indent=2)
        return f"Error: {str(e)}"

if __name__ == "__main__":
    print(run_analysis())
 Broadway
