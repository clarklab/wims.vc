import fs from 'fs';
import path from 'path';
import { marked } from 'marked';
import chokidar from 'chokidar';

const BLOG_POSTS_DIR = './blog-posts';
const BLOG_OUTPUT_DIR = './blog';
const TEMPLATE_FILE = './blog-template.htm';
const INDEX_FILE = './index.htm';

// Ensure blog directory exists
if (!fs.existsSync(BLOG_OUTPUT_DIR)) {
  fs.mkdirSync(BLOG_OUTPUT_DIR, { recursive: true });
}

// Function to parse markdown front matter and content
function parseMarkdown(content) {
  const lines = content.split('\n');
  const metadata = {};
  let contentStart = 0;
  
  // Parse simple front matter (Title:, Author:, Posted:)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.includes(':') && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split(':');
      const value = valueParts.join(':').trim();
      metadata[key.toLowerCase().trim()] = value;
    } else if (line === '' && Object.keys(metadata).length > 0) {
      contentStart = i + 1;
      break;
    } else if (line.startsWith('#') || (line.length > 0 && Object.keys(metadata).length === 0)) {
      break;
    }
  }
  
  const markdownContent = lines.slice(contentStart).join('\n');
  return { metadata, content: markdownContent };
}

// Function to parse date string and return Date object
function parseDate(dateString) {
  // Handle format like "Fri, Aug 14, 2025"
  try {
    return new Date(dateString);
  } catch (e) {
    return new Date(); // fallback to current date
  }
}

// Function to get all blog posts with metadata
function getAllBlogPosts() {
  if (!fs.existsSync(BLOG_POSTS_DIR)) {
    return [];
  }
  
  const mdFiles = fs.readdirSync(BLOG_POSTS_DIR)
    .filter(file => file.endsWith('.md'));
  
  const posts = mdFiles.map(mdFile => {
    try {
      const mdPath = path.join(BLOG_POSTS_DIR, mdFile);
      const mdContent = fs.readFileSync(mdPath, 'utf8');
      const { metadata } = parseMarkdown(mdContent);
      
      return {
        filename: mdFile,
        htmlFile: mdFile.replace('.md', '.html'),
        title: metadata.title || 'Untitled Post',
        author: metadata.author || 'Unknown Author',
        posted: metadata.posted || 'Unknown Date',
        date: parseDate(metadata.posted || ''),
        metadata
      };
    } catch (error) {
      console.error(`Error reading ${mdFile}:`, error.message);
      return null;
    }
  }).filter(post => post !== null);
  
  // Sort by date, newest first
  posts.sort((a, b) => b.date - a.date);
  
  return posts;
}

// Function to update index.htm with blog post list
function updateIndex() {
  try {
    console.log('🔄 Updating index.htm with blog post list...');
    
    const posts = getAllBlogPosts();
    if (posts.length === 0) {
      console.log('📝 No blog posts found, skipping index update');
      return;
    }
    
    // Read current index.htm
    const indexContent = fs.readFileSync(INDEX_FILE, 'utf8');
    
    // Generate blog post list HTML with rotating colors
    const colors = ['red-500', 'blue-500', 'amber-500', 'green-500'];
    const blogListHTML = posts.map((post, index) => {
      const color = colors[index % colors.length];
      return `            <li>
                <a href="/blog/${post.htmlFile}" class="underline decoration-4 decoration-${color}">${post.title}</a>
                <span class="text-sm opacity-70"> · ${post.posted}</span>
            </li>`;
    }).join('\n');
    
    // Replace the blog posts section
    const updatedContent = indexContent.replace(
      /(<ul class="flex flex-col gap-2 w-full">)[\s\S]*?(<\/ul>)/,
      `$1\n${blogListHTML}\n        $2`
    );
    
    // Write updated index.htm
    fs.writeFileSync(INDEX_FILE, updatedContent);
    console.log(`✅ Updated index.htm with ${posts.length} blog post(s)`);
    
  } catch (error) {
    console.error('❌ Error updating index.htm:', error.message);
  }
}

