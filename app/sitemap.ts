/**
 * Dynamic Sitemap for Veritas
 * Next.js will automatically generate /sitemap.xml from this file
 * See: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
 */

import { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com';

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/feed`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/explore`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.8,
    },
  ];

  // TODO: Add dynamic pages when ready
  // - Fetch popular posts and add to sitemap
  // - Fetch public user profiles and add to sitemap
  // Example:
  // const posts = await fetchPopularPosts();
  // const postPages = posts.map(post => ({
  //   url: `${baseUrl}/post/${post.id}`,
  //   lastModified: new Date(post.updated_at),
  //   changeFrequency: 'weekly' as const,
  //   priority: 0.7,
  // }));

  return [...staticPages];
}
