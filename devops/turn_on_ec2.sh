#!/bin/bash

# Replace this with your EC2 instance Name tag
INSTANCE_NAME="my-ec2-instance-name"
REGION="us-east-1"

# Get the instance ID based on the Name tag
INSTANCE_ID=$(aws ec2 describe-instances \
    --region "$REGION" \
    --filters "Name=tag:Name,Values=$INSTANCE_NAME" "Name=instance-state-name,Values=stopping,shutting-down,stopped,running" \
    --query "Reservations[0].Instances[0].InstanceId" \
    --output text)

if [[ "$INSTANCE_ID" == "None" ]]; then
    echo "No instance found with Name: $INSTANCE_NAME"
    exit 1
fi

# Get the current state of the instance
STATE=$(aws ec2 describe-instances \
    --instance-ids "$INSTANCE_ID" \
    --region "$REGION" \
    --query "Reservations[0].Instances[0].State.Name" \
    --output text)

echo "Current state of instance $INSTANCE_ID ($INSTANCE_NAME): $STATE"

# Check if the instance is stopping or shutting down
if [[ "$STATE" == "stopping" || "$STATE" == "shutting-down" ]]; then
    echo "Attempting to start instance $INSTANCE_ID..."
    aws ec2 start-instances --instance-ids "$INSTANCE_ID" --region "$REGION"
    echo "Start request sent."
else
    echo "No action needed."
fi