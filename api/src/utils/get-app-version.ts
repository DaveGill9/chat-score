import * as fs from 'fs';
import * as path from 'path';

export const getAppVersion = (): string => {
  const findPackageJson = (currentDir: string): string | null => {
    // Check if package.json exists in current directory
    const packageJsonPath = path.join(currentDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      return packageJsonPath;
    }
    
    // Get parent directory
    const parentDir = path.dirname(currentDir);
    
    // Stop if we've reached the root directory
    if (parentDir === currentDir) {
      return null;
    }
    
    // Recursively search parent directory
    return findPackageJson(parentDir);
  };

  // Start search from current file's directory
  const currentDir = __dirname;
  const packageJsonPath = findPackageJson(currentDir);
  
  if (!packageJsonPath) {
    throw new Error('Could not find package.json in any parent directory');
  }

  try {
    const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonContent);
    return packageJson.version || 'unknown';
  } catch (error) {
    throw new Error(`Failed to read or parse package.json: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};