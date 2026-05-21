import { getRouteParam, type AsyncRouteParams } from '@/lib/routeParams'
import StudentGameResultPageClient from './StudentGameResultPageClient'

type StudentGameResultPageProps = {
  params: AsyncRouteParams<'gameId'>
}

export default async function StudentGameResultPage({ params }: StudentGameResultPageProps) {
  const gameId = await getRouteParam(params, 'gameId')

  return <StudentGameResultPageClient gameId={gameId} />
}
