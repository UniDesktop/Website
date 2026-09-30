// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
//
// No `base` is set on purpose: the site is served from the domain root
// (https://unidesktop.github.io/). Starlight base-ifies every link *it*
// generates, but a hand-written `/en/...` or `../guides/...` in a page body is
// emitted verbatim, so under a project sub-path (`base: '/Website/'`) those
// links point at the user's site root and 404. Serving from the root keeps
// every author-written absolute path correct, which is what this documentation
// uses throughout.
export default defineConfig({
	site: 'https://unidesktop.github.io',
	integrations: [
		starlight({
			title: 'UniDesktop API',
			// Paths are resolved against the site root, not the project root.
			// `public/favicon.png` is copied verbatim to `<dist>/favicon.png`, so
			// the URL is `/favicon.png`; writing `/public/favicon.png` here makes
			// every page request a file that does not exist.
			favicon: '/favicon.png',
			logo: {
				src: './src/assets/houston.webp',
			},
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/UniDesktop' }],
			sidebar: [
				{
					label: 'Guides',
					items: [{ autogenerate: { directory: 'guides' } }],
				},
				{
					label: 'Reference',
					items: [{ autogenerate: { directory: 'reference' } }],
				},
				{
					label: 'Getting started',
					items: [{ autogenerate: { directory: 'getting-started' } }],
				},
				{
					label: 'Internals',
					items: [{ autogenerate: { directory: 'internals' } }],
				},
			],
			// The Chinese docs are the `root` locale, so they are served from the
			// site root: `src/content/docs/index.mdx` becomes `/` and
			// `src/content/docs/guides/tray.md` becomes `/guides/tray/`. The
			// English tree keeps the `/en/` prefix.
			//
			// Serving the default language at the root is a Starlight feature, not
			// something to hand-roll: a `src/pages/index.astro` shim that redirects
			// `/` to a language sub-path adds a hop, does not cover deep links, and
			// replaces Starlight's themed 404 with Astro's default page.
			defaultLocale: 'root',
			locales: {
				root: {
					label: '简体中文',
					lang: 'zh-CN',
				},
				en: {
					label: 'English',
					lang: 'en-US',
				},
		},
		}),
	],
});
