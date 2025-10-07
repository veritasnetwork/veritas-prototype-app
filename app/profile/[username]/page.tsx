/**
 * Profile Page Route
 * Dynamic route for user profiles: /profile/[username]
 */

import { ProfilePage } from '@/components/profile/ProfilePage';

interface ProfilePageRouteProps {
  params: Promise<{
    username: string;
  }>;
}

export default async function ProfilePageRoute({ params }: ProfilePageRouteProps) {
  const { username } = await params;
  return <ProfilePage username={username} />;
}

// Generate metadata for SEO
export async function generateMetadata({ params }: ProfilePageRouteProps) {
  const { username } = await params;
  return {
    title: `@${username} - Veritas`,
    description: `View ${username}'s profile on Veritas`,
  };
}
