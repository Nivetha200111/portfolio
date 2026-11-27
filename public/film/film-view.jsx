// The film view: a cinematic tour of the live 3D island behind real HTML type, with
// scroll as the timeline. The camera visits one place per chapter.
// Each chapter is a sequence of beats that fade in and out as you scroll through it.
// Every word comes from the shared portfolio data, so the film and Quick View agree.
const FILM_CHAPTERS = ['Code alchemist', 'Experience', 'Projects', 'Skills', 'Recognition', 'Contact'];

// Kinetic type: each word clips its letters, which rise into place one after another.
const K = ({ t, start = 0 }) => {
    let i = start;
    return t.split(' ').map((word, w) => <React.Fragment key={w}>{w > 0 && ' '}<span className="k" aria-hidden="true">{[...word].map((ch, c) => <span key={c} style={{ '--i': i++ }}>{ch}</span>)}</span></React.Fragment>);
};
// The same words, readable as one string by screen readers.
const Title = ({ as: Tag = 'h2', plain, italic, className }) => <Tag className={className} aria-label={`${plain}${italic ? ' ' + italic : ''}`}>
    <K t={plain} />{italic && <> <em><K t={italic} start={plain.length} /></em></>}
</Tag>;

const FilmView = ({ profile, projects = [], experience = [], skills = [], certifications = [], achievements = [], onQuick, onExplore }) => {
    const root = React.useRef(null), canvas = React.useRef(null), film = React.useRef(null), eveningRef = React.useRef(false);
    const [state, setState] = React.useState('loading');
    const [chapter, setChapter] = React.useState(0);
    const go = index => {
        const el = root.current; if (!el) return;
        window.scrollTo({ top: (index + .03) / FILM_CHAPTERS.length * (el.offsetHeight - window.innerHeight), behavior: 'smooth' });
    };
    React.useEffect(() => {
        let cancelled = false;
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const update = () => {
            const el = root.current; if (!el) return;
            const total = el.offsetHeight - window.innerHeight;
            const g = Math.min(FILM_CHAPTERS.length - .001, Math.max(0, window.scrollY / Math.max(1, total) * FILM_CHAPTERS.length));
            if (film.current) {
                film.current.setShot(islandShot(g, { mobile: window.innerWidth < 760 }));
                // Evening comes on as the story reaches its last two chapters.
                const evening = g > 4.25;
                if (eveningRef.current !== evening) { eveningRef.current = evening; film.current.setEvening(evening); }
            }
            el.style.setProperty('--g', g.toFixed(4));
            el.querySelectorAll('.film-beat').forEach(beat => {
                const on = g >= +beat.dataset.from && g <= +beat.dataset.to;
                if (beat.dataset.on !== String(on)) beat.dataset.on = String(on);
            });
            el.dataset.dense = String([...el.querySelectorAll('.film-beat.film-wide')].some(b => b.dataset.on === 'true'));
            const c = Math.floor(g);
            el.dataset.chapter = String(c);
            setChapter(c);
        };
        let islandShot = () => ({ position: [-6, 30, 74], target: [0, 3, 0], fov: 36, offset: 0 });
        Promise.all([import('/story/world.js?v=40'), import('/film/island-shots.js?v=2')]).then(([{ createStoryWorld }, shots]) => {
            if (cancelled) return;
            islandShot = shots.islandShot;
            try {
                film.current = createStoryWorld(canvas.current, { immersive: true, cinematic: true, projectCount: projects.length, skills,
                    onReady: () => setState('ready'), onError: () => setState('error') });
                film.current.setPlaying(!reduced);
                film.current.setQuality(localStorage.getItem('garden-quality') || 'auto');
            } catch (error) { console.error(error); setState('error'); return; }
            update();
        }).catch(() => setState('error'));
        window.addEventListener('scroll', update, { passive: true }); window.addEventListener('resize', update);
        update();
        return () => { cancelled = true; window.removeEventListener('scroll', update); window.removeEventListener('resize', update); film.current?.dispose(); film.current = null; };
    }, []);

    const [first, ...rest] = profile.name.split(' ');
    const featured = projects.filter(project => project.featured).slice(0, 4);
    const others = projects.filter(project => !project.featured);
    const beat = (c, from, to, className, children, key) => <div key={key} className={`film-beat ${className || ''}`} data-from={c + from} data-to={c + to} data-on="false">{children}</div>;
    const eyebrow = (n, text) => <p className="film-eyebrow"><span className="film-dot" aria-hidden="true" />0{n} · {text}</p>;
    const lead = text => (text.split(':').length > 1 ? [text.split(':')[0], text.split(':').slice(1).join(':').trim()] : [null, text]);

    return <main className={`film film-${state}`} ref={root} data-chapter="0" aria-label={`${profile.name}: portfolio film`}>
        <div className="film-canvas" ref={canvas} aria-hidden="true" />
        <div className="film-veil" aria-hidden="true" />
        <header className="film-top"><span>{profile.name}</span><span>Chapter 0{chapter + 1} · {FILM_CHAPTERS[chapter]}</span></header>
        <p className="film-numeral" aria-hidden="true" key={chapter}>0{chapter + 1}</p>
        <nav className="film-rail" aria-label="Chapters">
            {FILM_CHAPTERS.map((name, i) => <button key={name} aria-current={i === chapter ? 'step' : undefined} onClick={() => go(i)}><span>0{i + 1}</span><b>{name}</b></button>)}
            <i className="film-rail-progress" aria-hidden="true" />
        </nav>
        <div className="film-stage">
            {/* 01 · Code alchemist: the prism over the dunes */}
            {beat(0, 0, .3, 'film-hero', <><p className="film-eyebrow"><span className="film-dot" aria-hidden="true" />{profile.location || 'Portfolio'} · 2026</p><h1 aria-label={profile.name}><span><K t={first} /></span> <em><K t={rest.join(' ') + '.'} start={first.length} /></em></h1><p className="film-lede">{profile.role}</p></>)}
            {beat(0, .42, .86, 'film-panel', <>{eyebrow(1, profile.tagline)}<Title plain="Code" italic="alchemist." /><p className="film-lede">{profile.introduction}</p><div className="film-links"><a href={profile.resume} target="_blank" rel="noopener noreferrer">Résumé ↗</a><a href={profile.github} target="_blank" rel="noopener noreferrer">GitHub ↗</a><a href={`mailto:${profile.email}`}>Email ↗</a>{profile.serviceNow && <a href={profile.serviceNow} target="_blank" rel="noopener noreferrer">ServiceNow portfolio ↗</a>}</div></>)}

            {/* 02 · Experience: the staircase above the clouds */}
            {beat(1, .04, .26, 'film-panel', <>{eyebrow(2, 'Experience')}<Title plain="Big" italic="systems." /><p className="film-lede">{experience.map(job => job.company).join(', then ')}.</p></>)}
            {experience.slice(0, 2).map((job, i) => beat(1, .3 + i * .3, .56 + i * .3, 'film-panel film-wide', <>
                <p className="film-eyebrow"><span className="film-dot" aria-hidden="true" />{job.dates}</p>
                <h3>{job.title} <em>· {job.company}</em></h3>
                <ul className="film-list">{job.bullets.map(text => { const [head, body] = lead(text); return <li key={text}>{head && <strong>{head}.</strong>} {body}</li>; })}</ul>
                <div className="film-tags">{job.awards.map(award => <span key={award}>{award}</span>)}</div>
            </>, job.company))}

            {/* 03 · Projects: the sea inside the hall */}
            {beat(2, .04, .18, 'film-panel', <>{eyebrow(3, 'Projects')}<Title plain="Things I've" italic="built." /></>)}
            {featured.map((project, i) => beat(2, .21 + i * .17, .35 + i * .17, 'film-panel film-project', <>
                <p className="film-eyebrow"><span className="film-dot" aria-hidden="true" />{String(i + 1).padStart(2, '0')} / {String(featured.length).padStart(2, '0')} · {(project.tags || []).join(' · ')}</p>
                <Title plain={project.engineering?.title || project.name} />
                <p className="film-lede">{project.description}</p>
                <div className="film-tags">{(project.stack || []).map(item => <span key={item}>{item}</span>)}</div>
                <div className="film-links">{project.liveUrl && <a href={project.liveUrl} target="_blank" rel="noopener noreferrer">Visit ↗</a>}{project.repoUrl && <a href={project.repoUrl} target="_blank" rel="noopener noreferrer">Code ↗</a>}</div>
                {i === featured.length - 1 && others.length > 0 && <p className="film-also">Also: {others.map(project => project.engineering?.title || project.name).join(' · ')}</p>}
            </>, project.name))}

            {/* 04 · Skills: the door on the night lake */}
            {beat(3, .04, .3, 'film-panel', <>{eyebrow(4, 'Skills')}<Title plain="Tools of the" italic="trade." /></>)}
            {beat(3, .34, .88, 'film-panel film-wide', <><p className="film-eyebrow"><span className="film-dot" aria-hidden="true" />{skills.length} tools I use at work and in my own projects</p><ul className="film-skills">{skills.map((skill, i) => <li key={skill} style={{ '--i': i }}>{skill}</li>)}</ul></>)}

            {/* 05 · Recognition: the moon on the sea */}
            {beat(4, .04, .25, 'film-panel', <>{eyebrow(5, 'Recognition')}<Title plain="Awards &" italic="credentials." /></>)}
            {beat(4, .28, .58, 'film-panel film-wide', <><p className="film-eyebrow"><span className="film-dot" aria-hidden="true" />Awards</p><ul className="film-rows film-rows-compact film-rows-awards">{achievements.map((item, i) => <li key={item.title} style={{ '--i': i }}><strong>{item.title}</strong><span>{item.desc}</span></li>)}</ul></>)}
            {beat(4, .61, .88, 'film-panel film-wide', <><p className="film-eyebrow"><span className="film-dot" aria-hidden="true" />Credentials</p><ul className="film-rows film-rows-compact">{certifications.map((item, i) => {
                const name = item.name.replace(/^ServiceNow /, '').replace(/^Micro-Certification - /, '').replace(/^Suite Certification - /, '').replace(/^Anthropic courses:.*$/, 'Anthropic courses (7)');
                return <li key={item.name} style={{ '--i': i }}><strong>{name}</strong><span>{item.category === 'Micro' ? 'ServiceNow micro-cert' : item.category === 'Anthropic' ? 'Claude, Claude Code, agents' : `ServiceNow ${item.category.toLowerCase()}`}</span></li>;
            })}</ul>{profile.serviceNow && <div className="film-links"><a href={profile.serviceNow} target="_blank" rel="noopener noreferrer">Every badge on my ServiceNow portfolio ↗</a></div>}</>)}

            {/* 06 · Contact: back to the dunes at sunset */}
            {beat(5, .12, 1, 'film-panel film-contact', <>{eyebrow(6, 'Contact')}<Title plain="Let's" italic="talk." />
                <a className="film-email" href={`mailto:${profile.email}`}>{profile.email}</a>
                <div className="film-links"><a href={profile.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn ↗</a><a href={profile.github} target="_blank" rel="noopener noreferrer">GitHub ↗</a><a href={profile.resume} target="_blank" rel="noopener noreferrer">Résumé ↗</a>{profile.serviceNow && <a href={profile.serviceNow} target="_blank" rel="noopener noreferrer">ServiceNow portfolio ↗</a>}<a href="?view=quick#top" onClick={event => { event.preventDefault(); onQuick(); }}>Quick View ↗</a></div><a className="film-enter" href="#world" onClick={event => { event.preventDefault(); onExplore(); }}>Walk around the island yourself <span aria-hidden="true">→</span></a></>)}
            <p className="film-cue" aria-hidden="true" data-hidden={chapter > 0 ? 'true' : 'false'}>Scroll</p>
        </div>
        {state === 'error' && <p className="film-error" role="status">This device can't play the film. <a href="?view=quick#top" onClick={event => { event.preventDefault(); onQuick(); }}>Open the quick view</a>.</p>}
    </main>;
};
