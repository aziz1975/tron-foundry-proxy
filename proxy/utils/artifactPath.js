const fs = require("fs/promises");
const path = require("path");


function stripSolcArgs(hex) {
    const idx = hex.indexOf("000000000000000"); // solc CBOR marker
    return idx !== -1 ? hex.slice(0, idx) : hex;
}
/**
 * Recursively search for a string in JSON files within a folder
 * @param {string} dir - Folder to start search
 * @param {string} searchString - String to look for
 * @returns {Promise<string[]>} - Array of file paths containing the string
 */
async function findArtifacts(dir, searchString) {
    let results = [];

    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            // Recurse into subfolder
            const subResults = await findArtifacts(fullPath, searchString);
            results.push(...subResults);
        } else if (entry.isFile() && entry.name.endsWith(".json")) {
            try {
                const content = await fs.readFile(fullPath, "utf-8");
                if (content.includes(stripSolcArgs(searchString))) {
                    results.push(fullPath);
                }
            } catch (err) {
                console.error(`Failed to read ${fullPath}:`, err.message);
            }
        }
    }

    return results;
}

module.exports = { findArtifacts };
