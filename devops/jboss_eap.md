# JBoss EAP on EKS with `standalone-ha-full.xml`

This document explains how to deploy a JBoss EAP cluster on AWS EKS using a Kubernetes `Deployment`, service-based clustering, and `standalone-ha-full.xml`.

## Why use `Deployment` instead of `StatefulSet`

A `Deployment` is fine when:

- you do not require stable persistent network identities for JBoss pods
- cluster membership can be handled through DNS-based discovery
- pod IPs are ephemeral and only the service endpoint matters

If your application needs stable pod hostnames or local persistent storage, prefer `StatefulSet`. For most EAP clusters on EKS, `Deployment` plus a headless service is simpler and works well.

## Cluster discovery strategy

EKS does not support multicast for JGroups out of the box. Use one of these for JBoss clustering:

- `DNS_PING` with a headless service
- `TCPPING` with explicit pod DNS names

The recommended option is `DNS_PING`.

## Required Kubernetes objects

### 1. Headless service for JGroups discovery

```yaml
apiVersion: v1
kind: Service
metadata:
  name: jboss-cluster-headless
  labels:
    app: jboss-eap
spec:
  clusterIP: None
  selector:
    app: jboss-eap
  ports:
    - name: http
      port: 8080
    - name: management
      port: 9990
    - name: jgroups
      port: 7600
```

### 2. External service for application access

```yaml
apiVersion: v1
kind: Service
metadata:
  name: jboss-eap
  labels:
    app: jboss-eap
spec:
  type: LoadBalancer
  selector:
    app: jboss-eap
  ports:
    - name: http
      port: 80
      targetPort: 8080
    - name: management
      port: 9990
      targetPort: 9990
```

### 3. Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: jboss-eap
spec:
  replicas: 3
  selector:
    matchLabels:
      app: jboss-eap
  template:
    metadata:
      labels:
        app: jboss-eap
    spec:
      terminationGracePeriodSeconds: 120
      containers:
        - name: jboss-eap
          image: registry.redhat.io/jboss-eap-7/eap72-openjdk11-openshift
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 8080
              name: http
            - containerPort: 9990
              name: management
            - containerPort: 7600
              name: jgroups
          env:
            - name: JBOSS_NODE_NAME
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
            - name: JBOSS_HOME
              value: "/opt/eap"
            - name: JBOSS_CONFIG
              value: "standalone-ha-full.xml"
            - name: JGROUPS_DISCOVERY_PROTOCOL
              value: "DNS_PING"
            - name: JGROUPS_DNS_PING_NAME
              value: "jboss-cluster-headless.default.svc.cluster.local"
            - name: JGROUPS_BIND_ADDR
              value: "0.0.0.0"
          command: ["/opt/eap/bin/standalone.sh"]
          args:
            - "-c"
            - "standalone-ha-full.xml"
            - "-b"
            - "0.0.0.0"
            - "-bmanagement"
            - "0.0.0.0"
            - "-Djboss.node.name=$(HOSTNAME)"
          readinessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 30
            periodSeconds: 15
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 60
            periodSeconds: 30
```

## Custom `standalone-ha-full.xml`

If you need custom configuration, store the file in a `ConfigMap` and mount it into the container.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: jboss-eap-config
data:
  standalone-ha-full.xml: |
    <?xml version="1.0" encoding="UTF-8"?>
    <server xmlns="urn:jboss:domain:7.0">
      <extensions>
        <!-- ... -->
      </extensions>
      <management>
        <!-- management config -->
      </management>
      <profile>
        <subsystem xmlns="urn:jboss:domain:jgroups:6.0">
          <stack name="tcp">
            <transport type="TCP" socket-binding="jgroups-tcp"/>
            <protocol type="DNS_PING">
              <property name="dns_query">jboss-cluster-headless.default.svc.cluster.local</property>
            </protocol>
            <protocol type="FD_SOCK" socket-binding="jgroups-udp-fd"/>
            <protocol type="FD_ALL"/> 
            <protocol type="VERIFY_SUSPECT"/>
            <protocol type="pbcast.NAKACK2"/>
            <protocol type="UNICAST3"/>
            <protocol type="pbcast.STABLE"/>
            <protocol type="pbcast.GMS"/>
          </stack>
        </subsystem>
        <!-- other subsystems -->
      </profile>
      <socket-binding-group name="standard-sockets" default-interface="public">
        <socket-binding name="jgroups-tcp" port="7600"/>
      </socket-binding-group>
    </server>
```

Mount it:

```yaml
          volumeMounts:
            - name: jboss-config
              mountPath: /opt/eap/standalone/configuration/standalone-ha-full.xml
              subPath: standalone-ha-full.xml
      volumes:
        - name: jboss-config
          configMap:
            name: jboss-eap-config
```

## Important configuration notes

- `-b 0.0.0.0` and `-bmanagement 0.0.0.0` are mandatory so JBoss listens on all container interfaces.
- Use `$(HOSTNAME)` or `metadata.name` for `jboss.node.name` so each pod has a unique identity.
- If you have multiple clusters in the same namespace, use separate headless service names and DNS queries.
- Ensure the JGroups port (`7600`) is open within the pod network.

## Validation

- `kubectl get pods -l app=jboss-eap`
- `kubectl get svc jboss-cluster-headless`
- `kubectl logs <pod>` to confirm cluster formation
- `nslookup jboss-cluster-headless.default.svc.cluster.local` from a pod
- Access the app via the `jboss-eap` LoadBalancer service

## Troubleshooting

- If cluster members do not form, verify DNS resolution and headless service selectors.
- If JBoss fails to bind, confirm `0.0.0.0` binding and that the container port is exposed.
- If session replication fails, verify `standalone-ha-full.xml` includes the correct `cache-container` and `infinispan` subsystems.
- If pods are restarting, inspect readiness/liveness path and JBoss startup logs.

## Summary

This setup uses a standard Kubernetes `Deployment`, a headless service for JGroups, and `standalone-ha-full.xml` for EAP clustering. It is suitable for EKS when you want dynamic pod membership without requiring StatefulSet stable identities.
