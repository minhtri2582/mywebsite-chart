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
    output_path = "/tmp/nginx_30d_analysis_final.json"
    report = {"status": "started"}
    try:
        health = client.cluster.health()
        indices = client.cat.indices(format="json")
        nginx_indices = [i['index'] for i in indices if 'nginx' in i['index'].lower()]
        
        if nginx_indices:
            target_index = nginx_indices[0]
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
                    "status_counts": { "terms": { "field": "status.keyword", "size": 10 } }
                }
            }
            
            res = client.search(index=target_index, body=query)
            report["total_logs"] = res['hits']['total']['value']
            report["status_distribution"] = res['aggregations']['status_counts']['buckets']
            report["status"] = "success"
        else:
            report["status"] = "no_indices"
    except Exception as e:
        report["status"] = "error"
        report["error"] = str(e)
    
    with open(output_path, "w") as f:
        json.dump(report, f, indent=2)

if __name__ == "__main__":
    run_analysis()
