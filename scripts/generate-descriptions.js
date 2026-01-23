#!/usr/bin/env node

/**
 * Generate project descriptions using Grok AI
 * Run: GROK_API_KEY=your_key node scripts/generate-descriptions.js
 *
 * This saves descriptions to data/descriptions.json
 * Commit the file to persist descriptions permanently
 */

const fs = require('fs');
const path = require('path');

const GITHUB_USERNAME = 'Nivetha200111';
const DESCRIPTIONS_FILE = path.join(__dirname, '../data/descriptions.json');

const EXCLUDED_REPOS = ['.github', 'portfolio'];

function normalizeRepoName(name) {
    return name.toLowerCase().split(/[-_]/)[0];
}

function deduplicateRepos(repos) {
    const groups = {};
    for (const repo of repos) {
        const normalizedName = normalizeRepoName(repo.name);
        if (!groups[normalizedName]) {
            groups[normalizedName] = repo;
        } else {
            const existing = groups[normalizedName];
            if (new Date(repo.pushed_at) > new Date(existing.pushed_at)) {
                groups[normalizedName] = repo;
            }
        }
    }
    return Object.values(groups);
}

async function fetchGitHubRepos() {
    const response = await fetch(
        `https://api.github.com/users/${GITHUB_USERNAME}/repos?per_page=100&sort=pushed&direction=desc`,
        {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Portfolio-Refresh'
            }
        }
    );

    if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
    }

    const repos = await response.json();
    return repos.filter(repo =>
        !repo.fork &&
        !EXCLUDED_REPOS.includes(repo.name) &&
        repo.size > 0
    );
}

async function fetchReadme(repoName) {
    try {
        const response = await fetch(
            `https://api.github.com/repos/${GITHUB_USERNAME}/${repoName}/readme`,
            {
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Portfolio-Refresh'
                }
            }
        );

        if (!response.ok) return null;

        const data = await response.json();
        return Buffer.from(data.content, 'base64').toString('utf-8');
    } catch (error) {
        return null;
    }
}

async function generateDescriptionWithGrok(repoName, readmeContent, existingDescription) {
    const grokApiKey = process.env.GROK_API_KEY;

    if (!grokApiKey) {
        console.error('ERROR: GROK_API_KEY environment variable not set');
        process.exit(1);
    }

    if (!readmeContent && !existingDescription) {
        return null;
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
            console.error(`Grok API error for ${repoName}:`, response.status, errorText);
            return null;
        }

        const data = await response.json();
        return data.choices[0]?.message?.content?.trim() || null;
    } catch (error) {
        console.error(`Grok API call failed for ${repoName}:`, error.message);
        return null;
    }
}

async function main() {
    console.log('Fetching GitHub repos...');
    const allRepos = await fetchGitHubRepos();
    const repos = deduplicateRepos(allRepos);
    console.log(`Found ${repos.length} unique repos (from ${allRepos.length} total)`);

    // Load existing descriptions
    let existingData = { descriptions: {}, lastUpdated: null };
    try {
        existingData = JSON.parse(fs.readFileSync(DESCRIPTIONS_FILE, 'utf-8'));
    } catch (e) {
        console.log('No existing descriptions file, creating new one');
    }

    const descriptions = { ...existingData.descriptions };
    let generated = 0;
    let skipped = 0;

    for (const repo of repos) {
        // Skip if we already have a description for this repo
        if (descriptions[repo.name]) {
            console.log(`✓ ${repo.name} - using cached description`);
            skipped++;
            continue;
        }

        console.log(`Generating description for ${repo.name}...`);
        const readme = await fetchReadme(repo.name);
        const description = await generateDescriptionWithGrok(repo.name, readme, repo.description);

        if (description) {
            descriptions[repo.name] = description;
            console.log(`✓ ${repo.name} - generated`);
            generated++;
        } else {
            console.log(`✗ ${repo.name} - failed to generate`);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Save descriptions
    const output = {
        descriptions,
        lastUpdated: new Date().toISOString(),
        repoCount: Object.keys(descriptions).length
    };

    fs.writeFileSync(DESCRIPTIONS_FILE, JSON.stringify(output, null, 2));

    console.log('\n--- Summary ---');
    console.log(`Generated: ${generated}`);
    console.log(`Skipped (cached): ${skipped}`);
    console.log(`Total descriptions: ${Object.keys(descriptions).length}`);
    console.log(`\nSaved to: ${DESCRIPTIONS_FILE}`);
    console.log('Remember to commit this file to persist the descriptions!');
}

main().catch(console.error);
