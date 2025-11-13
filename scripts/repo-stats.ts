#!/usr/bin/env tsx

import { readdir, readFile, stat } from 'fs/promises';
import { join, extname, relative } from 'path';

interface FileStats {
  totalFiles: number;
  totalLines: number;
  totalSize: number;
  extensions: Record<string, { count: number; lines: number; size: number }>;
}

interface RepoStats {
  project: {
    name: string;
    type: string;
    dependencies: number;
    devDependencies: number;
  };
  files: FileStats;
  components: {
    total: number;
    admin: number;
    app: number;
    pages: number;
    layouts: number;
  };
  api: {
    total: number;
    musicbrainz: number;
    playlists: number;
    songs: number;
  };
  songs: {
    total: number;
    totalSize: number;
  };
  playlists: {
    total: number;
  };
  codeQuality: {
    hasTypeScript: boolean;
    hasESLint: boolean;
    hasTests: boolean;
    testCoverage: string;
  };
}

async function getFileStats(dirPath: string, excludeDirs: string[] = []): Promise<FileStats> {
  const stats: FileStats = {
    totalFiles: 0,
    totalLines: 0,
    totalSize: 0,
    extensions: {}
  };

  async function processDirectory(currentPath: string) {
    try {
      const entries = await readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(currentPath, entry.name);
        const relativePath = relative(dirPath, fullPath);

        // Skip excluded directories
        if (entry.isDirectory() && excludeDirs.some(dir => relativePath.startsWith(dir))) {
          continue;
        }

        if (entry.isDirectory()) {
          await processDirectory(fullPath);
        } else {
          const fileStat = await stat(fullPath);
          const ext = extname(entry.name).toLowerCase() || 'no-extension';

          stats.totalFiles++;
          stats.totalSize += fileStat.size;

          if (!stats.extensions[ext]) {
            stats.extensions[ext] = { count: 0, lines: 0, size: 0 };
          }

          stats.extensions[ext].count++;
          stats.extensions[ext].size += fileStat.size;

          // Count lines for text files
          if (['.vue', '.ts', '.js', '.json', '.md', '.txt', '.yml', '.yaml', '.html', '.css', '.scss'].includes(ext)) {
            try {
              const content = await readFile(fullPath, 'utf-8');
              const lines = content.split('\n').length;
              stats.totalLines += lines;
              stats.extensions[ext].lines += lines;
            } catch (error) {
              // Skip binary files or files that can't be read as text
            }
          }
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not read directory ${currentPath}`);
    }
  }

  await processDirectory(dirPath);
  return stats;
}

async function countFilesInDirectory(dirPath: string, pattern?: RegExp): Promise<number> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    let count = 0;

    for (const entry of entries) {
      if (entry.isFile()) {
        if (!pattern || pattern.test(entry.name)) {
          count++;
        }
      } else if (entry.isDirectory()) {
        count += await countFilesInDirectory(join(dirPath, entry.name), pattern);
      }
    }

    return count;
  } catch {
    return 0;
  }
}

async function getDirectorySize(dirPath: string): Promise<number> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    let totalSize = 0;

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      if (entry.isFile()) {
        const fileStat = await stat(fullPath);
        totalSize += fileStat.size;
      } else if (entry.isDirectory()) {
        totalSize += await getDirectorySize(fullPath);
      }
    }

    return totalSize;
  } catch {
    return 0;
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

async function generateRepoStats(): Promise<RepoStats> {
  const rootPath = process.cwd();

  // Read package.json
  let packageJson: any = {};
  try {
    const packageContent = await readFile(join(rootPath, 'package.json'), 'utf-8');
    packageJson = JSON.parse(packageContent);
  } catch (error) {
    console.warn('Could not read package.json');
  }

  // Get overall file stats (excluding heavy directories)
  const excludeDirs = ['node_modules', '.nuxt', '.output', 'dist', '.git'];
  const files = await getFileStats(rootPath, excludeDirs);

  // Count specific file types
  const vueFiles = await countFilesInDirectory(join(rootPath, 'app'), /\.vue$/);
  const adminComponents = await countFilesInDirectory(join(rootPath, 'app/components'), /^Admin.*\.vue$/);
  const appComponents = await countFilesInDirectory(join(rootPath, 'app/components'), /^App.*\.vue$/);
  const pages = await countFilesInDirectory(join(rootPath, 'app/pages'), /\.vue$/);
  const layouts = await countFilesInDirectory(join(rootPath, 'app/layouts'), /\.vue$/);

  // Count API endpoints
  const apiFiles = await countFilesInDirectory(join(rootPath, 'server/api'), /\.ts$/);
  const musicbrainzApi = await countFilesInDirectory(join(rootPath, 'server/api/musicbrainz'), /\.ts$/);
  const playlistsApi = await countFilesInDirectory(join(rootPath, 'server/api/playlists'), /\.ts$/);
  const songsApi = await countFilesInDirectory(join(rootPath, 'server/api/songs'), /\.ts$/);

  // Count songs and playlists
  const songsCount = await countFilesInDirectory(join(rootPath, 'server/assets/songs'), /\.json$/);
  const songsSize = await getDirectorySize(join(rootPath, 'server/assets/songs'));
  const playlistsCount = await countFilesInDirectory(join(rootPath, 'public/playlist'), /\.json$/);

  // Check for quality indicators
  const hasESLint = files.extensions['.mjs'] > 0 || packageJson.devDependencies?.eslint;
  const hasTests = files.extensions['.test.ts'] > 0 || files.extensions['.spec.ts'] > 0;

  return {
    project: {
      name: packageJson.name || 'Unknown',
      type: packageJson.type || 'commonjs',
      dependencies: Object.keys(packageJson.dependencies || {}).length,
      devDependencies: Object.keys(packageJson.devDependencies || {}).length
    },
    files,
    components: {
      total: vueFiles,
      admin: adminComponents,
      app: appComponents,
      pages,
      layouts
    },
    api: {
      total: apiFiles,
      musicbrainz: musicbrainzApi,
      playlists: playlistsApi,
      songs: songsApi
    },
    songs: {
      total: songsCount,
      totalSize: songsSize
    },
    playlists: {
      total: playlistsCount
    },
    codeQuality: {
      hasTypeScript: files.extensions['.ts'] > 0,
      hasESLint,
      hasTests,
      testCoverage: hasTests ? 'Present' : 'None'
    }
  };
}

function printStats(stats: RepoStats) {
  console.log('🎵 Music Player Deluxe - Repository Statistics\n');
  console.log('═'.repeat(50));

  // Project Overview
  console.log('\n📦 PROJECT OVERVIEW');
  console.log('─'.repeat(30));
  console.log(`Name: ${stats.project.name}`);
  console.log(`Type: ${stats.project.type}`);
  console.log(`Dependencies: ${stats.project.dependencies}`);
  console.log(`Dev Dependencies: ${stats.project.devDependencies}`);

  // File Statistics
  console.log('\n📁 FILE STATISTICS');
  console.log('─'.repeat(30));
  console.log(`Total Files: ${formatNumber(stats.files.totalFiles)}`);
  console.log(`Total Lines: ${formatNumber(stats.files.totalLines)}`);
  console.log(`Total Size: ${formatBytes(stats.files.totalSize)}`);

  console.log('\n📋 BY FILE TYPE:');
  const sortedExtensions = Object.entries(stats.files.extensions)
    .sort(([,a], [,b]) => b.count - a.count)
    .slice(0, 10);

  for (const [ext, data] of sortedExtensions) {
    const percentage = ((data.count / stats.files.totalFiles) * 100).toFixed(1);
    console.log(`  ${ext.padEnd(12)} ${formatNumber(data.count).padStart(6)} files (${percentage}%) - ${formatNumber(data.lines)} lines - ${formatBytes(data.size)}`);
  }

  // Vue Components
  console.log('\n🎨 VUE COMPONENTS');
  console.log('─'.repeat(30));
  console.log(`Total Components: ${stats.components.total}`);
  console.log(`Admin Components: ${stats.components.admin}`);
  console.log(`App Components: ${stats.components.app}`);
  console.log(`Pages: ${stats.components.pages}`);
  console.log(`Layouts: ${stats.components.layouts}`);

  // API Endpoints
  console.log('\n🔌 API ENDPOINTS');
  console.log('─'.repeat(30));
  console.log(`Total Endpoints: ${stats.api.total}`);
  console.log(`MusicBrainz API: ${stats.api.musicbrainz}`);
  console.log(`Playlists API: ${stats.api.playlists}`);
  console.log(`Songs API: ${stats.api.songs}`);

  // Music Data
  console.log('\n🎵 MUSIC DATA');
  console.log('─'.repeat(30));
  console.log(`Total Songs: ${formatNumber(stats.songs.total)}`);
  console.log(`Songs Data Size: ${formatBytes(stats.songs.totalSize)}`);
  console.log(`Total Playlists: ${stats.playlists.total}`);

  // Code Quality
  console.log('\n✅ CODE QUALITY');
  console.log('─'.repeat(30));
  console.log(`TypeScript: ${stats.codeQuality.hasTypeScript ? '✓' : '✗'}`);
  console.log(`ESLint: ${stats.codeQuality.hasESLint ? '✓' : '✗'}`);
  console.log(`Tests: ${stats.codeQuality.hasTests ? '✓' : '✗'}`);
  console.log(`Test Coverage: ${stats.codeQuality.testCoverage}`);

  console.log('\n═'.repeat(50));
  console.log('📊 Report generated on:', new Date().toLocaleString());
}

async function main() {
  try {
    console.log('🔍 Analyzing repository...\n');
    const stats = await generateRepoStats();
    printStats(stats);
  } catch (error) {
    console.error('❌ Error generating statistics:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { generateRepoStats, type RepoStats };