// Function to build a single blog post
function buildPost(mdFile) {
  const mdPath = path.join(BLOG_POSTS_DIR, mdFile);
  const htmlFile = mdFile.replace('.md', '.html');
  const htmlPath = path.join(BLOG_OUTPUT_DIR, htmlFile);
  
  try {
    console.log(`Building ${mdFile}...`);
    
    // Read markdown file
    const mdContent = fs.readFileSync(mdPath, 'utf8');
    const { metadata, content } = parseMarkdown(mdContent);
    
    // Convert markdown to HTML
    const htmlContent = marked(content);
    
    // Read template
    const template = fs.readFileSync(TEMPLATE_FILE, 'utf8');
    
    // Replace placeholders in template
    let finalHtml = template;
    
    // Replace title
    const title = metadata.title || 'Untitled Post';
    finalHtml = finalHtml.replace('Post Title Goes Here', title);
    
    // Replace author (find the link text specifically)
    const author = metadata.author || 'Unknown Author';
    finalHtml = finalHtml.replace(/(<a href="https:\/\/x\.com\/wimbet" class="author">)[^<]*(<\/a>)/, `$1${author}$2`);
    
    // Replace date (find the span with class date)
    const date = metadata.posted || 'Unknown Date';
    finalHtml = finalHtml.replace(/(<span class="date">)[^<]*(<\/span>)/, `$1${date}$2`);
    
    // Replace post body
    finalHtml = finalHtml.replace(/(<div class="post-body">)[\s\S]*?(<\/div>)/, `$1\n${htmlContent}\n    $2`);
    
    // Add blog post list to template
    const allPosts = getAllBlogPosts();
    const colors = ['red-500', 'blue-500', 'amber-500', 'green-500'];
    const blogListHTML = allPosts.map((post, index) => {
      const color = colors[index % colors.length];
      return `            <li>
                <a href="/blog/${post.htmlFile}" class="underline decoration-4 decoration-${color}">${post.title}</a>
                <span class="text-sm opacity-70"> · ${post.posted}</span>
            </li>`;
    }).join('\n');
    
    const blogSection = `    <div class="blog-posts w-full">
        <h2 class="font-bold w-full">More from the Blog</h2>
        <ul class="flex flex-col gap-2 w-full">
${blogListHTML}
        </ul>
    </div>`;
    
    // Replace the blog post list placeholder
    finalHtml = finalHtml.replace('    <!-- Blog post list here -->', blogSection);
    
    // Update meta tags for this specific post
    finalHtml = finalHtml.replace(
      /<meta property="og:title" content="[^"]*">/,
      `<meta property="og:title" content="${title} - wims.vc">`
    );
    
    // Write HTML file
    fs.writeFileSync(htmlPath, finalHtml);
    console.log(`✅ Built ${htmlFile}`);
    
  } catch (error) {
    console.error(`❌ Error building ${mdFile}:`, error.message);
  }
}

// Function to build all posts
function buildAllPosts() {
  console.log('🔨 Building all blog posts...');
  
  if (!fs.existsSync(BLOG_POSTS_DIR)) {
    console.log('📁 No blog-posts directory found');
    return;
  }
  
  const mdFiles = fs.readdirSync(BLOG_POSTS_DIR)
    .filter(file => file.endsWith('.md'));
  
  if (mdFiles.length === 0) {
    console.log('📝 No markdown files found in blog-posts directory');
    return;
  }
  
  mdFiles.forEach(buildPost);
  console.log(`✨ Built ${mdFiles.length} blog post(s)`);
  
  // Update index.htm with the blog post list
  updateIndex();
}

// Main execution
const isWatchMode = process.argv.includes('--watch');

if (isWatchMode) {
  console.log('👀 Watching for changes...');
  
  // Initial build
  buildAllPosts();
  
  // Watch for changes
  const watcher = chokidar.watch([BLOG_POSTS_DIR, TEMPLATE_FILE], {
    ignored: /^\./, 
    persistent: true
  });
  
  watcher.on('change', (filePath) => {
    console.log(`📝 File changed: ${filePath}`);
    
    if (filePath === TEMPLATE_FILE) {
      console.log('🔄 Template changed, rebuilding all posts...');
      buildAllPosts();
    } else if (filePath.endsWith('.md')) {
      const mdFile = path.basename(filePath);
      buildPost(mdFile);
      // Update index since a post changed (could affect title, date, etc.)
      updateIndex();
    }
  });
  
  watcher.on('add', (filePath) => {
    if (filePath.endsWith('.md')) {
      console.log(`➕ New markdown file: ${filePath}`);
      const mdFile = path.basename(filePath);
      buildPost(mdFile);
      // Update index since we added a new post
      updateIndex();
    }
  });
  
  console.log('Press Ctrl+C to stop watching');
  
} else {
  // One-time build
  buildAllPosts();
}
