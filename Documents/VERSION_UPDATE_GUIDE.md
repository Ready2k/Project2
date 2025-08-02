# Version Update Guide

This guide explains how to update the version information displayed in the Help section of the AI Voice Assistant.

## Quick Update Process

1. **Edit `version-config.js`**
   - Update the `version` field (e.g., "v2.1.1", "v2.2.0")
   - Update the `buildDate` field with current date (YYYY-MM-DD format)
   - Update the `lastUpdated` field with a brief description of changes

2. **Example Update:**
```javascript
const VERSION_CONFIG = {
    version: "v2.1.1",           // ← Update this
    buildDate: "2025-01-30",     // ← Update this  
    lastUpdated: "Bug fixes and UI improvements", // ← Update this
    // ... rest of config
};
```

## Version Numbering Convention

- **Major version** (v2.0.0): Significant feature additions or breaking changes
- **Minor version** (v2.1.0): New features, enhancements, or significant improvements
- **Patch version** (v2.1.1): Bug fixes, small improvements, or security updates

## Adding Release Notes

To document changes in detail, update the `changelog` section:

```javascript
changelog: {
    "v2.1.1": {
        date: "2025-01-30",
        changes: [
            "Fixed audio level indicator bug",
            "Improved error handling in streaming mode",
            "Updated help documentation"
        ]
    },
    // ... previous versions
}
```

## Testing Version Display

1. Open `test-version-display.html` in your browser
2. Verify all version information loads correctly
3. Check that the Help panel in the main application shows updated information

## Files That Display Version Information

- **Main Application**: `index.html` (Help panel)
- **Test Page**: `test-version-display.html`
- **Configuration**: `version-config.js`

## Automatic Updates

The version information is automatically loaded when:
- The main application starts
- The Help panel is opened
- Any page that includes `version-config.js` loads

No manual refresh or cache clearing is required for users to see the updated version information.