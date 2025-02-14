#!/bin/bash

# Load parameters from configuration file
CONFIG_FILE="vault_config.env"
if [[ ! -f "$CONFIG_FILE" ]]; then
    echo "Error: Configuration file $CONFIG_FILE not found!"
    exit 1
fi
source "$CONFIG_FILE"

# Ensure required parameters are set
if [[ -z "$VAULT_ADDRESS" || -z "$VAULT_NAMESPACE" || -z "$VAULT_SECRET" || -z "$EXPIRED_DAYS" || -z "$AWS_SNS_TOPIC" ]]; then
    echo "Error: Missing required configuration parameters."
    exit 1
fi

# Log in to Vault
export VAULT_ADDR="$VAULT_ADDRESS"
VAULT_TOKEN=$(vault login -method=approle -namespace="$VAULT_NAMESPACE" -format=json | jq -r '.auth.client_token')
if [[ -z "$VAULT_TOKEN" ]]; then
    echo "Error: Failed to authenticate with Vault."
    exit 1
fi
export VAULT_TOKEN

# Retrieve secret from Vault
SECRET_DATA=$(vault kv get -namespace="$VAULT_NAMESPACE" -format=json "$VAULT_SECRET")
if [[ -z "$SECRET_DATA" ]]; then
    echo "Error: Failed to retrieve secret from Vault."
    exit 1
fi

# Extract expiration period (assumes field name 'expired_period' in hours)
EXPIRED_HOURS=$(echo "$SECRET_DATA" | jq -r '.data.data.expired_period')
if [[ -z "$EXPIRED_HOURS" || "$EXPIRED_HOURS" == "null" ]]; then
    echo "Error: 'expired_period' field not found in secret data."
    exit 1
fi

# Convert expiration period to days
EXPIRED_DAYS_CALCULATED=$((EXPIRED_HOURS / 24))

# Check expiration condition
if [[ "$EXPIRED_DAYS_CALCULATED" -lt "$EXPIRED_DAYS" ]]; then
    MESSAGE="Alert: The secret $VAULT_SECRET in namespace $VAULT_NAMESPACE is expiring in $EXPIRED_DAYS_CALCULATED days. Please take action."
    echo "$MESSAGE"
    aws sns publish --topic-arn "$AWS_SNS_TOPIC" --message "$MESSAGE"
    echo "Notification sent via AWS SNS."
else
    echo "The secret is not expiring within $EXPIRED_DAYS days. No action needed."
fi
