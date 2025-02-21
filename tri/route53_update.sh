#!/bin/bash

# Set variables
DNS_NAME="jenkins-server.lz061.awsnp.national.au"
HOSTED_ZONE_NAME="lz061.awsnp.national.au"

# Get EC2 Public IP using IMDSv2 (recommended)
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
PUBLIC_IP=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/public-ipv4)

# Validate if the public IP was retrieved
if [ -z "$PUBLIC_IP" ]; then
    echo "❌ Failed to retrieve EC2 Public IP."
    exit 1
fi

echo "✅ Retrieved EC2 Public IP: $PUBLIC_IP"

# Get Route53 Hosted Zone ID
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name \
    --dns-name "$HOSTED_ZONE_NAME" \
    --query "HostedZones[0].Id" --output text | cut -d'/' -f3)

if [ -z "$HOSTED_ZONE_ID" ]; then
    echo "❌ Failed to retrieve Hosted Zone ID for $HOSTED_ZONE_NAME."
    exit 1
fi

echo "✅ Found Hosted Zone ID: $HOSTED_ZONE_ID"

# Create Route53 JSON Update File
cat << EOF > route53-update.json
{
  "Comment": "Auto-updating Route53 record with new EC2 IP",
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "$DNS_NAME.",
        "Type": "A",
        "TTL": 300,
        "ResourceRecords": [
          {
            "Value": "$PUBLIC_IP"
          }
        ]
      }
    }
  ]
}
EOF

echo "✅ Generated route53-update.json"

# Apply Route53 Update
aws route53 change-resource-record-sets \
    --hosted-zone-id "$HOSTED_ZONE_ID" \
    --change-batch file://route53-update.json

if [ $? -eq 0 ]; then
    echo "✅ DNS record for $DNS_NAME successfully updated to $PUBLIC_IP"
else
    echo "❌ Failed to update DNS record."
fi