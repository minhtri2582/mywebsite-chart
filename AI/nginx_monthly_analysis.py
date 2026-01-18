import os
import json
from datetime import datetime, timedelta
from opensearchpy import OpenSearch
import urllib3

# Suppress SSL warnings for local/self-signed certificates
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Configuration - Loaded from environment or defaults
OPENSEARCH_URL = os.getenv("OPENSEARCH_URL", "https://localhost:9200")
OPENSEARCH_USERNAME = os.getenv("OPENSEARCH_USERNAME", "admin")
OPENSEARCH_PASSWORD = os.getenv("OPENSEARCH_PASSWORD", "O0cpR65ml6eDQAah")
VERIFY_SSL = os.getenv("OPENSEARCH_VERIFY_SSL", "false").lower() == "true"

class NginxAnalyzer:
    def __init__(self):
        self.client = OpenSearch(
            hosts=[OPENSEARCH_URL],
            http_auth=(OPENSEARCH_USERNAME, OPENSEARCH_PASSWORD),
            use_ssl=True,
            verify_certs=VERIFY_SSL,
            ssl_show_warn=False
        )

    def get_nginx_indices(self):
        """Find all indices related to nginx."""
        try:
            indices = self.client.cat.indices(format="json")
            return [i['index'] for i in indices if 'nginx' in i['index'].lower()]
        except Exception as e:
            print(f"Error fetching indices: {e}")
            return []

    def analyze_last_30_days(self, index_pattern="nginx*"):
        """Perform comprehensive analysis for the last 30 days."""
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(days=30)
        
        # Check if indices exist
        available_indices = self.get_nginx_indices()
        if not available_indices:
            return {"error": "No nginx indices found", "status": "failed"}

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
                        "top_error_paths": { "terms": { "field": "request.keyword", "size": 10 } },
                        "error_by_ip": { "terms": { "field": "remote_ip.keyword", "size": 10 } }
                    }
                },
                "top_ips": {
                    "terms": { "field": "remote_ip.keyword", "size": 10 }
                },
                "traffic_over_time": {
                    "date_histogram": {
                        "field": "@timestamp",
                        "calendar_interval": "day"
                    }
                }
            }
        }

        try:
            res = self.client.search(index=index_pattern, body=query)
            total_logs = res['hits']['total']['value']
            
            report = {
                "analysis_timestamp": datetime.now().isoformat(),
                "time_range_days": 30,
                "total_logs": total_logs,
                "status_code_distribution": {},
                "top_error_paths": [],
                "top_client_ips": [],
                "anomalies": []
            }

            if total_logs > 0:
                # Process Status Distribution
                for bucket in res['aggregations']['status_counts']['buckets']:
                    report["status_code_distribution"][bucket['key']] = {
                        "count": bucket['doc_count'],
                        "percentage": round((bucket['doc_count'] / total_logs) * 100, 2)
                    }

                # Process Top Error Paths
                for bucket in res['aggregations']['errors']['top_error_paths']['buckets']:
                    report["top_error_paths"].append({
                        "path": bucket['key'],
                        "count": bucket['doc_count']
                    })

                # Process Top IPs
                for bucket in res['aggregations']['top_ips']['buckets']:
                    report["top_client_ips"].append({
                        "ip": bucket['key'],
                        "count": bucket['doc_count']
                    })

                # Anomaly Detection Logic
                error_count = res['aggregations']['errors']['doc_count']
                error_rate = (error_count / total_logs) * 100
                if error_rate > 5:
                    report["anomalies"].append(f"High error rate detected: {error_rate:.2f}%")
                
                # Check for large spikes in error paths (potential scanning)
                for path in report["top_error_paths"]:
                    if ".env" in path['path'] or "wp-admin" in path['path']:
                        report["anomalies"].append(f"Security scan detected on path: {path['path']}")

            return report

        except Exception as e:
            return {"error": str(e), "status": "failed"}

def main():
    analyzer = NginxAnalyzer()
    print("Starting Nginx Log Analysis (30 Days)...")
    report = analyzer.analyze_last_30_days()
    
    output_file = "/Users/tridlm/DevOps/mywebsite-chart/AI/nginx_monthly_report.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    
    print(f"Analysis complete. Report saved to: {output_file}")
    if "error" not in report:
        print(f"Total logs processed: {report.get('total_logs', 0)}")
        print(f"Anomalies found: {len(report.get('anomalies', []))}")

if __name__ == "__main__":
    main()
