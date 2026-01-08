import fs from 'fs';
import path from 'path';
import { marked } from 'marked';
import chokidar from 'chokidar';

const BLOG_POSTS_DIR = './blog-posts';
const BLOG_OUTPUT_DIR = './blog';
const TEMPLATE_FILE = './blog-template.htm';
const COMPANY_DATA_DIR = './company-data';
const COMPANY_OUTPUT_DIR = './company';
const COMPANY_TEMPLATE_FILE = './company-template.htm';
const INDEX_FILE = './index.htm';

// Ensure blog directory exists
if (!fs.existsSync(BLOG_OUTPUT_DIR)) {
  fs.mkdirSync(BLOG_OUTPUT_DIR, { recursive: true });
}

// Ensure company directory exists
if (!fs.existsSync(COMPANY_OUTPUT_DIR)) {
  fs.mkdirSync(COMPANY_OUTPUT_DIR, { recursive: true });
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

// Function to get all companies with metadata
function getAllCompanies() {
  if (!fs.existsSync(COMPANY_DATA_DIR)) {
    return [];
  }

  const mdFiles = fs.readdirSync(COMPANY_DATA_DIR)
    .filter(file => file.endsWith('.md'));

  const companies = mdFiles.map(mdFile => {
    try {
      const mdPath = path.join(COMPANY_DATA_DIR, mdFile);
      const mdContent = fs.readFileSync(mdPath, 'utf8');
      const { metadata, content } = parseMarkdown(mdContent);

      return {
        filename: mdFile,
        slug: mdFile.replace('.md', ''),
        htmlFile: mdFile.replace('.md', '.html'),
        name: metadata.name || 'Untitled Company',
        url: metadata.url || '',
        thumbnail: metadata.thumbnail || '',
        status: metadata.status || 'Idea',
        payments: metadata.payments || 'Not Set Up',
        backend: metadata.backend || 'None',
        frontend: metadata.frontend || 'None',
        businessModel: metadata['business model'] || metadata.businessmodel || 'TBD',
        description: metadata.description || '',
        content: content,
        metadata
      };
    } catch (error) {
      console.error(`Error reading ${mdFile}:`, error.message);
      return null;
    }
  }).filter(company => company !== null);

  // Custom sort order for companies
  const sortOrder = ['brandjson', 'peel-diy', 'staticdam', 'publicpickleballcourts'];
  companies.sort((a, b) => {
    const aIndex = sortOrder.indexOf(a.slug);
    const bIndex = sortOrder.indexOf(b.slug);
    // If not in sortOrder, put at end
    const aOrder = aIndex === -1 ? sortOrder.length : aIndex;
    const bOrder = bIndex === -1 ? sortOrder.length : bIndex;
    return aOrder - bOrder;
  });

  return companies;
}

// Function to build a single company page
function buildCompany(mdFile) {
  const mdPath = path.join(COMPANY_DATA_DIR, mdFile);
  const htmlFile = mdFile.replace('.md', '.html');
  const htmlPath = path.join(COMPANY_OUTPUT_DIR, htmlFile);
  const slug = mdFile.replace('.md', '');

  try {
    console.log(`Building company: ${mdFile}...`);

    // Read markdown file
    const mdContent = fs.readFileSync(mdPath, 'utf8');
    const { metadata, content } = parseMarkdown(mdContent);

    // Convert markdown to HTML
    let htmlContent = marked(content);

    // Add Material Icons to h2 elements
    const iconMap = {
      'the opportunity': 'lightbulb',
      'opportunity': 'lightbulb',
      'the vision': 'visibility',
      'vision': 'visibility',
      'what\'s built': 'construction',
      'whats built': 'construction',
      'what you get': 'inventory',
      'business model': 'payments',
      'revenue': 'attach_money',
      'market opportunity': 'trending_up',
      'market': 'trending_up',
      'path to profitability': 'show_chart',
      'profitability': 'show_chart',
      'go-to-market': 'rocket_launch',
      'expansion': 'expand',
      'current revenue': 'account_balance'
    };

    htmlContent = htmlContent.replace(/<h2>(.*?)<\/h2>/g, (match, heading) => {
      // Decode HTML entities for matching
      const headingLower = heading.toLowerCase().replace(/&#39;/g, "'").replace(/&apos;/g, "'");
      let icon = 'circle'; // default icon

      // Find matching icon
      for (const [key, value] of Object.entries(iconMap)) {
        if (headingLower.includes(key)) {
          icon = value;
          break;
        }
      }

      return `<h2 data-icon="${icon}">${heading}</h2>`;
    });

    // Read template
    const template = fs.readFileSync(COMPANY_TEMPLATE_FILE, 'utf8');

    // Replace placeholders in template
    let finalHtml = template;

    // Extract metadata with defaults
    const name = metadata.name || 'Untitled Company';
    const url = metadata.url || '#';
    const thumbnail = metadata.thumbnail || '/companies/placeholder.png';
    const status = metadata.status || 'Idea';
    const payments = metadata.payments || 'Not Set Up';
    const backend = metadata.backend || 'None';
    const frontend = metadata.frontend || 'None';
    const businessModel = metadata['business model'] || metadata.businessmodel || 'TBD';
    const description = metadata.description || name;

    // Replace all instances of Company Name
    finalHtml = finalHtml.replace(/Company Name/g, name);

    // Replace Company Slug
    finalHtml = finalHtml.replace(/Company Slug/g, slug);

    // Replace Company Description
    finalHtml = finalHtml.replace(/Company Description/g, description);

    // Replace Company Thumbnail
    finalHtml = finalHtml.replace(/Company Thumbnail/g, thumbnail);

    // Replace Company Slide 1 (second carousel image)
    const slideSlug = slug === 'peel-diy' ? 'peel' : slug;
    const slide1Path = `/companies/slide-${slideSlug}-1.png`;
    finalHtml = finalHtml.replace(/Company Slide 1/g, slide1Path);

    // Replace Company URL
    finalHtml = finalHtml.replace(/Company URL/g, url);

    // Replace Company Domain Link (extract domain from URL and make it a link)
    const domainMatch = url.match(/https?:\/\/([^\/]+)/);
    const domain = domainMatch ? domainMatch[1] : url;
    const domainLink = `<a href="${url}" target="_blank">${domain}</a>`;
    finalHtml = finalHtml.replace(/Company Domain Link/g, domainLink);

    // Replace Company Status (add red dot if Live)
    const statusDisplay = status === 'Live'
      ? '<span style="display:inline-block;width:8px;height:8px;background:#dc2626;border-radius:50%;margin-right:6px;"></span>Live'
      : status;
    finalHtml = finalHtml.replace(/Company Status/g, statusDisplay);

    // Replace Company Payments
    finalHtml = finalHtml.replace(/Company Payments/g, payments);

    // Replace Company Backend
    finalHtml = finalHtml.replace(/Company Backend/g, backend);

    // Replace Company Business Model
    finalHtml = finalHtml.replace(/Company Business Model/g, businessModel);

    // Replace Company Price
    const price = metadata.price || '$7,500';
    finalHtml = finalHtml.replace(/Company Price/g, price);

    // Replace Company Tile Name (for view transitions)
    const tileName = `tile-${slug}`;
    finalHtml = finalHtml.replace(/Company Tile Name/g, tileName);

    // Replace Company Content
    finalHtml = finalHtml.replace(/Company Content/g, htmlContent);

    // Replace slug in URL and contact subjects
    finalHtml = finalHtml.replace(/company\/company-slug/g, `company/${slug}`);
    finalHtml = finalHtml.replace(/subject=Buy%20Company%20Slug/g, `subject=Buy%20${encodeURIComponent(name)}`);
    finalHtml = finalHtml.replace(/subject=CMO%20Company%20Slug/g, `subject=CMO%20${encodeURIComponent(name)}`);

    // Write HTML file
    fs.writeFileSync(htmlPath, finalHtml);
    console.log(`✅ Built company page: ${htmlFile}`);

  } catch (error) {
    console.error(`❌ Error building company ${mdFile}:`, error.message);
  }
}

// Function to build all companies
function buildAllCompanies() {
  console.log('🏢 Building all company pages...');

  if (!fs.existsSync(COMPANY_DATA_DIR)) {
    console.log('📁 No company-data directory found');
    return;
  }

  const mdFiles = fs.readdirSync(COMPANY_DATA_DIR)
    .filter(file => file.endsWith('.md'));

  if (mdFiles.length === 0) {
    console.log('📝 No company markdown files found');
    return;
  }

  mdFiles.forEach(buildCompany);
  console.log(`✨ Built ${mdFiles.length} company page(s)`);

  // Update index.htm with the company list
  updateIndexWithCompanies();
}

// Function to update index.htm with company list
function updateIndexWithCompanies() {
  try {
    console.log('🔄 Updating index.htm with company list...');

    const companies = getAllCompanies();
    if (companies.length === 0) {
      console.log('📝 No companies found, skipping company update');
      return;
    }

    // Read current index.htm
    const indexContent = fs.readFileSync(INDEX_FILE, 'utf8');

    // Generate company grid HTML
    const companyGridHTML = companies.map(company => {
      return `            <div class="company">
                <a href="/company/${company.slug}.html">
                    <img class="aspect-video object-cover rounded-lg" src="${company.thumbnail}" alt="${company.name}" style="view-transition-name: tile-${company.slug}">
                </a>
            </div>`;
    }).join('\n');

    // Add Apply tile at the end
    const applyTile = `            <div class="company">
                <a href="/contact" class="aspect-video rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-colors flex items-center justify-center text-red-600 font-bold text-xl" style="font-family: 'Google Sans Flex', sans-serif;">
                    Apply
                </a>
            </div>`;
    const companyGridWithApply = companyGridHTML + '\n' + applyTile;

    // Replace the companies section
    const updatedContent = indexContent.replace(
      /(<div class="companies grid grid-cols-2 md:grid-cols-3 gap-8">)[\s\S]*?(<\/div>\s*<\/div>)/,
      `$1\n${companyGridWithApply}\n        $2`
    );

    // Write updated index.htm
    fs.writeFileSync(INDEX_FILE, updatedContent);
    console.log(`✅ Updated index.htm with ${companies.length} companie(s)`);

  } catch (error) {
    console.error('❌ Error updating index.htm with companies:', error.message);
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

// Function to build everything
function buildAll() {
  buildAllPosts();
  buildAllCompanies();
}

// Main execution
const isWatchMode = process.argv.includes('--watch');

if (isWatchMode) {
  console.log('👀 Watching for changes...');

  // Initial build
  buildAll();

  // Watch for changes
  const watcher = chokidar.watch([BLOG_POSTS_DIR, TEMPLATE_FILE, COMPANY_DATA_DIR, COMPANY_TEMPLATE_FILE], {
    ignored: /^\./,
    persistent: true
  });

  watcher.on('change', (filePath) => {
    console.log(`📝 File changed: ${filePath}`);

    if (filePath === TEMPLATE_FILE) {
      console.log('🔄 Blog template changed, rebuilding all posts...');
      buildAllPosts();
    } else if (filePath === COMPANY_TEMPLATE_FILE) {
      console.log('🔄 Company template changed, rebuilding all companies...');
      buildAllCompanies();
    } else if (filePath.endsWith('.md')) {
      const mdFile = path.basename(filePath);
      if (filePath.includes(BLOG_POSTS_DIR)) {
        buildPost(mdFile);
        updateIndex();
      } else if (filePath.includes(COMPANY_DATA_DIR)) {
        buildCompany(mdFile);
        updateIndexWithCompanies();
      }
    }
  });

  watcher.on('add', (filePath) => {
    if (filePath.endsWith('.md')) {
      console.log(`➕ New markdown file: ${filePath}`);
      const mdFile = path.basename(filePath);
      if (filePath.includes(BLOG_POSTS_DIR)) {
        buildPost(mdFile);
        updateIndex();
      } else if (filePath.includes(COMPANY_DATA_DIR)) {
        buildCompany(mdFile);
        updateIndexWithCompanies();
      }
    }
  });

  console.log('Press Ctrl+C to stop watching');

} else {
  // One-time build
  buildAll();
}
