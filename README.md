# mysql-init-helper



## Environments

### DB_HOST

mysql db hostname



### DB_ADMIN_USER

create-user, create-db, grant-privileges 옵션에서 사용할 계정



### DB_ADMIN_PASS

비밀번호



### DB_USER

query를 처리하기 위한 계정



### DB_PASS

query를 처리하기 위한 비밀번호



### DB_NAME

Database 이름



## Options

### --create-user[=true/false]

DB_USER 사용자가 존재하지 않을 경우 DB_PASS를 비밀번호로 하여 계정을 생성함

DB_PASS를 주지 않을 시 random하게 생성함.



### --create-db[=true/false]

DB_NAME database가 존재하지 않을 경우 Database 생성



### --grant-privileges[=true/false]

DB_USER가 DB_NAME Database에 대한 모든 접근을 허용하도록 설정



### --ignore-query-error[=true/false]

sql 실행시 오류 무시 (exit code을 바꾸지 않음)

sql이 여러 줄일 경우 오류 다음부터는 무시 될 수 있음



### --save-db-password=FILE_PATH

random 하게 비번 생성한 경우 비밀번호를 FILE_PATH 에 저장



### --sql-file=FILE_PATH

실행할 sql 파일 경로를 지정 (다중 지정 가능)



혹은 pipe를 통해 stdin 으로 전달할 수 있음

e.g. `/start.sh <<< "CREATE TABLE aaa;"`





## Example

templates 디렉터리 내에 아래와 같이 sql 정의와 (pre-install) job을 생성하면 helm 설치 시 자동으로 sql를 실행할 수 있음.



**db-schema-configmap.yaml**

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: "{{ .Release.Name }}-db-schema"
  labels:
    app.kubernetes.io/managed-by: {{ .Release.Service | quote }}
    app.kubernetes.io/instance: {{ .Release.Name | quote }}
    app.kubernetes.io/version: {{ .Chart.AppVersion }}
    helm.sh/chart: "{{ .Chart.Name }}-{{ .Chart.Version }}"
  annotations:
    "helm.sh/hook": pre-install
    "helm.sh/hook-weight": "-10"
    "helm.sh/hook-delete-policy": hook-succeeded
data:
  ddl.sql: |
    CREATE TABLE `test_table` (
      `seq` bigint(20) NOT NULL,
      `hello` text DEFAULT NULL,
      `created_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8;

```

**db-install-job.yaml**

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: "{{ .Release.Name }}-db-install-job"
  labels:
    app.kubernetes.io/managed-by: {{ .Release.Service | quote }}
    app.kubernetes.io/instance: {{ .Release.Name | quote }}
    app.kubernetes.io/version: {{ .Chart.AppVersion }}
    helm.sh/chart: "{{ .Chart.Name }}-{{ .Chart.Version }}"
  annotations:
    "helm.sh/hook": pre-install
    "helm.sh/hook-weight": "-8"
    "helm.sh/hook-delete-policy": hook-succeeded
spec:
  template:
    metadata:
      name: "{{ .Release.Name }}-db-job"
      labels:
        app.kubernetes.io/managed-by: {{ .Release.Service | quote }}
        app.kubernetes.io/instance: {{ .Release.Name | quote }}
        helm.sh/chart: "{{ .Chart.Name }}-{{ .Chart.Version }}"
    spec:
      restartPolicy: OnFailure
      volumes:
        - name: data-volume
          configMap:
            name: "{{ .Release.Name }}-db-schema"
      containers:
        - name: ddl-job
          image: "jclab/mysql-init-helper:release-1.0.1"
          volumeMounts:
            - name: data-volume
              mountPath: /data
          command:
            - /start.sh
          args:
            {{- if .Values.dbCreateUser }}
            - --create-user
            - --grant-privileges
            {{- end }}
            {{- if .Values.dbCreateDb }}
            - --create-db
            - --grant-privileges
            {{- end }}
            - --sql-file=/data/ddl.sql
          env:
            - name: DB_HOST
              value: {{ .Values.dbHost | quote }}
            - name: DB_PORT
              value: {{ .Values.dbPort | quote }}
            - name: DB_ADMIN_USER
              value: {{ .Values.dbAdminUsername | quote }}
            - name: DB_ADMIN_PASS
              value: {{ .Values.dbAdminPassword | quote }}
            - name: DB_USER
              value: {{ .Values.dbUsername | quote }}
            - name: DB_PASS
              value: {{ .Values.dbPassword | quote }}
            - name: DB_NAME
              value: {{ .Values.dbName | quote }}
```



## License

Apache-2.0

