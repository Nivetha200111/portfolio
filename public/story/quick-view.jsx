const BotanicalIllustration = ({ className = '' }) => <svg className={className} viewBox="0 0 240 260" fill="none" aria-hidden="true">
    <path d="M116 238C117 175 126 123 163 54M120 183C82 151 63 115 58 78M133 135C164 128 185 109 197 83" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    <path d="M144 97C123 68 134 43 173 28C182 62 171 85 144 97ZM110 157C69 163 45 139 37 105C76 104 103 120 110 157ZM128 162C151 139 176 139 205 155C180 186 153 188 128 162ZM81 121C48 105 40 81 48 48C79 63 92 90 81 121ZM159 123C164 91 183 77 220 78C209 110 190 124 159 123Z" fill="currentColor" opacity=".24" />
    <path d="M166 76C171 62 175 48 174 35M96 145C77 134 59 122 45 112M147 163C169 165 181 162 195 158" stroke="currentColor" strokeWidth="1.5" opacity=".5" />
    <circle cx="124" cy="102" r="6" fill="#be795c" /><circle cx="132" cy="86" r="5" fill="#be795c" />
    <path d="M89 233H150L143 254H95Z" fill="#bd9473" /><path d="M84 228H155V236H84Z" fill="#d8b392" />
</svg>;

const ProjectDiagram = ({ kind }) => {
    const blocks = kind === 'evacuation' ? ['Sensor fusion', 'Predict spread', 'Safer routes'] : kind === 'planner' ? ['Study plan', 'Practice & recall', 'Track progress'] : ['Master résumé', 'Role context', 'Tailored output'];
    return <svg viewBox="0 0 620 230" role="img" aria-label={blocks.join(' → ')}>
        <rect x="14" y="12" width="592" height="206" rx="12" fill="#f8f2e4" stroke="#b8c5a7" />
        <path d="M14 50H606" stroke="#c5cdb7" /><circle cx="35" cy="32" r="4" fill="#c3977b" /><circle cx="50" cy="32" r="4" fill="#c9b984" /><circle cx="65" cy="32" r="4" fill="#92a482" />
        <text x="585" y="36" textAnchor="end" fill="#688064" fontSize="11" fontFamily="sans-serif">a look under the hood</text>
        {blocks.map((label, index) => <g key={label}>
            <rect x={42 + index * 190} y="86" width="156" height="78" rx="8" fill={index === 2 ? '#526e52' : '#e4ead8'} stroke="#b8c5a7" />
            <text x={120 + index * 190} y="116" textAnchor="middle" fill={index === 2 ? '#fff4dd' : '#536a4e'} fontSize="11" fontFamily="sans-serif">0{index + 1}</text>
            <text x={120 + index * 190} y="141" textAnchor="middle" fill={index === 2 ? '#fff4dd' : '#344d37'} fontSize="14" fontFamily="sans-serif">{label}</text>
            {index < 2 && <path d={`M${202 + index * 190} 125h25m-6-5 6 5-6 5`} stroke="#7e9270" fill="none" strokeWidth="1.5" />}
        </g>)}
        <path d="M45 190H236" stroke="#d1d7c3" /><text x="578" y="195" textAnchor="end" fill="#7d8c73" fontSize="10" fontFamily="sans-serif">architecture sketch</text>
    </svg>;
};

