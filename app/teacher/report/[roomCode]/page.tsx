import { getRouteParam, type AsyncRouteParams } from '@/lib/routeParams'
import ReportPageClient from './ReportPageClient'

type ReportPageProps = {
  params: AsyncRouteParams<'roomCode'>
}

export default async function ReportPage({ params }: ReportPageProps) {
  const roomCode = await getRouteParam(params, 'roomCode')

  return <ReportPageClient roomCode={roomCode} />
}
