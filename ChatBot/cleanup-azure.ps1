# Azure Web App Cleanup Script

Write-Host "Starting comprehensive cleanup of Azure Web App..."

# Array of known project files/directories that should be kept
$projectFiles = @(
    "package.json",
    "package-lock.json",
    "web.config",
    "server/main.js",
    "server/config/config.js",
    "server/middleware/errorHandler.js",
    "server/middleware/security.js",
    "server/services/openaiService.js",
    "client/index.html",
    "client/service-worker.js",
    "client/styles.css",
    "client/app/index.js",
    "client/app/modules/chatUI.js",
    "client/app/modules/formHandler.js",
    "client/app/modules/themeHandler.js",
    "client/images/favicon.ico",
    "client/images/logo.png"
)

# Patterns for temp/junk files to always remove
$tempFilePatterns = @(
    "*.tmp",
    "*.temp",
    "*.log",
    "*debug.log*",
    "*.swp",
    "*.bak",
    "*.cache",
    "Thumbs.db",
    ".DS_Store",
    "*~",
    "npm-debug.log*",
    "yarn-debug.log*",
    "yarn-error.log*",
    ".env.local",
    ".env.development.local",
    ".env.test.local",
    ".env.production.local"
)

# Function to safely remove a file
function Remove-FileIfExists {
    param (
        [string]$filePath
    )
    
    try {
        if (Test-Path $filePath) {
            Remove-Item $filePath -Force
            Write-Host "Successfully removed: $filePath" -ForegroundColor Green
            return $true
        }
        return $false
    } catch {
        Write-Host "Error removing $filePath : $_" -ForegroundColor Red
        return $false
    }
}

# Function to check if a file is a known project file
function Is-ProjectFile {
    param (
        [string]$filePath
    )
    
    foreach ($projectFile in $projectFiles) {
        if ($filePath -eq $projectFile) {
            return $true
        }
    }
    return $false
}

# Function to check if a file matches temp file patterns
function Is-TempFile {
    param (
        [string]$fileName
    )
    
    foreach ($pattern in $tempFilePatterns) {
        if ($fileName -like $pattern) {
            return $true
        }
    }
    return $false
}

# Remove known unused files
Write-Host "`nRemoving known unused files..."
Remove-FileIfExists -filePath "server/routes/chatRoutes.js"
Remove-FileIfExists -filePath "server/utils.js"
Remove-FileIfExists -filePath "client/offline.html"

# Clean up temp files
Write-Host "`nCleaning up temporary files..."
Get-ChildItem -Path . -Recurse -File | ForEach-Object {
    $relativePath = $_.FullName.Substring($PWD.Path.Length + 1)
    if (Is-TempFile -fileName $_.Name) {
        Remove-FileIfExists -filePath $relativePath
    }
}

# Remove any file that's not in the project files list (except node_modules)
Write-Host "`nChecking for unknown files..."
Get-ChildItem -Path . -Recurse -File | ForEach-Object {
    $relativePath = $_.FullName.Substring($PWD.Path.Length + 1)
    if (-not (Is-ProjectFile -filePath $relativePath) -and 
        -not ($relativePath -like "node_modules*") -and
        -not ($relativePath -like ".git*") -and
        -not ($relativePath -eq "cleanup-azure.ps1")) {
        Write-Host "Unknown file found: $relativePath"
        Remove-FileIfExists -filePath $relativePath
    }
}

# Clean up empty directories
Write-Host "`nCleaning up empty directories..."
Get-ChildItem -Path . -Recurse -Directory | 
    Where-Object { 
        $_.GetFiles().Count -eq 0 -and 
        $_.GetDirectories().Count -eq 0 -and
        $_.FullName -notlike "*node_modules*" -and
        $_.FullName -notlike "*.git*"
    } | 
    ForEach-Object {
        try {
            $relativePath = $_.FullName.Substring($PWD.Path.Length + 1)
            Remove-Item $_.FullName -Force
            Write-Host "Removed empty directory: $relativePath" -ForegroundColor Green
        } catch {
            Write-Host "Error removing directory $($_.FullName): $_" -ForegroundColor Red
        }
    }

Write-Host "`nCleanup process completed!"
