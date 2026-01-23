// Vercel Serverless Function to refresh projects from GitHub and generate descriptions with Grok AI

const GITHUB_USERNAME = 'Nivetha200111';

// Repos to exclude (forks, configs, etc.)
const EXCLUDED_REPOS = [
    '.github',
    'portfolio'  // Don't include the portfolio itself
];

// Normalize repo name for deduplication
function normalizeRepoName(name) {
    // Get the base name (first segment before any separator)
    const baseName = name
        .toLowerCase()
        .split(/[-_]/)[0];  // Split by - or _ and take first part

    return baseName;
}

// Deduplicate repos with similar names, keeping the most recently pushed
function deduplicateRepos(repos) {
    const groups = {};

    for (const repo of repos) {
        const normalizedName = normalizeRepoName(repo.name);

        if (!groups[normalizedName]) {
            groups[normalizedName] = repo;
        } else {
            // Keep the one that was pushed more recently
            const existing = groups[normalizedName];
            if (new Date(repo.pushed_at) > new Date(existing.pushed_at)) {
                groups[normalizedName] = repo;
            }
        }
    }

    return Object.values(groups);
}

async function fetchGitHubRepos() {
    const response = await fetch(`https://api.github.com/users/${GITHUB_USERNAME}/repos?per_page=100&sort=pushed&direction=desc`, {
        headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Portfolio-Refresh'
        }
    });

    if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
    }

    const repos = await response.json();

    // Filter out forks, excluded repos, and empty repos
    return repos.filter(repo =>
        !repo.fork &&
        !EXCLUDED_REPOS.includes(repo.name) &&
        repo.size > 0
    );
}

async function fetchReadme(repoName) {
    try {
        const response = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${repoName}/readme`, {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Portfolio-Refresh'
            }
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        // README content is base64 encoded
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        return content;
    } catch (error) {
        console.error(`Failed to fetch README for ${repoName}:`, error);
        return null;
    }
}

function extractLiveUrl(readmeContent, repoHomepage) {
    // First check if repo has a homepage set
    if (repoHomepage && repoHomepage.trim()) {
        return repoHomepage;
    }

    if (!readmeContent) return null;

    // Look for Vercel URLs in README
    const vercelPatterns = [
        /https?:\/\/[a-zA-Z0-9-]+\.vercel\.app\b/gi,
        /https?:\/\/[a-zA-Z0-9-]+\.netlify\.app\b/gi,
        /https?:\/\/[a-zA-Z0-9-]+\.herokuapp\.com\b/gi,
        /https?:\/\/[a-zA-Z0-9-]+\.github\.io\b/gi,
    ];

    for (const pattern of vercelPatterns) {
        const matches = readmeContent.match(pattern);
        if (matches && matches.length > 0) {
            return matches[0];
        }
    }

    // Look for "Live Demo" or "Demo" links in markdown format
    const demoLinkPattern = /\[(?:live\s*demo|demo|live|website|app|try it)\]\((https?:\/\/[^\)]+)\)/gi;
    const demoMatch = demoLinkPattern.exec(readmeContent);
    if (demoMatch) {
        return demoMatch[1];
    }

    return null;
}

async function generateDescriptionWithGrok(repoName, readmeContent, existingDescription) {
    const grokApiKey = process.env.GROK_API_KEY;

    // If no README and no existing description, return a basic one
    if (!readmeContent && !existingDescription) {
        return `${repoName} - View repository for details.`;
    }

    // If no API key, use existing description or extract from README
    if (!grokApiKey) {
        console.warn('GROK_API_KEY not set');

        // Try to get meaningful description from README first
        if (readmeContent) {
            // Remove badges, images, and links at the start
            const cleanedContent = readmeContent
                .replace(/^\s*(\[!\[.*?\]\(.*?\)\]\(.*?\)|\!\[.*?\]\(.*?\)|\[.*?\]\(.*?\))\s*/gm, '')
                .replace(/^#+\s+.+$/gm, '') // Remove headers
                .trim();

            const lines = cleanedContent.split('\n').filter(line => {
                const trimmed = line.trim();
                return trimmed &&
                    !trimmed.startsWith('!') &&
                    !trimmed.startsWith('[') &&
                    !trimmed.startsWith('```') &&
                    !trimmed.startsWith('|') &&
                    !trimmed.startsWith('-') &&
                    !trimmed.startsWith('*') &&
                    !trimmed.startsWith('>') &&
                    trimmed.length > 30;
            });

            if (lines.length > 0) {
                // Get first meaningful paragraph
                let desc = lines[0].trim();
                // Clean up any remaining markdown
                desc = desc.replace(/\*\*/g, '').replace(/`/g, '').replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
                if (desc.length > 200) {
                    desc = desc.substring(0, 197) + '...';
                }
                return desc;
            }
        }

        // Fall back to GitHub repo description
        if (existingDescription) return existingDescription;

        return `${repoName} - View repository for details.`;
    }

    const prompt = `Based on this README content, write a concise 1-2 sentence project description for a portfolio website.
Focus on what the project does and its key features. Keep it professional and engaging.
Do not include any markdown formatting, just plain text.
Do not start with "This project" - be more creative.

README Content:
${readmeContent?.substring(0, 3000) || existingDescription || 'No description available'}

Project name: ${repoName}`;

    try {
        const response = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${grokApiKey}`
            },
            body: JSON.stringify({
                model: 'grok-4-latest',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a technical writer creating concise project descriptions for a developer portfolio. Write in third person, be specific about what the project does. Keep it under 2 sentences.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                stream: false,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Grok API error:', response.status, errorText);
            // Fallback to existing description
            return existingDescription || `${repoName} - View repository for details.`;
        }

        const data = await response.json();
        const generatedDescription = data.choices[0]?.message?.content?.trim();

        if (generatedDescription && generatedDescription.length > 10) {
            return generatedDescription;
        }

        return existingDescription || `${repoName} - View repository for details.`;
    } catch (error) {
        console.error('Grok API call failed:', error.message);
        return existingDescription || `${repoName} - View repository for details.`;
    }
}

