import os
import json
import boto3
import hvac

def lambda_handler(event, context):
    # Load environment variables
    VAULT_ADDRESS = os.getenv('VAULT_ADDRESS')
    VAULT_NAMESPACE = os.getenv('VAULT_NAMESPACE')
    VAULT_SECRET = os.getenv('VAULT_SECRET')
    EXPIRED_DAYS = int(os.getenv('EXPIRED_DAYS', 10))
    AWS_SNS_TOPIC = os.getenv('AWS_SNS_TOPIC')

    # Ensure required parameters are set
    if not all([VAULT_ADDRESS, VAULT_NAMESPACE, VAULT_SECRET, AWS_SNS_TOPIC]):
        return {"status": "error", "message": "Missing required environment variables."}

    # Authenticate with Vault
    client = hvac.Client(url=VAULT_ADDRESS)
    if not client.is_authenticated():
        return {"status": "error", "message": "Failed to authenticate with Vault."}

    # Retrieve secret from Vault
    secret_response = client.secrets.kv.v2.read_secret_version(path=VAULT_SECRET, mount_point='secret')
    if 'data' not in secret_response or 'data' not in secret_response['data']:
        return {"status": "error", "message": "Failed to retrieve secret from Vault."}

    # Extract expiration period (assumes field name 'expired_period' in hours)
    expired_hours = secret_response['data']['data'].get('expired_period')
    if expired_hours is None:
        return {"status": "error", "message": "'expired_period' field not found in secret data."}

    # Convert expiration period to days
    expired_days_calculated = expired_hours // 24

    # Check expiration condition
    if expired_days_calculated < EXPIRED_DAYS:
        message = f"Alert: The secret {VAULT_SECRET} in namespace {VAULT_NAMESPACE} is expiring in {expired_days_calculated} days. Please take action."

        # Send notification via AWS SNS
        sns_client = boto3.client('sns')
        sns_client.publish(TopicArn=AWS_SNS_TOPIC, Message=message)
        return {"status": "success", "message": "Notification sent via AWS SNS."}

    return {"status": "success", "message": "The secret is not expiring within the threshold."}
