import { KepDetailPage } from '../../../views/KepDetailPage';

export default async function KepPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  return <KepDetailPage number={number} />;
}
