import { Applications } from '@/components/applications';
export default async function Page({ searchParams }: { searchParams: Promise<{ add?: string }> }) {
  return <Applications initialAdd={(await searchParams).add === 'true'} />;
}
