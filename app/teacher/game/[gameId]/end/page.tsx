import { getRouteParam, type AsyncRouteParams } from '@/lib/routeParams'
import TeacherGameEndPageClient from './TeacherGameEndPageClient'

type TeacherGameEndPageProps = {
  params: AsyncRouteParams<'gameId'>
}

export default async function TeacherGameEndPage({ params }: TeacherGameEndPageProps) {
  const gameId = await getRouteParam(params, 'gameId')

  return <TeacherGameEndPageClient gameId={gameId} />
}
