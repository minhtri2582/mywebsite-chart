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
    results = []
    results.append("--- OPEN SEARCH ANALYSIS REPORT ---")
    try:
        # Check connection
        health = client.cluster.health()
        results.append(f"Cluster Health: {health['status']}")
        
        # List indices
        indices = client.cat.indices(format="json")
        results.append(f"Total Indices: {len(indices)}")
        
        nginx_indices = [i['index'] for i in indices if 'nginx' in i['index'].lower()]
        if not nginx_indices:
            results.append("Anomaly Detection: No indices found with 'nginx' in the name.")
            results.append("Available indices:")
            for i in indices[:10]:
                results.append(f"- {i['index']}")
        else:
            target_index = nginx_indices[0]
            results.append(f"Analyzing Index: {target_index}")
            
            # Time range: last 30 days
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
                    "status_counts": {
                        "terms": { "field": "status.keyword", "size": 10 }
                    },
                    "errors": {
                        "filter": { "range": { "status": { "gte": 400 } } },
                        "aggs": {
                            "by_path": { "terms": { "field": "request.keyword", "size": 5 } }
                        }
                    }
                }
            }
            
            res = client.search(index=target_index, body=query)
            total_logs = res['hits']['total']['value']
            results.append(f"Total logs in last 30 days: {total_logs}")
            
            if total_logs > 0:
                status_buckets = res['aggregations']['status_counts']['buckets']
                results.append("\nStatus Code Distribution:")
                for b in status_buckets:
                    results.append(f"- {b['key']}: {b['doc_count']} ({ (b['doc_count']/total_logs)*100 :.2f}%)")
                
                error_count = res['aggregations']['errors']['doc_count']
                results.append(f"\nTotal Errors (4xx/5xx): {error_count} ({ (error_count/total_logs)*100 :.2f}%)")
                
                if error_count > (total_logs * 0.05):
                    results.append("ANOMALY: Error rate is over 5%!")
            else:
                results.append("No data found for the last 30 days.")

    except Exception as e:
        results.append(f"CRITICAL ERROR: {str(e)}")
    
    with open("/Users/tridlm/DevOps/analysis_final_results.txt", "w") as f:
        f.write("\n".join(results))

if __name__ == "__main__":
    run_analysis()
