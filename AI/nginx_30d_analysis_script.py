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
    report = {
        "timestamp": datetime.now().isoformat(),
        "status": "starting",
        "results": {}
    }
    try:
        # Check connection
        health = client.cluster.health()
        report["cluster_health"] = health["status"]
        
        # List indices
        indices = client.cat.indices(format="json")
        nginx_indices = [i['index'] for i in indices if 'nginx' in i['index'].lower()]
        
        if not nginx_indices:
            report["status"] = "error"
            report["error"] = "No nginx indices found"
            report["available_indices"] = [i['index'] for i in indices[:10]]
        else:
            target_index = nginx_indices[0]
            report["target_index"] = target_index
            
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
                            "by_path": { "terms": { "field": "request.keyword", "size": 10 } }
                        }
                    },
                    "top_ips": {
                        "terms": { "field": "remote_ip.keyword", "size": 10 }
                    }
                }
            }
            
            res = client.search(index=target_index, body=query)
            total_logs = res['hits']['total']['value']
            report["results"]["total_logs"] = total_logs
            
            if total_logs > 0:
                report["results"]["status_distribution"] = res['aggregations']['status_counts']['buckets']
                report["results"]["error_count"] = res['aggregations']['errors']['doc_count']
                report["results"]["top_error_paths"] = res['aggregations']['errors']['by_path']['buckets']
                report["results"]["top_ips"] = res['aggregations']['top_ips']['buckets']
                
                error_rate = (report["results"]["error_count"] / total_logs) * 100
                report["results"]["error_rate_percent"] = error_rate
                
                if error_rate > 5:
                    report["anomaly"] = True
                    report["anomaly_reason"] = f"Error rate is {error_rate:.2f}% which is over 5%"
                else:
                    report["anomaly"] = False
            else:
                report["status"] = "no_data"
                report["message"] = "No data found for the last 30 days"

    except Exception as e:
        report["status"] = "error"
        report["error"] = str(e)
    
    with open("/Users/tridlm/DevOps/nginx_30d_analysis.json", "w") as f:
        json.dump(report, f, indent=2)

if __name__ == "__main__":
    run_analysis()
