import { getRouteParam, type AsyncRouteParams } from '@/lib/routeParams'
import TeacherGameReportPageClient from './TeacherGameReportPageClient'

type TeacherGameReportPageProps = {
  params: AsyncRouteParams<'gameId'>
}

export default async function TeacherGameReportPage({ params }: TeacherGameReportPageProps) {
  const gameId = await getRouteParam(params, 'gameId')

  return <TeacherGameReportPageClient gameId={gameId} />
}
