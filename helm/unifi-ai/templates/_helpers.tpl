{{- define "unifi-ai.name" -}}
{{- .Chart.Name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "unifi-ai.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := .Chart.Name }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "unifi-ai.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
app.kubernetes.io/name: {{ include "unifi-ai.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Values.image.tag | default .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "unifi-ai.selectorLabels" -}}
app.kubernetes.io/name: {{ include "unifi-ai.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "unifi-ai.secretName" -}}
{{- if .Values.unifi.existingSecret }}
{{- .Values.unifi.existingSecret }}
{{- else }}
{{- include "unifi-ai.fullname" . }}
{{- end }}
{{- end }}

{{- define "unifi-ai.localUrl" -}}
{{- if .Values.unifi.localUrl }}
{{- .Values.unifi.localUrl }}
{{- else }}
{{- printf "https://%s/proxy/network" .Values.unifi.localIp }}
{{- end }}
{{- end }}
