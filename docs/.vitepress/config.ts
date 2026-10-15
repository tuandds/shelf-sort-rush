import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitepress';

// Project settings live in prototype.config.json at the repo root.
const project = JSON.parse(readFileSync(new URL('../../prototype.config.json', import.meta.url), 'utf8'));

// Versioned builds set these (see scripts/publish-site.sh); defaults match the latest site.
const SITE: string = project.pagesUrl;
const base = process.env.DOCS_BASE ?? `${project.basePath}/docs/`;
const version = process.env.SITE_VERSION ?? 'latest';
const versions = (process.env.DOCS_VERSIONS ?? '').split(',').filter(Boolean);
const demo = `${new URL(SITE).origin}${base.replace(/docs\/$/, 'demo/')}`;

export default defineConfig({
    title: project.title,
    lang: 'vi',
    description: `Tài liệu ${project.title}`,
    base,
    cleanUrls: true,
    ignoreDeadLinks: 'localhostLinks',
    themeConfig: {
        nav: [
            { text: 'Game Design', link: '/gdd/' },
            { text: 'Guide', link: '/guide/getting-started' },
            { text: 'Chơi', link: demo },
            {
                text: version,
                items: [
                    { text: 'latest', link: `${SITE}/docs/` },
                    ...versions.map((v) => ({ text: v, link: `${SITE}/${v}/docs/` })),
                    { text: 'All versions', link: `${SITE}/#versions` }
                ]
            }
        ],
        outline: { level: [2, 3] },
        sidebar: {
            '/gdd/': [
                { text: 'Game Design Document', items: [{ text: 'Mục lục', link: '/gdd/' }] },
                {
                    text: 'I. Tầm nhìn',
                    items: [{ text: '1. Tổng quan', link: '/gdd/overview' }]
                },
                {
                    text: 'II. Gameplay',
                    items: [
                        { text: '2. Vòng lặp chơi', link: '/gdd/core-loop' },
                        { text: '3. Luật & cơ chế', link: '/gdd/rules' },
                        { text: '4. Màn chơi', link: '/gdd/levels' },
                        { text: '5. Giao diện & phản hồi', link: '/gdd/ui' }
                    ]
                },
                {
                    text: 'III. Sản xuất',
                    items: [
                        { text: '6. Lộ trình & câu hỏi mở', link: '/gdd/roadmap' },
                        { text: '7. Changelog', link: '/gdd/changelog' }
                    ]
                }
            ],
            '/guide/': [
                {
                    text: 'Developer guide',
                    items: [
                        { text: 'Getting Started', link: '/guide/getting-started' },
                        { text: 'Deployment', link: '/guide/deployment' },
                        { text: 'Level Editor', link: '/guide/level-editor' },
                        { text: 'Game Design Document →', link: '/gdd/' }
                    ]
                }
            ]
        },
        footer: { message: `${project.title} · ${version}` },
        search: { provider: 'local' },
        socialLinks: [{ icon: 'github', link: `https://github.com/${project.repo}` }]
    }
});
