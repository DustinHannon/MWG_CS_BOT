#!/bin/bash

echo "Starting comprehensive cleanup of Azure Web App..."

# Array of known project files/directories that should be kept
declare -a PROJECT_FILES=(
    "package.json"
    "package-lock.json"
    "web.config"
    "server/main.js"
    "server/config/config.js"
    "server/middleware/errorHandler.js"
    "server/middleware/security.js"
    "server/services/openaiService.js"
    "client/index.html"
    "client/service-worker.js"
    "client/styles.css"
    "client/app/index.js"
    "client/app/modules/chatUI.js"
    "client/app/modules/formHandler.js"
    "client/app/modules/themeHandler.js"
    "client/images/favicon.ico"
    "client/images/logo.png"
)

# Patterns for temp/junk files to always remove
declare -a TEMP_PATTERNS=(
    "*.tmp"
    "*.temp"
    "*.log"
    "*debug.log*"
    "*.swp"
    "*.bak"
    "*.cache"
    "Thumbs.db"
    ".DS_Store"
    "*~"
    "npm-debug.log*"
    "yarn-debug.log*"
    "yarn-error.log*"
    ".env.local"
    ".env.development.local"
    ".env.test.local"
    ".env.production.local"
)

# Function to safely remove a file
remove_if_exists() {
    local file="$1"
    if [ -f "$file" ]; then
        rm -f "$file"
        echo "Successfully removed: $file"
    fi
}

# Function to check if a file is a known project file
is_project_file() {
    local file="$1"
    for project_file in "${PROJECT_FILES[@]}"; do
        if [ "$file" = "$project_file" ]; then
            return 0
        fi
    done
    return 1
}

# Function to check if a file matches temp patterns
is_temp_file() {
    local file="$1"
    for pattern in "${TEMP_PATTERNS[@]}"; do
        if [[ "$file" == $pattern ]]; then
            return 0
        fi
    done
    return 1
}

echo "Removing known unused files..."
# Remove old files that are no longer needed
remove_if_exists "server/routes/chatRoutes.js"
remove_if_exists "server/utils.js"
remove_if_exists "client/offline.html"
remove_if_exists "cleanup-azure.ps1"

echo "Cleaning up temporary files..."
while IFS= read -r -d '' file; do
    relative_path="${file#./}"
    if is_temp_file "$(basename "$file")"; then
        remove_if_exists "$relative_path"
    fi
done < <(find . -type f -print0)

echo "Checking for unknown files..."
while IFS= read -r -d '' file; do
    relative_path="${file#./}"
    if ! is_project_file "$relative_path" && \
       [[ "$relative_path" != node_modules/* ]] && \
       [[ "$relative_path" != .git* ]] && \
       [[ "$relative_path" != "cleanup.sh" ]]; then
        echo "Unknown file found: $relative_path"
        remove_if_exists "$relative_path"
    fi
done < <(find . -type f -print0)

echo "Cleaning up empty directories..."
find . -type d -empty -not -path "./node_modules*" -not -path "./.git*" -delete

echo "Cleanup process completed!"
