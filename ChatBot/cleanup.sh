#!/bin/bash

echo "Starting quick cleanup of Azure Web App..."

# Function to safely remove a file
remove_if_exists() {
    local file="$1"
    if [ -f "$file" ]; then
        rm -f "$file"
        echo "Successfully removed: $file"
    fi
}

echo "Removing known unused files..."
# Remove old files that are no longer needed
remove_if_exists "server/routes/chatRoutes.js"
remove_if_exists "server/utils.js"
remove_if_exists "client/offline.html"
remove_if_exists "cleanup-azure.ps1"

# Quick cleanup of common temp files
echo "Removing common temp files..."
find . -maxdepth 3 -type f \( \
    -name "*.tmp" -o \
    -name "*.temp" -o \
    -name "*.log" -o \
    -name ".DS_Store" -o \
    -name "Thumbs.db" -o \
    -name "*.bak" \
    \) -delete 2>/dev/null

# Remove empty directories (only up to 3 levels deep for speed)
echo "Removing empty directories..."
find . -maxdepth 3 -type d -empty -not -path "./node_modules*" -not -path "./.git*" -delete 2>/dev/null

echo "Cleanup process completed!"
