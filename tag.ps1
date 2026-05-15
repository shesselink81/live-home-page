$version="1.0.8" # --- UPDATE THIS VERSION NUMBER ---
git tag -a v$version -m "Release version $version"
git push origin v$version
echo "Tag v$version created and pushed to origin."