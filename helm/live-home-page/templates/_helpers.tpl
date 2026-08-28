{{- define "live-home-page.name" -}}
{{- .Chart.Name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "live-home-page.fullname" -}}
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

{{- define "live-home-page.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
app.kubernetes.io/name: {{ include "live-home-page.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Values.image.tag | default .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "live-home-page.selectorLabels" -}}
app.kubernetes.io/name: {{ include "live-home-page.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Separate fullname/selector helpers for the backend and db workloads (added
alongside the original single-container chart). These intentionally differ
from live-home-page.fullname/selectorLabels above rather than parameterizing
them — Deployment/StatefulSet spec.selector is immutable, so the existing
monitor Deployment's selector labels must never change on upgrade.
*/}}
{{- define "live-home-page.backendFullname" -}}
{{- printf "%s-backend" (include "live-home-page.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "live-home-page.backendSelectorLabels" -}}
app.kubernetes.io/name: {{ printf "%s-backend" (include "live-home-page.name" .) }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "live-home-page.dbFullname" -}}
{{- printf "%s-db" (include "live-home-page.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "live-home-page.dbSelectorLabels" -}}
app.kubernetes.io/name: {{ printf "%s-db" (include "live-home-page.name" .) }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
MariaDB host the backend connects to: the in-cluster Service when db.enabled,
otherwise db.host (an external server).
*/}}
{{- define "live-home-page.dbHost" -}}
{{- if .Values.db.enabled }}
{{- include "live-home-page.dbFullname" . }}
{{- else }}
{{- .Values.db.host }}
{{- end }}
{{- end }}

{{- define "live-home-page.secretName" -}}
{{- if .Values.unifi.existingSecret }}
{{- .Values.unifi.existingSecret }}
{{- else }}
{{- include "live-home-page.fullname" . }}
{{- end }}
{{- end }}

{{- define "live-home-page.localUrl" -}}
{{- if .Values.unifi.localUrl }}
{{- .Values.unifi.localUrl }}
{{- else }}
{{- printf "https://%s/proxy/network" .Values.unifi.localIp }}
{{- end }}
{{- end }}
