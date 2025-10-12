Here’s a clean, production-ready AWS Lambda example that runs daily (via EventBridge) to automatically delete old snapshots — keeping only the latest 30 snapshots and any that are less than 30 days old.

⸻

🧩 Overview
	•	Trigger: Daily at 01:00 UTC using EventBridge (CloudWatch Scheduler)
	•	Action: List snapshots (for a specific tag, volume, or all)
	•	Retention Policy:
	•	Keep any snapshot younger than 30 days
	•	Keep the latest 30 snapshots
	•	Delete everything else

⸻

🐍 Lambda Function (Python 3.9+)

import boto3
import datetime

ec2 = boto3.client('ec2')

# CONFIGURATION
RETENTION_DAYS = 30
KEEP_LATEST = 30
FILTER_TAG = {'Name': 'tag:Backup', 'Values': ['True']}  # optional filter

def lambda_handler(event, context):
    today = datetime.datetime.utcnow().date()

    # Get all snapshots owned by this account
    snapshots = ec2.describe_snapshots(OwnerIds=['self'], Filters=[FILTER_TAG])['Snapshots']

    # Sort by start time (newest first)
    snapshots.sort(key=lambda s: s['StartTime'], reverse=True)

    to_keep = set()
    to_delete = []

    # 1️⃣ Keep latest N snapshots
    latest_snapshots = snapshots[:KEEP_LATEST]
    for snap in latest_snapshots:
        to_keep.add(snap['SnapshotId'])

    # 2️⃣ Keep all snapshots created within RETENTION_DAYS
    for snap in snapshots:
        age_days = (today - snap['StartTime'].date()).days
        if age_days <= RETENTION_DAYS:
            to_keep.add(snap['SnapshotId'])

    # 3️⃣ Mark others for deletion
    for snap in snapshots:
        if snap['SnapshotId'] not in to_keep:
            to_delete.append(snap['SnapshotId'])

    # 4️⃣ Delete
    for snapshot_id in to_delete:
        try:
            ec2.delete_snapshot(SnapshotId=snapshot_id)
            print(f"Deleted old snapshot: {snapshot_id}")
        except Exception as e:
            print(f"Error deleting {snapshot_id}: {e}")

    print(f"Kept {len(to_keep)} snapshots, deleted {len(to_delete)} old ones.")


⸻

⏰ EventBridge (Scheduler) Rule

Create a rule in AWS Console or with CLI:

aws events put-rule \
  --name "daily-snapshot-cleanup" \
  --schedule-expression "cron(0 1 * * ? *)" \
  --description "Run daily to clean up old snapshots"

Then add permission for Lambda to be triggered:

aws lambda add-permission \
  --function-name your-lambda-name \
  --statement-id daily-snapshot-cleanup \
  --action "lambda:InvokeFunction" \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:REGION:ACCOUNT_ID:rule/daily-snapshot-cleanup

And connect the rule to the Lambda target.

⸻

✅ Notes & Customization
	•	You can filter snapshots by:
	•	Volume ID → {'Name': 'volume-id', 'Values': ['vol-xxxx']}
	•	Tag → as in example
	•	Description pattern → {'Name': 'description', 'Values': ['backup-*']}
	•	Add logging to CloudWatch to monitor what’s being deleted.
	•	Optionally use AWS Backup if you prefer policy-driven retention.

⸻

Would you like me to convert this into a Terraform or CloudFormation template that deploys the Lambda and EventBridge schedule automatically?