const QuickView = ({ profile, projects, experience, skills, certifications, achievements, onExplore }) => {
    const featured = projects.filter(project => project.engineering);
    const other = projects.filter(project => !project.engineering);
    const skillGroups = [
        ['Languages & data', ['Python', 'Java', 'COBOL', 'JCL', 'JavaScript', 'TypeScript', 'SQL', 'DB2', 'IMS', 'MySQL', 'PostgreSQL', 'Cassandra', 'Pandas']],
        ['Interfaces & applications', ['React', 'Flutter', 'Flask', 'Angular', 'Node.js', 'Next.js', 'Figma']],
        ['AI, cloud & tools', skills.filter(skill => !['Python', 'Java', 'COBOL', 'JCL', 'JavaScript', 'TypeScript', 'SQL', 'DB2', 'IMS', 'MySQL', 'PostgreSQL', 'Cassandra', 'Pandas', 'React', 'Flutter', 'Flask', 'Angular', 'Node.js', 'Next.js', 'Figma'].includes(skill))]
    ];
    React.useEffect(() => {
        const frame = requestAnimationFrame(() => {
            const destination = document.getElementById(location.hash.slice(1));
            if (destination) destination.scrollIntoView({ behavior: 'instant' }); else window.scrollTo({ top: 0, behavior: 'instant' });
        });
        return () => cancelAnimationFrame(frame);
    }, []);
    const visit = (event, project) => { event.preventDefault(); onExplore({ project: project.name, hash: 'projects' }); };
    return <div className="quick-view">
        <a className="quick-skip" href="#quick-content">Skip to content</a>
        <header className="quick-masthead"><a className="quick-wordmark" href="#top" aria-label={`${profile.name} — back to top`}><span>ns.</span><i aria-hidden="true">✳</i></a><span className="quick-masthead-note">A little curiosity. A lot of possibility.</span></header>
        <main id="quick-content">
            <section className="quick-hero quick-wrap" id="top" aria-labelledby="quick-title">
                <div className="quick-hero-copy"><p className="quick-eyebrow"><span className="quick-seed" /> Software, systems & small discoveries</p><h1 id="quick-title">Nivetha<br /><em>Sivakumar.</em></h1><p className="quick-role">{profile.role}</p><p className="quick-intro">{profile.introduction}</p><div className="quick-actions"><a className="quick-button" href={profile.resume} target="_blank" rel="noopener noreferrer">Read my résumé <span>↗</span></a><a className="quick-text-link" href={profile.github} target="_blank" rel="noopener noreferrer">GitHub ↗</a><a className="quick-text-link" href="#contact">Let’s talk ↗</a></div></div>
                <div className="quick-portrait-scene"><div className="quick-portrait-frame"><img src={profile.photo} alt={profile.name} width="440" height="550" fetchPriority="high" /><span className="quick-portrait-caption">The person behind the little world.</span></div><BotanicalIllustration className="quick-hero-botanical" /><span className="quick-handwritten">always growing</span><span className="quick-spark" aria-hidden="true">✧</span></div>
            </section>
            <div className="quick-index quick-wrap"><p>For a quick introduction.</p><nav aria-label="Quick View sections">{[['projects', 'Work'], ['experience', 'Experience'], ['skills', 'Skills'], ['certifications', 'Credentials'], ['achievements', 'Highlights'], ['contact', 'Contact']].map(([id, title]) => <a href={`#${id}`} key={id}>{title}<span>↗</span></a>)}</nav></div>
            <section className="quick-section quick-wrap" id="projects" aria-labelledby="quick-projects-title">
                <div className="quick-section-heading"><div><p className="quick-eyebrow">01 / From the workshop</p><h2 id="quick-projects-title">Ideas, made <em>real.</em></h2></div><p>AI products, useful interfaces, and experiments in how complex systems behave.</p></div>
                <div className="quick-project-grid">{featured.map((project, index) => <article className={`quick-project ${index === 0 ? 'quick-project-lead' : ''}`} key={project.name}>
                    <div className="quick-project-art"><ProjectDiagram kind={project.engineering.kind} /><span className="quick-project-number">Build / 0{projects.indexOf(project) + 1}</span></div>
                    <div className="quick-project-copy"><p className="quick-eyebrow">{project.tags?.join(' · ')}</p><h3>{project.engineering.title || project.name}</h3><p className="quick-project-description">{project.description}</p><div className="quick-tags">{(project.stack || [project.language]).filter(Boolean).map(skill => <span key={skill}>{skill}</span>)}</div><dl className="quick-engineering"><div><dt>Engineering choices</dt><dd>{project.engineering.decisions}</dd></div><div><dt>What it enables</dt><dd>{project.engineering.outcome}</dd></div></dl><div className="quick-project-links">{project.liveUrl && <a href={project.liveUrl} target="_blank" rel="noopener noreferrer">Open project ↗</a>}<a href={project.repoUrl} target="_blank" rel="noopener noreferrer">Read the code ↗</a></div><a className="quick-world-link" href={`/?project=${encodeURIComponent(project.name)}#projects`} onClick={event => visit(event, project)}>Visit this project in the 3D workshop <span>↗</span></a></div>
                </article>)}</div>
                {other.length > 0 && <div className="quick-other-projects"><h3>More things I’ve made.</h3>{other.map((project, index) => <article className="quick-project-row" key={project.name}><span className="quick-row-number">0{index + 1}</span><div><h4>{project.name}</h4><p>{project.description}</p><div className="quick-tags">{(project.stack || [project.language]).filter(Boolean).map(skill => <span key={skill}>{skill}</span>)}</div></div><div className="quick-row-links"><a href={project.repoUrl} target="_blank" rel="noopener noreferrer">Source ↗</a><a href={`/?project=${encodeURIComponent(project.name)}#projects`} onClick={event => visit(event, project)}>3D workshop ↗</a></div></article>)}</div>}
            </section>
            <section className="quick-experience-band" id="experience" aria-labelledby="quick-experience-title"><div className="quick-wrap quick-experience-layout"><div><p className="quick-eyebrow">02 / The bigger picture</p><h2 id="quick-experience-title">Small details.<br /><em>Big systems.</em></h2><p className="quick-section-note">Enterprise experience, with the same curiosity I bring to my own projects.</p><BotanicalIllustration className="quick-experience-botanical" /></div><div className="quick-timeline">{experience.map(job => <article key={job.company}><p className="quick-eyebrow">{job.dates}</p><h3>{job.title}</h3><p className="quick-company">{job.company}</p><ul>{job.bullets.map(bullet => <li key={bullet}>{bullet}</li>)}</ul><div className="quick-tags">{job.awards.map(award => <span key={award}>{award}</span>)}</div></article>)}</div></div></section>
            <section className="quick-section quick-wrap" id="skills" aria-labelledby="quick-skills-title"><div className="quick-section-heading"><div><p className="quick-eyebrow">03 / A growing toolkit</p><h2 id="quick-skills-title">Different tools.<br /><em>One curious mind.</em></h2></div><a className="quick-text-link" href="/#skills" onClick={event => { event.preventDefault(); onExplore({ hash: 'skills' }); }}>Wander through the skill garden ↗</a></div><div className="quick-skill-groups">{skillGroups.map(([title, members]) => <div key={title}><h3>{title}</h3><div className="quick-tags">{members.filter(skill => skills.includes(skill)).map(skill => <span key={skill}>{skill}</span>)}</div></div>)}</div></section>
            <section className="quick-section quick-wrap quick-credentials" id="certifications" aria-labelledby="quick-credentials-title"><div className="quick-section-heading"><div><p className="quick-eyebrow">04 / Keep learning</p><h2 id="quick-credentials-title">A little further,<br /><em>every day.</em></h2></div><div><p>ServiceNow credentials across development, administration, automation, and AI.</p><a className="quick-text-link" href={profile.credentials} target="_blank" rel="noopener noreferrer">Verified credentials ↗</a></div></div><ul className="quick-credential-list">{certifications.map(credential => <li key={credential.name}><span aria-hidden="true">✳</span><div><h3>{credential.name}</h3><p>{credential.category} · {new Date(`${credential.completed}T12:00:00`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</p></div></li>)}</ul><a className="quick-text-link" href={profile.serviceNow} target="_blank" rel="noopener noreferrer">Explore my ServiceNow portfolio ↗</a></section>
            <section className="quick-section quick-wrap" id="achievements" aria-labelledby="quick-achievements-title"><div className="quick-section-heading"><div><p className="quick-eyebrow">05 / Along the way</p><h2 id="quick-achievements-title">Little seeds.<br /><em>Lasting milestones.</em></h2></div></div><div className="quick-achievements">{achievements.map((achievement, index) => <article key={achievement.title}><span className="quick-achievement-mark" aria-hidden="true">{['✧', '❋', '✳'][index % 3]}</span><h3>{achievement.title}</h3><p>{achievement.desc}</p></article>)}</div></section>
            <section className="quick-contact" id="contact" aria-labelledby="quick-contact-title"><div className="quick-wrap"><p className="quick-eyebrow">06 / The next chapter</p><h2 id="quick-contact-title">Let’s build<br /><em>something thoughtful.</em></h2><a className="quick-email" href={`mailto:${profile.email}`}>{profile.email} <span>↗</span></a><div className="quick-contact-links"><a href={profile.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn ↗</a><a href={profile.github} target="_blank" rel="noopener noreferrer">GitHub ↗</a><a href={profile.resume} download="Nivetha-Sivakumar-Resume.pdf">Download résumé ↓</a></div><BotanicalIllustration className="quick-contact-botanical" /></div></section>
        </main>
        <footer className="quick-footer quick-wrap"><p>{profile.name}<span>Built with curiosity. Always growing.</span></p><a href="/#world" onClick={event => { event.preventDefault(); onExplore({ hash: 'world' }); }}>Take the scenic route through my world ↗</a><a href="#top">Back to top ↑</a></footer>
    </div>;
};

const PortfolioExperience = ({ profile, projects, experience, skills, certifications, achievements, onRefresh, refreshing }) => {
    const readMode = () => new URLSearchParams(location.search).get('view') === 'quick' ? 'quick' : 'explore';
    const [mode, setMode] = React.useState(readMode);
    const worldHash = React.useRef(location.hash || '#world');
    const [worldVisit, setWorldVisit] = React.useState(0);
    const navigate = (next, { hash, project } = {}) => {
        if (mode === 'explore') worldHash.current = location.hash || '#world';
        const url = new URL(location.href);
        url.searchParams.delete('project');
        if (next === 'quick') url.searchParams.set('view', 'quick'); else url.searchParams.delete('view');
        if (project) url.searchParams.set('project', project);
        url.hash = hash || (next === 'explore' ? worldHash.current : 'top');
        history.pushState(null, '', url);
        setMode(next);
        if (next === 'explore') { setWorldVisit(value => value + 1); window.scrollTo({ top: 0, behavior: 'instant' }); }
    };
    React.useEffect(() => {
        const back = () => { setMode(readMode()); setWorldVisit(value => value + 1); };
        window.addEventListener('popstate', back);
        return () => window.removeEventListener('popstate', back);
    }, []);
    const modeURL = next => { const url = new URL(location.href); url.searchParams.delete('project'); if (next === 'quick') url.searchParams.set('view', 'quick'); else url.searchParams.delete('view'); url.hash = next === 'quick' ? 'top' : worldHash.current; return url.pathname + url.search + url.hash; };
    return <><nav className={`portfolio-mode-switch ${mode === 'quick' ? 'mode-on-cream' : ''}`} aria-label="Portfolio experience"><a href={modeURL('explore')} aria-current={mode === 'explore' ? 'page' : undefined} onClick={event => { event.preventDefault(); if (mode !== 'explore') navigate('explore'); }}><span aria-hidden="true">✧</span> Explore 3D</a><a href={modeURL('quick')} aria-current={mode === 'quick' ? 'page' : undefined} onClick={event => { event.preventDefault(); if (mode !== 'quick') navigate('quick'); }}><span aria-hidden="true">≡</span> Quick View</a></nav>{mode === 'quick' ? <QuickView profile={profile} projects={projects} experience={experience} skills={skills} certifications={certifications} achievements={achievements} onExplore={options => navigate('explore', options)} /> : <WorldPortfolio key={worldVisit} profile={profile} projects={projects} onRefresh={onRefresh} refreshing={refreshing} />}</>;
};
