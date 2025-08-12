### Edit values.yaml
```yaml
app:
  name: mywebsite
  image: nginx
  fqdn: web1.doleminhtri.com
```
### templates/deployment.yaml
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Values.app.name }}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: {{ .Values.app.name }}
  template:
    metadata:
      labels:
        app: {{ .Values.app.name }}
    spec:
      initContainers:
        - name: set-fqdn
          image: busybox
          securityContext:
            runAsUser: 0
            allowPrivilegeEscalation: true
            capabilities:
              add: ["SYS_ADMIN", "SET_HOSTNAME"]
          command: ["/bin/sh", "-c"]
          args:
            - |                            
              echo "{{ .Values.app.fqdn }}" > /etc/hostname;
              hostname "{{ .Values.app.fqdn }}";
              echo "Set hostname to: $(hostname)";              
              sleep 1;
      hostAliases:
        - ip: "127.0.0.1"
          hostnames:
            - "{{ .Values.app.fqdn }} "
      containers:
        - name: {{ .Values.app.name }}
          image: {{ .Values.app.image }}          
          command: ["/bin/sh", "-c"]
          args:
            - |
              echo "Current hostname: $(hostname)";
              echo "Current FQDN: $(hostname -f)";
              exec nginx -g 'daemon off;'
```
