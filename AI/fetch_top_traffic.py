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

def get_top_traffic():
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
            "top_ips": {
                "terms": { "field": "remote_ip.keyword", "size": 10 }
            },
            "top_requests": {
                "terms": { "field": "request.keyword", "size": 10 }
            },
            "status_distribution": {
                "terms": { "field": "status.keyword", "size": 10 }
            }
        }
    }

    try:
        # Check for indices first
        indices = client.cat.indices(format="json")
        nginx_indices = [i['index'] for i in indices if 'nginx' in i['index'].lower()]
        
        if not nginx_indices:
            return {"error": "No nginx indices found"}

        res = client.search(index="nginx*", body=query)
        
        report = {
            "total_logs": res['hits']['total']['value'],
            "top_ips": res['aggregations']['top_ips']['buckets'],
            "top_requests": res['aggregations']['top_requests']['buckets'],
            "status_distribution": res['aggregations']['status_distribution']['buckets']
        }
        return report
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    result = get_top_traffic()
    print(json.dumps(result))