function inferStack(repo, readmeContent) {
    const stack = new Set();
    const language = repo.language;

    // Add primary language
    if (language) {
        stack.add(language);
    }

    // Common patterns to detect in README
    const patterns = {
        'React': /\breact\b/i,
        'Next.js': /\bnext\.?js\b/i,
        'Node.js': /\bnode\.?js\b/i,
        'Express': /\bexpress\b/i,
        'Flask': /\bflask\b/i,
        'Django': /\bdjango\b/i,
        'PostgreSQL': /\bpostgres(?:ql)?\b/i,
        'MongoDB': /\bmongo(?:db)?\b/i,
        'MySQL': /\bmysql\b/i,
        'SQL': /\bsql\b/i,
        'Tailwind': /\btailwind\b/i,
        'OpenAI API': /\bopenai\b/i,
        'Vercel': /\bvercel\b/i,
        'Docker': /\bdocker\b/i,
        'AWS': /\baws\b/i,
        'Firebase': /\bfirebase\b/i,
    };

    const content = readmeContent || '';
    for (const [tech, pattern] of Object.entries(patterns)) {
        if (pattern.test(content)) {
            stack.add(tech);
        }
    }

    // Always add Git and Vercel (since all projects are on Vercel)
    stack.add('Git');
    stack.add('Vercel');

    return Array.from(stack);
}

function inferTags(repo, readmeContent) {
    const tags = [];
    const content = (readmeContent || '').toLowerCase();
    const name = repo.name.toLowerCase();

    if (content.includes('ai') || content.includes('machine learning') || content.includes('openai')) {
        tags.push('AI');
    }
    if (content.includes('automation') || content.includes('automat')) {
        tags.push('Automation');
    }
    if (content.includes('saas') || content.includes('service')) {
        tags.push('SaaS');
    }
    if (content.includes('productivity') || content.includes('study') || content.includes('discipline')) {
        tags.push('Productivity');
    }
    if (content.includes('education') || content.includes('student') || content.includes('learn')) {
        tags.push('Education');
    }
    if (tags.length === 0) {
        tags.push('Web');
    }

    return tags.slice(0, 2);
}

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get cached descriptions from request body (if POST)
    let cachedDescriptions = {};
    if (req.method === 'POST' && req.body?.cachedDescriptions) {
        cachedDescriptions = req.body.cachedDescriptions;
    }

    try {
        // Fetch repos from GitHub
        const allRepos = await fetchGitHubRepos();

        // Remove duplicates (e.g., "dwight" and "dwight_vercel")
        const repos = deduplicateRepos(allRepos);

        // Process each repo
        const projects = await Promise.all(repos.map(async (repo) => {
            const readmeContent = await fetchReadme(repo.name);

            // Use cached description if available, otherwise generate new one
            let description;
            if (cachedDescriptions[repo.name]) {
                description = cachedDescriptions[repo.name];
            } else {
                description = await generateDescriptionWithGrok(repo.name, readmeContent, repo.description);
            }

            const stack = inferStack(repo, readmeContent);
            const tags = inferTags(repo, readmeContent);

            // Extract live URL from README or repo homepage
            const liveUrl = extractLiveUrl(readmeContent, repo.homepage);

            return {
                name: repo.name,
                repoUrl: repo.html_url,
                liveUrl: liveUrl,  // Will be null if not found
                description: description,
                language: repo.language || 'JavaScript',
                stack: stack,
                tags: tags,
                updatedAt: repo.updated_at,
                pushedAt: repo.pushed_at,
                stars: repo.stargazers_count,
                descriptionCached: !!cachedDescriptions[repo.name]
            };
        }));

        // Sort by most recently updated
        projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        // Mark first 5 as featured
        const projectsWithFeatured = projects.map((project, index) => ({
            ...project,
            featured: index < 5
        }));

        return res.status(200).json({
            success: true,
            projects: projectsWithFeatured,
            featuredNames: projectsWithFeatured.filter(p => p.featured).map(p => p.name),
            refreshedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('Refresh projects error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}
