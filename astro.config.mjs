// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://unidesktop.github.io',
	base: '/Website/',
	integrations: [
		starlight({
			title: 'UniDesktop API',
			favicon: '/public/favicon.png',
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
			defaultLocale: 'zh-cn',
			locales: {
				en: {
					label: 'English',
					lang: 'en-US',
				},
				'zh-cn': {
					label: '简体中文',
					lang: 'zh-CN',
				},
		},
		}),
	],
});
