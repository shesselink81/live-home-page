// docker-bake.hcl
target "docker-metadata-action" {}

target "build" {
  inherits = ["docker-metadata-action"]
  context = "./app/"
  dockerfile = "Dockerfile.prod"
  platforms = [
    "linux/amd64",
  ]
}